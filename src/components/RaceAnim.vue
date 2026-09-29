<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSkyStore } from '@/store/sky'
const store = useSkyStore()
const props = defineProps({ result: { type: Object, required: true } })
const emit = defineEmits(['back'])
const result = computed(() => props.result || {})

const NAMES = ['苍穹极光', '翡翠之翼', '雷鸣环驾', '暮色猎手', '星尘漂流', '岚风号']
const COLORS = ['#ffcf5c', '#7ecbff', '#b19cff', '#6fe7d0', '#ff9fb0', '#ffb85c']

const scene = computed(() => store.circuits.find(c => c.id === result.value.circuit_id))

const now = ref(0)          // 当前动画时间(秒)
const showSettle = ref(false)
const startT = ref(0)
const racers = ref([])

// 冲线顺序按真实名次确定：玩家艇在第 result.rank 位冲线
function setup() {
  const times = [0.72, 0.85, 0.98, 1.11, 1.24, 1.37]
  const rank = result.value.rank
  const playerSlot = Math.max(0, Math.min(5, rank - 1))
  const oppSlots = [0, 1, 2, 3, 4, 5].filter(i => i !== playerSlot)
  racers.value = [0, 1, 2, 3, 4, 5].map(idx => {
    const isPlayer = idx === 0
    const slot = isPlayer ? playerSlot : oppSlots.shift()
    return {
      idx, isPlayer,
      fin: times[slot],
      name: isPlayer ? store.team.name : NAMES[(idx + rank) % NAMES.length],
      color: COLORS[(idx + rank) % COLORS.length],
      done: false
    }
  })
}

// 实时状态（位置 + 进度），由 now 派生，保证响应式重渲染
const live = computed(() => racers.value.map(r => {
  const T = Math.min(1, Math.max(0, now.value / r.fin))
  return { ...r, x: Math.round((6 + (1 - Math.pow(1 - T, 2.2)) * 88) * 100) / 100, prog: r.done ? 99 : T }
}))
const rankLive = computed(() => [...live.value].sort((a, b) => b.prog - a.prog))

let raf = null
function tick(n) {
  now.value = (n - startT.value) / 1000
  if (now.value >= 1.68) {
    cancelAnimationFrame(raf)
    racers.value.forEach(r => r.done = true)
    showSettle.value = true
    return
  }
  raf = requestAnimationFrame(tick)
}
function goBack() { emit('back') }

onMounted(() => { setup(); startT.value = performance.now(); raf = requestAnimationFrame(tick) })
onUnmounted(() => cancelAnimationFrame(raf))
</script>

<template>
  <div class="race-ov">
    <div class="race-sky">
      <div class="race-title">
        <h3>🏁 {{ scene?.name || '' }} · 竞速开始</h3>
        <div v-if="scene" class="sub2">{{ scene.weather }} · 难度 {{ '★'.repeat(scene.diff) }}</div>
      </div>

      <!-- 赛道 -->
      <div class="track">
        <div class="startline">起</div>
        <div class="finishline">冲线</div>
        <div v-for="(r, i) in live" :key="r.idx" class="lane" :style="{ top: (10 + i * 15.5) + '%' }">
          <div class="lane-ratio">
            <div class="ship" :class="{ player: r.isPlayer, done: r.done }"
              :style="{ left: r.x + '%', background: 'linear-gradient(120deg,' + r.color + ',' + r.color + 'cc)' }">
              <span class="s-icon">✈️</span>{{ r.name }}
            </div>
          </div>
          <div class="pos" :class="{ 'pos-p': r.isPlayer }">{{ rankLive.indexOf(r) + 1 }}</div>
        </div>
      </div>

      <!-- 实时排位榜 -->
      <div class="board">
        <div class="board-h">LIVE</div>
        <div v-for="(r, k) in rankLive" :key="r.idx" class="board-row" :class="{ 'board-p': r.isPlayer }">
          <span class="bpos">{{ k + 1 }}</span>{{ r.name }}<span v-if="r.isPlayer" class="you">你</span>
        </div>
      </div>

      <!-- 结算卡 -->
      <transition name="pop">
        <div v-if="showSettle" class="settle">
          <div class="medal">{{ result.rank <= 3 ? ['🥇', '🥈', '🥉'][result.rank - 1] : '🌊' }}</div>
          <div class="s-title">第 {{ result.rank }} 名</div>
          <div class="s-row"><span>积分</span><b>+{{ result.pts }}</b></div>
          <div class="s-row"><span>奖金</span><b>+¥{{ result.money }}</b></div>
          <div class="s-row"><span>部件磨损</span><b style="color:#ff9fb0">-{{ result.wear }}</b></div>
          <div class="s-row"><span>声望</span><b>+{{ result.repGain }}</b></div>
          <button class="btn primary s-btn" @click="goBack">返回航线 ▶</button>
        </div>
      </transition>
    </div>
  </div>
</template>