// 端到端规则测试：用内存 mock 替换 server/db.js，真实启动 Express 后打 HTTP 请求。
// 覆盖：顺序解锁、跳站拒绝、重复完赛拒绝、战绩排序、历史跳站脏数据兼容、断点补赛、全季完赛。
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const dbPath = process.cwd() + '/server/db.js'
const backup = readFileSync(dbPath, 'utf8')

// 注意：本模板会写入磁盘成为 db.js，内部一律使用字符串匹配，避免反斜杠转义问题。
const MOCK_DB = String.raw
`
const state = {
  team: null,
  airships: [],
  pilots: [],
  mechanics: [],
  upgrades: [],
  circuits: [],
  sponsors: [],
  race_log: []
}
let circuitSeq = 0, logSeq = 0
export function __mutate(fn) { fn({ state }) }

export const db = { exec() {} }

function prepare(sql) {
  return {
    run(...p) {
      if (sql.startsWith('INSERT INTO circuits')) {
        const [name, diff, weather, bonus_pts] = p
        const id = ++circuitSeq
        state.circuits.push({ id, name, diff: Number(diff), weather, bonus_pts, done: 0, rank: null, finished: 0 })
        return { lastInsertRowid: BigInt(id) }
      }
      if (sql.startsWith('INSERT INTO race_log')) {
        const [circuit_id, season, rank, pts, money, note, ts] = p
        state.race_log.push({ id: ++logSeq, circuit_id, season, rank, pts, money, note, ts })
        return { lastInsertRowid: BigInt(logSeq) }
      }
      if (sql.startsWith('INSERT INTO team')) { state.team = { id: 1, name: p[0] || '战队', money: 20000, rep: 50, level: 1, season: 1, season_pts: 0, season_pos: 1 }; return { lastInsertRowid: BigInt(1) } }
      if (sql.startsWith('INSERT INTO airships')) {
        state.airships.push({ id: state.airships.length + 1, name: p[0], speed: 60, dur: 80, turn: 55, acc: 60, parts_dur: 100, hp: 100 })
        return { lastInsertRowid: BigInt(1) }
      }
      if (sql.startsWith('INSERT INTO pilots')) {
        const [name, skill, courage, exp, wage, mood] = p
        state.pilots.push({ id: state.pilots.length + 1, name, skill, courage, exp, wage, mood })
        return { lastInsertRowid: BigInt(state.pilots.length) }
      }
      if (sql.startsWith('INSERT INTO mechanics')) {
        const [name, skill, wage, mood] = p
        state.mechanics.push({ id: state.mechanics.length + 1, name, skill, wage, mood })
        return { lastInsertRowid: BigInt(state.mechanics.length) }
      }
      if (sql.startsWith('INSERT INTO upgrades')) return { lastInsertRowid: BigInt(99) }
      if (sql.startsWith('INSERT INTO sponsors')) {
        const [name, target, reward, rep] = p
        state.sponsors.push({ id: state.sponsors.length + 1, name, target, reward, rep, earned: 0, affinity: 60 })
        return { lastInsertRowid: BigInt(state.sponsors.length) }
      }
      if (sql.startsWith('UPDATE team SET money=money+?, rep=rep+?, season_pts=season_pts+?')) {
        const [money, rep, pts] = p
        state.team.money += money; state.team.rep += rep; state.team.season_pts += pts; return {}
      }
      if (sql.startsWith('UPDATE team SET season_pos=?')) { state.team.season_pos = p[0]; return {} }
      if (sql.startsWith('UPDATE team SET money=money+?, rep=rep+?')) { state.team.money += p[0]; state.team.rep += p[1]; return {} }
      if (sql.startsWith('UPDATE circuits SET finished=1, rank=? WHERE id=?')) {
        const c = state.circuits.find(x => x.id === p[1]); c.finished = 1; c.rank = p[0]; return {}
      }
      if (sql.startsWith('UPDATE airships SET parts_dur=?')) { state.airships[0].parts_dur = p[0]; state.airships[0].hp = p[1]; return {} }
      if (sql.startsWith('UPDATE pilots SET exp=exp+')) return {}
      if (sql.startsWith('UPDATE sponsors SET earned=1')) { const sp = state.sponsors.find(x => x.id === p[0]); sp.earned = 1; sp.affinity += 10; return {} }
      if (sql.startsWith('UPDATE team SET money=money-?')) { state.team.money -= p[0]; return {} }
      if (sql.startsWith('DELETE FROM')) {
        const t = sql.slice('DELETE FROM '.length).trim()
        if (t === 'sqlite_sequence') return {}
        if (t === 'circuits') { state.circuits = []; circuitSeq = 0; return {} }
        if (t === 'race_log') { state.race_log = []; logSeq = 0; return {} }
        if (Array.isArray(state[t])) state[t] = []
        if (t === 'team') state.team = null
        return {}
      }
      throw new Error('mock run unhandled: ' + sql)
    },
    get(...p) {
      if (sql.includes('COUNT(*) c FROM team')) return { c: state.team ? 1 : 0 }
      if (sql.includes('FROM circuits WHERE id=?')) return state.circuits.find(x => x.id === p[0])
      if (sql.includes('FROM team WHERE id=1')) return state.team
      if (sql.includes('FROM sponsors WHERE id=?')) return state.sponsors.find(x => x.id === p[0])
      throw new Error('mock get unhandled: ' + sql)
    },
    all() {
      if (sql.startsWith('SELECT * FROM airships')) return state.airships
      if (sql.includes('FROM pilots') && sql.includes('LIMIT 1')) return state.pilots.slice(0, 1)
      if (sql.includes('FROM pilots')) return state.pilots
      if (sql.includes('FROM mechanics')) return state.mechanics
      if (sql.includes('FROM upgrades')) return state.upgrades
      if (sql.includes('FROM race_log l')) {
        return [...state.race_log].sort((a, b) => {
          const ca = state.circuits.find(c => c.id === a.circuit_id)
          const cb = state.circuits.find(c => c.id === b.circuit_id)
          return (a.season - b.season) || ((ca?.id ?? 1e9) - (cb?.id ?? 1e9)) || (a.id - b.id)
        })
      }
      if (sql.includes('FROM race_log')) return state.race_log
      if (sql.includes('ORDER BY id ASC') && sql.includes('circuits')) return [...state.circuits].sort((a, b) => a.id - b.id)
      if (sql.includes('FROM circuits')) return state.circuits
      if (sql.includes('FROM sponsors')) return state.sponsors
      throw new Error('mock all unhandled: ' + sql)
    }
  }
}
export function run(sql, ...p) { return prepare(sql).run(...p) }
export function all(sql, ...p) { return prepare(sql).all(...p) }
export function get(sql, ...p) { return prepare(sql).get(...p) }
`

let failures = 0
const assert = (cond, msg) => { if (!cond) { failures++; console.error('❌ FAIL:', msg) } else console.log('✅', msg) }

writeFileSync(dbPath, MOCK_DB)
const restore = () => writeFileSync(dbPath, backup)
process.on('exit', restore)

try {
  // server 固定监听 4180
  await import(pathToFileURL(process.cwd() + '/server/index.js').href + '?t=' + Date.now())
  await new Promise(r => setTimeout(r, 300))
  const BASE = 'http://localhost:4180'
  const getj = pth => fetch(BASE + pth).then(r => r.json())
  const postj = pth => fetch(BASE + pth, { method: 'POST' }).then(r => r.json())

  let s = await getj('/api/state')
  assert(s.circuits.length === 6, '种子 6 座赛站')
  assert(s.circuits[0].open === true && s.nextCid === s.circuits[0].id, '初始仅第 1 站 open')
  assert(s.circuits.slice(1).every(c => c.open === false), '第 2-6 站锁定')
  assert(s.seasonDone === 0 && s.finishedCount === 0 && s.legacyGap === false, '初始进度 0、无历史跳站标记')

  const skip = await postj('/api/race/' + s.circuits[2].id)
  assert(skip.ok === false && /前置赛站/.test(skip.msg), '跳第 3 站被拒绝: ' + skip.msg)

  const r1 = await postj('/api/race/' + s.circuits[0].id)
  assert(r1.ok === true && r1.circuit_id === s.circuits[0].id, '第 1 站结算成功')
  s = await getj('/api/state')
  assert(s.seasonDone === 1 && s.finishedCount === 1, '连续进度=1')
  assert(s.circuits[1].open === true && s.circuits[2].open === false, '解锁态推进至第 2 站')
  assert(s.team.season_pts === r1.pts, '积分入账 ' + r1.pts)

  const again = await postj('/api/race/' + s.circuits[0].id)
  assert(again.ok === false && /已完赛/.test(again.msg), '已完赛站不可重复参赛')
  const afterAgain = await getj('/api/state')
  assert(afterAgain.team.season_pts === s.team.season_pts, '拒绝重复参赛时积分不重复发放')

  const r2 = await postj('/api/race/' + s.circuits[1].id)
  assert(r2.ok === true, '第 2 站结算成功')
  s = await getj('/api/state')
  assert(s.seasonDone === 2, '连续进度=2')
  const order12 = s.log.map(l => l.circuit_id)
  assert(JSON.stringify(order12) === JSON.stringify([1, 2]), '战绩按航线顺序 1,2: ' + JSON.stringify(order12))

  // ---- 构造旧版本遗留的跳站脏数据：第 4、5 站已完赛，第 3 站缺失 ----
  // 用与 index.js 完全相同的模块 URL 导入，拿到同一份 mock 状态
  const dbMod = await import(pathToFileURL(dbPath).href)
  dbMod.__mutate(({ state }) => {
    [[4, 1], [5, 2]].forEach(([cid, rank]) => {
      const c = state.circuits.find(x => x.id === cid)
      c.finished = 1; c.rank = rank
      state.race_log.push({ id: state.race_log.length + 100, circuit_id: cid, season: 1, rank, pts: 25, money: 1000, note: '历史跳站', ts: 'legacy' })
      state.team.season_pts += 25
    })
  })
  s = await getj('/api/state')
  assert(s.finishedCount === 4 && s.seasonDone === 2, '脏数据：完赛计数 4，但航线进度截断为 2')
  assert(s.legacyGap === true, 'legacyGap=true')
  assert(s.nextCid === s.circuits[2].id && s.circuits[2].open === true, '当前可赛站仍是第 3 站（断点）')
  assert(s.circuits[5].open === false, '第 6 站仍锁定')
  const legacyOrder = s.log.map(l => l.circuit_id)
  assert(JSON.stringify(legacyOrder) === JSON.stringify([1, 2, 4, 5]), '历史战绩按赛站归位 1,2,4,5: ' + JSON.stringify(legacyOrder))

  const r3 = await postj('/api/race/' + s.circuits[2].id)
  assert(r3.ok === true, '断点补赛第 3 站成功')
  s = await getj('/api/state')
  assert(s.seasonDone === 5 && s.finishedCount === 5 && s.legacyGap === false, '补齐后进度=5，legacyGap 消失')
  assert(s.circuits[5].open === true && s.nextCid === s.circuits[5].id, '第 6 站解锁')

  const r6 = await postj('/api/race/' + s.circuits[5].id)
  assert(r6.ok === true, '第 6 站结算成功')
  s = await getj('/api/state')
  assert(s.seasonDone === 6 && s.finishedCount === 6 && s.nextCid === null, '全季完赛，nextCid=null')
  const finalOrder = s.log.map(l => l.circuit_id)
  assert(JSON.stringify(finalOrder) === JSON.stringify([1, 2, 3, 4, 5, 6]), '最终战绩 1..6 顺序: ' + JSON.stringify(finalOrder))

  const extra = await postj('/api/race/' + s.circuits[0].id)
  assert(extra.ok === false, '全季完赛后再请求被拒')
  const bad = await postj('/api/race/999')
  assert(bad.ok === false && /不存在/.test(bad.msg), '不存在赛站被拒: ' + bad.msg)

  // 重置接口后规则恢复初始态
  await fetch(BASE + '/api/reset', { method: 'POST' })
  s = await getj('/api/state')
  assert(s.seasonDone === 0 && s.legacyGap === false && s.circuits[0].open === true && s.log.length === 0, 'reset 后恢复初始状态')

  console.log(failures ? `\n${failures} 项失败` : '\n全部通过 🎉')
  process.exit(failures ? 1 : 0)
} catch (e) {
  console.error(e)
  process.exit(1)
}
