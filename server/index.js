import express from 'express'
import { db, run, all, get } from './db.js'

const app = express()
app.use(express.json())
const PORT = 4180
const PTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
const WEATHER = { '晴': 1.0, '风': 0.96, '雨': 0.9, '雾': 0.84, '雷暴': 0.78 }
const now = () => new Date().toLocaleString('zh-CN')

function seed() {
  if (get('SELECT COUNT(*) c FROM team').c > 0) return
  run('INSERT INTO team (name) VALUES (?)', '苍穹疾风战队')
  run('INSERT INTO airships (name) VALUES (?)', '云雀·I').lastInsertRowid
  run('INSERT INTO pilots (name,skill,courage,exp,wage,mood) VALUES (?,?,?,?,?,?)', '奥罗·晨曦', 62, 58, 20, 80, 75)
  run('INSERT INTO pilots (name,skill,courage,exp,wage,mood) VALUES (?,?,?,?,?,?)', '莉娜·云涛', 55, 65, 8, 55, 82)
  run('INSERT INTO mechanics (name,skill,wage,mood) VALUES (?,?,?,?)', '格蕾丝·铆钉', 58, 45, 78)
  const ups = [['竞速涡轮','引擎','speed',14,2600],['流线翼板','翼板','speed',9,1800],['氮气助推','氮气','acc',16,2200],
    ['回旋舵','龙骨','turn',12,2000],['云母护甲','护甲','dur',15,2400],['轻量合金','翼板','acc',11,1900],
    ['蓝纹喷射引擎','引擎','speed',20,3200],['硬壳鳞甲','护甲','dur',22,3400]]
  ups.forEach(([n, slot, stat, bonus, price]) => run('INSERT INTO upgrades (name,slot,stat,bonus,price) VALUES (?,?,?,?,?)', n, slot, stat, bonus, price))
  const cir = [['晨雾浮岛','1','雾'],['雷鸣云谷','2','雷暴'],['翡翠群岛','3','晴'],['风暴裂谷','3','雨'],['极光穹顶','4','风'],['星界之巅','5','雾']]
  cir.forEach(([n, d, w]) => run('INSERT INTO circuits (name,diff,weather,bonus_pts) VALUES (?,?,?,?)', n, Number(d), w, Number(d) * 4))
  const spo = [['云帆工坊', 12, 4000, 8], ['星罗航空', 22, 8000, 15], ['流风动力', 32, 14000, 22], ['苍穹商会', 45, 22000, 32]]
  spo.forEach(([n, t, r, rep]) => run('INSERT INTO sponsors (name,target,reward,rep) VALUES (?,?,?,?)', n, t, r, rep))
}
export function teamCore() { return get('SELECT * FROM team WHERE id=1') }
export function airship() { return all('SELECT * FROM airships')[0] || { speed: 60, dur: 80, turn: 55, acc: 60, parts_dur: 100, hp: 100, name: '云雀·I', id: 1 } }
export function fleetStats() {
  const a = airship()
  const up = all('SELECT * FROM upgrades WHERE equipped=1')
  const s = { speed: a.speed, dur: a.dur, turn: a.turn, acc: a.acc, name: a.name, id: a.id, parts_dur: a.parts_dur, hp: a.hp }
  up.forEach(u => { s[u.stat] = (s[u.stat] || 0) + u.bonus })
  return s
}
function leadership() {
  const ps = all('SELECT * FROM pilots ORDER BY (skill+courage) DESC')
  if (!ps.length) return 20
  const p = ps[0]
  return (p.skill + p.courage) / 2 * 0.4 + p.exp * 0.15 + (p.mood - 50) * 0.08
}
function mechBonus() {
  const m = all('SELECT * FROM mechanics ORDER BY skill DESC')
  if (!m.length) return 10
  return m[0].skill * 0.12 + (m[0].mood - 50) * 0.06
}
function power(circuit) {
  const st = fleetStats()
  const parts = Math.max(0.5, Math.min(1.15, st.parts_dur / 100))
  const wF = WEATHER[circuit.weather] || 1
  const air = (st.speed * 0.35 + st.turn * 0.18 + st.acc * 0.22 + st.dur * 0.12) // dur 不参与快，但参与耐久
  const rng = (Math.random() * 0.22 - 0.11)
  return (air * parts * wF + leadership() + mechBonus()) * (1 + rng)
}
// 赛站必须按 id（航线下行→上行）顺序参赛，前一站未完赛前后续赛站一律锁定
function orderedCircuits() { return all('SELECT * FROM circuits ORDER BY id ASC') }
// 当前唯一允许参赛的赛站：航线上第一个未完成的赛站；全部完赛时为 null
function nextCircuit() { return orderedCircuits().find(c => !c.finished) || null }
function runRace(c) {
  if (!c || c.finished) return null
  const mine = power(c) * (1 + c.diff * 0.02)
  const opps = []
  for (let i = 0; i < 5; i++) {   // 5 名对手，共 6 艇竞技，名次 1-6
    let base = 55 + c.diff * 11 + (Math.random() * 40 - 8)
    opps.push(Math.max(20, base))
  }
  const allP = [...opps, mine].sort((a, b) => b - a)
  const rank = allP.indexOf(mine) + 1
  const pts = PTS[rank - 1] || 1
  const money = Math.round((600 + (7 - rank) * 180) * (1 + c.diff * 0.05))
  const a = airship()
  const wear = 5 + c.diff * 3 + (WEATHER[c.weather] < 0.9 ? 4 : 0)
  const newPd = Math.max(10, a.parts_dur - wear)
  const repGain = Math.max(1, 5 - rank + c.diff)
  run('UPDATE airships SET parts_dur=?, hp=? WHERE id=?', newPd, Math.max(20, a.hp - wear), a.id)
  all('SELECT * FROM pilots ORDER BY (skill+courage) DESC LIMIT 1').forEach(p => {
    if (p) run('UPDATE pilots SET exp=exp+? , mood=mood-? WHERE id=?', rank <= 4 ? 3 : 1, rank > 8 ? 6 : 2, p.id)
  })
  run('UPDATE team SET money=money+?, rep=rep+?, season_pts=season_pts+? WHERE id=1', money, repGain, pts)
  // 更新赛季名次：取本季已完赛各站的最佳名次
  const ranksDone = all('SELECT rank FROM circuits WHERE finished=1')
  const best = Math.min(rank, ...ranksDone.map(r => r.rank))
  run('UPDATE team SET season_pos=? WHERE id=1', Math.max(1, best))
  run('UPDATE circuits SET finished=1, rank=? WHERE id=?', rank, c.id)
  run('INSERT INTO race_log (circuit_id,season,rank,pts,money,note,ts) VALUES (?,?,?,?,?,?,?)', c.id, teamCore().season, rank, pts, money, c.weather === '晴' ? `晴空万里，${c.name}` : `${c.weather}天，${c.name}`, now())
  // 积分落账后再结算赞助：按积分阈值统一对账，顺序参赛下只会向前推进
  reconcileSponsors()
  return { circuit_id: c.id, rank, pts, money, wear, parts_dur: newPd, repGain }
}
// 赞助商对账：以当前赛季积分为唯一事实来源，earned 与是否达标保持一致
function reconcileSponsors() {
  const pts = teamCore().season_pts
  all('SELECT * FROM sponsors').forEach(s => {
    if (!s.reward) return
    const reached = pts >= s.target
    if (reached && !s.earned) {
      run('UPDATE team SET money=money+?, rep=rep+? WHERE id=1', s.reward, s.rep)
      run('UPDATE sponsors SET earned=1, affinity=affinity+10 WHERE id=?', s.id)
    } else if (!reached && s.earned) {
      run('UPDATE team SET money=money-?, rep=rep-? WHERE id=1', s.reward, s.rep)
      run('UPDATE sponsors SET earned=0, affinity=affinity-10 WHERE id=?', s.id)
    }
  })
}

// 历史数据兼容：修复「跳站参赛」产生的脏数据——首个未完成赛站之后的完赛记录
// 一律视为越站，回滚其积分/奖金/声望，删除流水并重置赛站，再统一重算赞助与赛季名次。
// 部件磨损是完赛即发生的真实损耗，予以保留。
function reconcileLegacySkips() {
  const cs = orderedCircuits()
  const firstOpen = cs.findIndex(c => !c.finished)
  if (firstOpen === -1) return
  const skipped = cs.slice(firstOpen + 1).filter(c => c.finished)
  if (!skipped.length) return

  let ptsBack = 0, moneyBack = 0, repBack = 0
  skipped.forEach(c => {
    all('SELECT * FROM race_log WHERE circuit_id=?', c.id).forEach(l => {
      ptsBack += l.pts || 0
      moneyBack += l.money || 0
      run('DELETE FROM race_log WHERE id=?', l.id)
    })
    repBack += Math.max(1, 5 - (c.rank || 6) + c.diff)
    console.log(`[SKY] 历史修复：赛站《${c.name}》在前置赛站未完成时已完赛（名次 ${c.rank}），回滚战绩与奖励`)
    run('UPDATE circuits SET finished=0, rank=NULL WHERE id=?', c.id)
  })
  if (ptsBack || moneyBack || repBack) {
    run('UPDATE team SET season_pts=MAX(0,season_pts-?), money=money-?, rep=rep-? WHERE id=1', ptsBack, moneyBack, repBack)
  }

  reconcileSponsors()
  const ranks = orderedCircuits().filter(x => x.finished && x.rank).map(x => x.rank)
  run('UPDATE team SET season_pos=? WHERE id=1', ranks.length ? Math.max(1, Math.min(...ranks)) : 1)
  console.log(`[SKY] 历史修复完成：回滚 ${skipped.length} 个越站赛站，积分 -${ptsBack}，奖金 -${moneyBack}，声望 -${repBack}`)
}
seed()
reconcileLegacySkips()

/* ---------- 共享响应 ---------- */
const payload = () => {
  const t = teamCore()
  const st = fleetStats()
  const upgrades = all('SELECT * FROM upgrades')
  const pilots = all('SELECT * FROM pilots')
  const mechanics = all('SELECT * FROM mechanics')
  const circuits = orderedCircuits()
  const sponsors = all('SELECT * FROM sponsors')
  const log = all('SELECT * FROM race_log ORDER BY id DESC')
  const done = circuits.filter(c => c.finished).length
  return { team: t, airship: st, upgrades, pilots, mechanics, circuits, sponsors, log, seasonDone: done, seasonTotal: circuits.length }
}

app.get('/api/state', (_, res) => res.json(payload()))
app.get('/api/overview', (_, res) => res.json(payload()))

// 购买新升级件
app.post('/api/shop', (req, res) => {
  const { slot, stat, name, price, bonus } = req.body
  const t = teamCore()
  if (t.money < price) return res.json({ ok: false, msg: '资金不足' })
  run('UPDATE team SET money=money-? WHERE id=1', price)
  const r = run('INSERT INTO upgrades (name,slot,stat,bonus,price,level) VALUES (?,?,?,?,?,1)', name || '神秘部件', slot, stat, bonus, price)
  res.json({ ok: true, msg: '已购入新部件', id: Number(r.lastInsertRowid) })
})
// 装备/卸下
app.post('/api/equip/:id', (req, res) => {
  const up = get('SELECT * FROM upgrades WHERE id=?', Number(req.params.id))
  // 同槽位卸下其他
  all('SELECT id FROM upgrades WHERE slot=? AND equipped=1 AND id!=?', up.slot, up.id).forEach(u => run('UPDATE upgrades SET equipped=0 WHERE id=?', u.id))
  run('UPDATE upgrades SET equipped=1 WHERE id=?', up.id)
  res.json({ ok: true })
})
app.post('/api/unequip/:id', (req, res) => {
  run('UPDATE upgrades SET equipped=0 WHERE id=?', Number(req.params.id))
  res.json({ ok: true })
})

// 人员
app.post('/api/hire_pilot', (req, res) => {
  const t = teamCore(); const cost = 1500
  if (t.money < cost) return res.json({ ok: false, msg: '资金不足' })
  const names = ['鹰眼·鸦', '风歌·岚', '铁羽·矶', '晨星·曦']
  const n = names[Math.floor(Math.random() * names.length)]
  run('UPDATE team SET money=money-? WHERE id=1', cost)
  run('INSERT INTO pilots (name,skill,courage,wage,mood) VALUES (?,?,?,?,?)', n, 45 + Math.floor(Math.random() * 20), 48 + Math.floor(Math.random() * 18), 60, 72)
  res.json({ ok: true, msg: `已招募 ${n}` })
})
app.post('/api/hire_mech', (req, res) => {
  const t = teamCore(); const cost = 1000
  if (t.money < cost) return res.json({ ok: false, msg: '资金不足' })
  const n = '工匠·' + ['铁锤', '螺丝', '风箱', '砧台'][Math.floor(Math.random() * 4)]
  run('UPDATE team SET money=money-? WHERE id=1', cost)
  run('INSERT INTO mechanics (name,skill,wage,mood) VALUES (?,?,?,?)', n, 40 + Math.floor(Math.random() * 20), 40, 74)
  res.json({ ok: true, msg: `已招募 ${n}` })
})
app.post('/api/train', (req, res) => {
  const t = teamCore(); const cost = 800
  if (t.money < cost) return res.json({ ok: false, msg: '资金不足' })
  run('UPDATE team SET money=money-? WHERE id=1', cost)
  run('UPDATE pilots SET skill=skill+2, mood=mood+2 WHERE id=?', Number(req.body.id) || all('SELECT id FROM pilots LIMIT 1')[0].id)
  res.json({ ok: true, msg: '完成特训，技巧+2' })
})

// 维护
app.post('/api/maintain', (req, res) => {
  const t = teamCore(); const a = airship()
  const cost = Math.round((100 - a.parts_dur) * 25)
  if (cost < 200 || t.money < 200) return res.status(200).json({ ok: false, cost, msg: cost < 200 ? '部件状态良好，无需维护' : '资金不足' })
  run('UPDATE team SET money=money-? WHERE id=1', cost)
  run('UPDATE airships SET parts_dur=100, hp=100 WHERE id=?', a.id)
  res.json({ ok: true, cost })
})

// 竞速：仅允许按航线顺序挑战当前未完成的第一站，前置赛站未完成时拒绝
app.post('/api/race/:cid', (req, res) => {
  const cid = Number(req.params.cid)
  const c = get('SELECT * FROM circuits WHERE id=?', cid)
  if (!c) return res.json({ ok: false, msg: '该赛站不存在' })
  if (c.finished) return res.json({ ok: false, msg: '该站已完赛' })
  const cur = nextCircuit()
  if (!cur) return res.json({ ok: false, msg: '本赛季已全部完赛' })
  if (cur.id !== cid) {
    const idx = orderedCircuits().findIndex(x => x.id === cid) + 1
    return res.json({ ok: false, msg: `请先完成第 ${orderedCircuits().findIndex(x => x.id === cur.id) + 1} 站《${cur.name}》，第 ${idx} 站尚未解锁` })
  }
  const r = runRace(c)
  if (!r) return res.json({ ok: false, msg: '该站未开启或已完赛' })
  res.json({ ok: true, ...r })
})

// 重置（重置数据到初始种子）
app.post('/api/reset', (_, res) => {
  ['race_log', 'sponsors', 'circuits', 'upgrades', 'mechanics', 'pilots', 'airships', 'team'].forEach(t => { try { run(`DELETE FROM ${t}`) } catch (e) {} })
  try { run('DELETE FROM sqlite_sequence') } catch (e) {}
  seed()
  res.json({ ok: true })
})

app.listen(PORT, () => console.log(`[SKY] API running at http://localhost:${PORT}`))