<script setup>
import { useSkyStore } from '@/store/sky'
const store = useSkyStore()
const emit = defineEmits(['close'])
const slotIco = { '引擎': '🔩', '翼板': '🦅', '氮气': '💨', '龙骨': '⛓️', '护甲': '🛡️' }
const statName = { speed: '速度', turn: '转向', acc: '加速', dur: '耐久' }
const perfList = () => [
  ['speed', '速度'], ['turn', '转向'], ['acc', '加速'], ['dur', '耐久']
].map(([k, l]) => ({ k, l, v: store.airship[k] || 0 }))
</script>

<template>
  <div class="drawer-mask" @click.self="emit('close')">
    <aside class="drawer">
      <header class="d-h">
        <div><h3>✈️ 机库 Hangar</h3><div class="d-sub">改装你的飞艇，招募机师技工</div></div>
        <button class="d-x" @click="emit('close')">✕</button>
      </header>

      <div class="d-body">
        <!-- 飞艇主展示 -->
        <div class="airship-card">
          <div class="air-top">
            <div class="air-icon">🛸</div>
            <div>
              <b>{{ store.airship.name }}</b>
              <div class="air-tag tag b">主力飞艇</div>
            </div>
            <div class="air-health">
              <div class="ah-label">部件健康 <span class="mono" :class="{ low: store.airship.parts_dur < 40 }">{{ store.airship.parts_dur }}%</span></div>
              <div class="hbar"><i :style="{ width: store.airship.parts_dur + '%', background: store.airship.parts_dur < 40 ? 'linear-gradient(90deg,var(--rose),var(--gold2))' : 'linear-gradient(90deg,var(--mint),var(--sky))' }"></i></div>
            </div>
          </div>
          <div class="perf-grid">
            <div v-for="p in perfList()" :key="p.k" class="perf">
              <span class="pl">{{ p.l }}</span>
              <div class="hbar"><i :style="{ width: Math.min(100, p.v) + '%' }"></i></div>
              <b class="mono">{{ p.v }}</b>
            </div>
          </div>
          <button class="btn mint w-full" @click="store.maintain()">🔧 维护部件</button>
        </div>

        <!-- 改装件道具 -->
        <section>
          <div class="sec-h">
            <b>🧩 改装件</b><span class="d-sub">点击装备 / 卸下</span>
          </div>
          <div class="up-grid">
            <div v-for="u in store.upgrades" :key="u.id" class="up-card" :class="{ eq: u.equipped }">
              <div class="up-ico">{{ slotIco[u.slot] }}</div>
              <div class="up-name">{{ u.name }}</div>
              <div class="up-stat">+{{ u.bonus }} {{ statName[u.stat] }}</div>
              <button class="btn sm" :class="u.equipped ? 'ghost' : 'primary'" @click="u.equipped ? store.unequip(u.id) : store.equip(u.id)">
                {{ u.equipped ? '卸下' : '装备' }}
              </button>
            </div>
          </div>
        </section>

        <!-- 机师 -->
        <section>
          <div class="sec-h">
            <b>🧑‍✈️ 机师</b>
            <button class="btn ghost sm" @click="store.hirePilot()">＋ 招募 ¥1500</button>
          </div>
          <div class="crew-list">
            <div v-for="p in store.state?.pilots || []" :key="p.id" class="crew-row">
              <div class="crew-ava" :style="{ background: 'linear-gradient(135deg,var(--gold2),var(--violet))' }">{{ p.name[0] }}</div>
              <div class="crew-m">
                <div class="cm-name">{{ p.name }}<span class="tag b sm-tag">技巧{{ p.skill }}</span></div>
                <div class="cm-sub">胆识 {{ p.courage }} · 经验 {{ p.exp }} · 心情 {{ p.mood }}</div>
              </div>
              <button class="btn ghost sm" @click="store.train(p.id)">🎓</button>
            </div>
          </div>
        </section>

        <!-- 技工 -->
        <section>
          <div class="sec-h">
            <b>🔧 技工</b>
            <button class="btn ghost sm" @click="store.hireMech()">＋ 招募 ¥1000</button>
          </div>
          <div class="crew-list">
            <div v-for="m in store.state?.mechanics || []" :key="m.id" class="crew-row">
              <div class="crew-ava" style="background:linear-gradient(135deg,var(--mint),var(--sky))">{{ m.name[0] }}</div>
              <div class="crew-m">
                <div class="cm-name">{{ m.name }}<span class="tag m sm-tag">技能{{ m.skill }}</span></div>
                <div class="cm-sub">心情 {{ m.mood }}</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </aside>
  </div>
</template>