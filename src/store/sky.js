import { defineStore } from 'pinia'

const j = (p, o) => fetch(p, o).then(r => r.json())
const post = (p, b) => j(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })

export const useSkyStore = defineStore('sky', {
  state: () => ({ state: null, loaded: false, toast: '' }),
  getters: {
    team: s => s.state?.team || {},
    airship: s => s.state?.airship || {},
    circuits: s => s.state?.circuits || [],
    upgrades: s => s.state?.upgrades || []
  },
  actions: {
    async init() { this.state = await j('/api/state'); this.loaded = true },
    async refresh() { this.state = await j('/api/state') },
    tip(msg) { this.toast = msg; setTimeout(() => this.toast = '', 2600) },
    async shop(b) { const r = await post('/api/shop', b); await this.refresh(); if (!r.ok) this.tip(r.msg); return r },
    async equip(id) { await post('/api/equip/' + id); await this.refresh() },
    async unequip(id) { await post('/api/unequip/' + id); await this.refresh() },
    async hirePilot() { const r = await post('/api/hire_pilot'); await this.refresh(); if (!r.ok) this.tip(r.msg); else this.tip(r.msg) },
    async hireMech() { const r = await post('/api/hire_mech'); await this.refresh(); if (!r.ok) this.tip(r.msg); else this.tip(r.msg) },
    async train(id) { const r = await post('/api/train', { id }); await this.refresh(); if (!r.ok) this.tip(r.msg); else this.tip(r.msg) },
    async maintain() { const r = await post('/api/maintain'); await this.refresh(); if (!r.ok) this.tip(r.msg); else this.tip('维护完成，耗资 ' + r.cost) },
    async race(cid) { return await post('/api/race/' + cid) },
    async reset() { await post('/api/reset'); await this.init() }
  }
})