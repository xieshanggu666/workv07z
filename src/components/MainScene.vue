<script setup>
import { computed, ref } from 'vue'
import { useSkyStore } from '@/store/sky'
const store = useSkyStore()
const emit = defineEmits(['race'])

const wIco = { '晴': '🌤️', '风': '🌬️', '雨': '🌧️', '雾': '🌫️', '雷暴': '⛈️' }
// 浮岛在航线图上的坐标（左下→右上一条上升的航线）
const spots = [
  { x: 150, y: 480 }, { x: 320, y: 415 }, { x: 490, y: 350 },
  { x: 660, y: 290 }, { x: 828, y: 225 }, { x: 955, y: 170 }
]
const done = computed(() => store.state?.seasonDone || 0)
const total = computed(() => store.state?.seasonTotal || 6)
const circuits = computed(() => store.circuits)

const starting = ref(false)
// 玩家游艇巡航位置：沿航线移动到当前站
const playerPos = computed(() => {
  const idx = Math.min(done.value, total.value - 1)
  const p = spots[idx]
  return p
})
function fmt(c) { return '第 ' + c.rank + ' 名' }
async function go(cid) {
  if (starting.value) return
  starting.value = true
  const r = await store.race(cid)
  if (r.ok) { await store.refresh(); emit('race', r) }
  else store.tip(r.msg || '该站已完赛')
  starting.value = false
}
</script>

<template>
  <div class="mains">
    <div class="scene-box">
      <svg viewBox="0 0 1060 600" class="scene-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="island" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#6fd07a" /><stop offset=".6" stop-color="#3f9c5b" /><stop offset="1" stop-color="#3c7d52" />
          </linearGradient>
          <linearGradient id="rock" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#b98a5a" /><stop offset="1" stop-color="#8a5f37" />
          </linearGradient>
          <radialGradient id="cloudc" cx=".5" cy=".5" r=".5">
            <stop offset="0" stop-color="rgba(255,255,255,.9)" /><stop offset="1" stop-color="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        <!-- 云海 -->
        <g opacity=".95">
          <ellipse cx="90" cy="520" rx="260" ry="30" fill="url(#cloudc)" />
          <ellipse cx="330" cy="560" rx="330" ry="36" fill="url(#cloudc)" />
          <ellipse cx="700" cy="585" rx="360" ry="40" fill="url(#cloudc)" />
          <ellipse cx="1000" cy="540" rx="280" ry="34" fill="url(#cloudc)" />
        </g>
        <!-- 远景小云 -->
        <g opacity=".55">
          <circle cx="60" cy="130" r="26" fill="url(#cloudc)" /><circle cx="92" cy="138" r="20" fill="url(#cloudc)" />
          <circle cx="140" cy="90" r="18" fill="url(#cloudc)" />
          <circle cx="880" cy="70" r="22" fill="url(#cloudc)" /><circle cx="912" cy="78" r="16" fill="url(#cloudc)" />
        </g>

        <!-- 航线虚线 -->
        <polyline :points="spots.map(s => s.x + ',' + (s.y - 48)).join(' ')" fill="none" stroke="rgba(255,215,106,.55)" stroke-width="2.5" stroke-dasharray="7 9" stroke-linecap="round" />

        <!-- 6 座浮岛 -->
        <g v-for="(c, i) in circuits" :key="c.id">
          <g :transform="'translate(' + spots[i].x + ',' + spots[i].y + ')'">
            <!-- 浮岛基座 -->
            <ellipse cy="16" rx="34" ry="11" fill="rgba(0,0,40,.25)" />
            <path d="M-34 0 Q-30 -26 0 -30 Q30 -26 34 0 L30 16 Q0 22 -30 16 Z" fill="url(#rock)" />
            <path d="M-24 -10 Q-12 -34 8 -36 Q26 -32 24 -14 L-26 -18 Z" fill="url(#island)" />
            <rect x="-6" y="-24" width="12" height="15" rx="2" fill="#fff5d0" stroke="#d9a441" stroke-width="1.5" />
            <text y="27" text-anchor="middle" font-size="15" font-weight="800" fill="#fff">{{ i + 1 }}</text>

            <!-- 云端标签 -->
            <g :transform="'translate(0,-46)'">
              <rect x="-52" y="-13" width="104" height="26" rx="13" fill="rgba(20,22,58,.78)" stroke="rgba(255,215,106,.5)" />
              <text y="5" text-anchor="middle" font-size="12.5" font-weight="700" fill="#ffe9a8" dominant-baseline="middle">{{ c.name }}</text>
              <text :x="c.weather === '晴' ? 0 : -14" y="24" text-anchor="middle" font-size="12" fill="#9fc1ff">{{ wIco[c.weather] }} {{ c.weather }} · 难度{{ '★'.repeat(c.diff) }}</text>
              <!-- 完赛标记 -->
              <text v-if="c.finished" y="40" text-anchor="middle" font-size="13" font-weight="800" fill="#6fe7d0">✔ {{ fmt(c) }}</text>
            </g>
          </g>
        </g>

        <!-- 玩家游艇巡航 -->
        <g :transform="'translate(' + (playerPos.x - 56) + ',' + (playerPos.y - 110) + ')'">
          <ellipse cx="40" cy="66" rx="22" ry="6" fill="rgba(0,0,40,.35)" />
          <g class="drift">
            <ellipse cx="40" cy="52" rx="40" ry="14" fill="rgba(255,255,255,.4)" />
            <rect x="22" y="16" width="36" height="24" rx="9" fill="#ffcf5c" stroke="#fff" stroke-width="2" />
            <path d="M40 10 L32 26 L48 26 Z" fill="#ff9fb0" />
            <circle cx="40" cy="44" r="9" fill="#2b2a63" /><circle cx="40" cy="44" r="5" fill="#7ecbff" />
            <text x="61" y="26" font-size="11" font-weight="800" fill="#fff3c9">✈️</text>
          </g>
        </g>
      </svg>

      <!-- HTML 开赛按钮层：叠加在浮岛上方，任何点击方式均可命中 -->
      <button v-for="(c, i) in circuits" :key="'b' + c.id" v-show="!c.finished"
        class="start-btn" :disabled="starting"
        :style="{ left: (spots[i].x / 1060 * 100) + '%', top: ((spots[i].y - 8) / 600 * 100) + '%' }"
        @click="go(c.id)">🚀 开赛</button>
    </div>

    <!-- 赛季进度浮条 -->
    <div class="progress-hud">
      <div class="ph-label">赛季航线进度</div>
      <div class="ph-bar"><i :style="{ width: (done / total * 100) + '%' }"></i></div>
      <div class="ph-nums mono">{{ done }} / {{ total }} 站完赛</div>
    </div>
  </div>
</template>