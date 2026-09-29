<script setup>
import { ref } from 'vue'
import { useSkyStore } from '@/store/sky'
import MainScene from '@/components/MainScene.vue'
import RaceAnim from '@/components/RaceAnim.vue'
import HangarDrawer from '@/components/HangarDrawer.vue'
import TrophyDrawer from '@/components/TrophyDrawer.vue'

const store = useSkyStore()
store.init()

const drawer = ref('')            // '' | 'hangar' | 'trophy'
const raceResult = ref(null)      // 竞速结果，显式传给 RaceAnim

function onRace(r) { raceResult.value = r }
function goBack() { raceResult.value = null }
function openHangar() { drawer.value = drawer.value === 'hangar' ? '' : 'hangar' }
function openTrophy() { drawer.value = drawer.value === 'trophy' ? '' : 'trophy' }
</script>

<template>
  <div class="game">
    <div v-if="store.toast" class="toast">✨ {{ store.toast }}</div>

    <!-- 顶栏状态条 -->
    <header class="topbar">
      <div class="brand">
        <div class="logo">🛸</div>
        <div class="t">天空之城<small>AIRWAVE RACING · S{{ store.team.season }}</small></div>
      </div>
      <div class="stat-chips">
        <span class="chipx"><b class="ic">🪙</b> ¥{{ store.team.money?.toLocaleString() }}</span>
        <span class="chipx"><b class="ic">✨</b> 声望 {{ store.team.rep }}</span>
        <span class="chipx gold"><b class="ic">🏅</b> 积分 {{ store.team.season_pts }}</span>
        <span class="chipx"><b class="ic">🗼</b> {{ store.state ? store.state.seasonDone + ' / ' + store.state.seasonTotal + ' 站' : '' }}</span>
      </div>
    </header>

    <!-- 主游戏场景：云海浮岛航线图 -->
    <MainScene class="scene" @race="onRace" />

    <!-- 竞速镜头 -->
    <RaceAnim v-if="raceResult" :result="raceResult" @back="goBack" />

    <!-- 右下操作钮 -->
    <div class="fab-col">
      <button class="fab" :class="{ on: drawer === 'trophy' }" @click="openTrophy">🏆<span>赛季之巅</span></button>
      <button class="fab" :class="{ on: drawer === 'hangar' }" @click="openHangar">✈️<span>机库</span></button>
    </div>

    <!-- 抽屉 -->
    <transition name="slide">
      <div v-if="drawer === 'hangar'"><HangarDrawer @close="drawer = ''" /></div>
    </transition>
    <transition name="slide">
      <div v-if="drawer === 'trophy'"><TrophyDrawer @close="drawer = ''" /></div>
    </transition>
  </div>
</template>