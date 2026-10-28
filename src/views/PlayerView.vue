<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api/client'
import { useAuth } from '@/composables/useAuth'
import { useBusy, useLoader } from '@/composables/useBusy'
import { dateTime, num } from '@/composables/format'
import { useToast } from '@/composables/useToast'
import Modal from '@/components/Modal.vue'
import ReasonModal from '@/components/ReasonModal.vue'

interface Player {
  id: number
  telegramId: string
  username: string
  firstName: string
  lastName: string
  language: string
  isPremium: boolean
  coins: number
  stars: number
  totalCoinsEarned: number
  level: number
  miningLevel: number
  capacityLevel: number
  isBlocked: boolean
  blockReason: string
  holdWithdrawals: boolean
  holdRewards: boolean
  riskScore: number
  flags: unknown
  adminNote: string
  referredBy: number | null
  referralCounted: boolean
  inviteBonusCoins: number | null
  friendBonusCoins: number
  country: string
  lastIp: string
  botStarted: boolean
  botBlocked: boolean
  adsDisabled: boolean
  archived: boolean
  resetAt: string | null
  resetTelegramId: number | null
  createdAt: string
  lastSeenAt: string
}
interface Entry {
  id: number
  currency: string
  amount: number
  balanceAfter: number
  reason: string
  refType: string
  refId: string
  meta: unknown
  createdAt: string
}

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const toast = useToast()
const { busy, run } = useBusy()
const id = Number(route.params.id)

const { data: p, loading, error, load } = useLoader(() => api.get<Player>(`/admin/players/${id}`))
onMounted(load)

const canBlock = computed(() => auth.can('players.block'))
const canNote = computed(() => auth.can('players.note'))
const canBonus = computed(() => auth.can('players.inviteBonus'))
const canDelete = computed(() => auth.can('players.delete'))
const canLedger = computed(() => auth.can('ledger.read'))
const canManage = computed(() => auth.can('players.manage'))

const flags = computed(() => {
  const f = p.value?.flags
  if (Array.isArray(f)) return f as string[]
  if (f && typeof f === 'object') return Object.keys(f as object)
  return []
})

// ---- block
const blocking = ref(false)
async function block(reason: string) {
  if (await run(() => api.post(`/admin/players/${id}/block`, { reason }), 'Player blocked')) {
    blocking.value = false
    load(true)
  }
}
async function unblock() {
  if (await run(() => api.post(`/admin/players/${id}/unblock`), 'Player unblocked')) load(true)
}

// ---- holds and note
async function setHold(field: 'holdWithdrawals' | 'holdRewards', v: boolean) {
  if (await run(() => api.patch(`/admin/players/${id}/flags`, { [field]: v }), 'Saved')) load(true)
}
const note = ref('')
const noteTouched = ref(false)
async function saveNote() {
  if (await run(() => api.patch(`/admin/players/${id}/flags`, { note: note.value }), 'Note saved')) {
    noteTouched.value = false
    load(true)
  }
}
async function clearRisk() {
  if (await run(() => api.post(`/admin/players/${id}/risk/clear`), 'Risk cleared and holds lifted')) load(true)
}

// ---- invite bonus
const bonusOpen = ref(false)
const bonusValue = ref<number | null>(null)
async function saveBonus(useDefault: boolean) {
  const coins = useDefault ? null : bonusValue.value
  if (!useDefault && (coins === null || coins < 0)) return
  if (await run(() => api.put(`/admin/players/${id}/invite-bonus`, { coins }), 'Saved')) {
    bonusOpen.value = false
    load(true)
  }
}

// ---- balances
const balanceOpen = ref(false)
const balanceForm = ref({ coins: 0, stars: 0, reason: '' })
function openBalance() {
  balanceForm.value = { coins: p.value?.coins ?? 0, stars: p.value?.stars ?? 0, reason: '' }
  balanceOpen.value = true
}
const balanceError = computed(() => {
  const f = balanceForm.value
  if (![f.coins, f.stars].every((v) => Number.isInteger(v) && v >= 0)) return 'Coins and stars must be whole numbers, 0 or more.'
  if (f.coins === p.value?.coins && f.stars === p.value?.stars) return 'Nothing is changed.'
  if (f.reason.trim().length < 3) return 'Write the reason (at least 3 characters): it is saved in the money history.'
  return ''
})
async function saveBalance() {
  if (balanceError.value || !p.value) return
  const f = balanceForm.value
  const body: Record<string, unknown> = { reason: f.reason.trim() }
  if (f.coins !== p.value.coins) body.coins = f.coins
  if (f.stars !== p.value.stars) body.stars = f.stars
  if (await run(() => api.post(`/admin/players/${id}/adjust`, body), 'Balances saved')) {
    balanceOpen.value = false
    load(true)
    if (canLedger.value) loadLedger()
  }
}

// ---- ads
async function setAdsDisabled(off: boolean) {
  if (await run(() => api.patch(`/admin/players/${id}/flags`, { adsDisabled: off }), off ? 'Ads are off for this player' : 'Ads are on for this player')) load(true)
}

// ---- reset
const resetOpen = ref(false)
const resetReason = ref('')
const resetConfirm = ref('')
async function resetPlayer() {
  if (resetConfirm.value !== 'RESET' || resetReason.value.trim().length < 3) return
  if (await run(() => api.post(`/admin/players/${id}/reset`, { confirm: true, reason: resetReason.value.trim() }), 'Player reset. They start from zero the next time they open the game.')) {
    resetOpen.value = false
    resetConfirm.value = ''
    resetReason.value = ''
    load(true)
    if (canLedger.value) loadLedger()
  }
}

// ---- delete
const deleting = ref(false)
const confirmText = ref('')
async function deletePlayer() {
  if (await run(() => api.post(`/admin/players/${id}/delete`, { confirm: true }), 'Player data erased')) {
    router.replace('/players')
  }
}

// ---- ledger
const entries = ref<Entry[]>([])
const ledgerMore = ref(false)
const ledgerLoading = ref(false)
const currency = ref('')
async function loadLedger(append = false) {
  ledgerLoading.value = true
  try {
    const before = append && entries.value.length ? entries.value[entries.value.length - 1].id : 0
    const r = await api.get<{ entries: Entry[] }>(`/admin/players/${id}/ledger`, { before, limit: 50 })
    entries.value = append ? [...entries.value, ...r.entries] : r.entries
    ledgerMore.value = r.entries.length === 50
  } catch (e) {
    toast.error(e)
  } finally {
    ledgerLoading.value = false
  }
}
const shown = computed(() => entries.value.filter((e) => !currency.value || e.currency === currency.value))
onMounted(() => {
  if (canLedger.value) loadLedger()
})

function startNote() {
  if (!noteTouched.value) note.value = p.value?.adminNote ?? ''
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <button class="sm" @click="router.back()">← Back</button>
      <h1>{{ p ? (p.username ? '@' + p.username : p.firstName || 'Player') : 'Player' }} <span class="muted">#{{ id }}</span></h1>
      <span v-if="p?.isBlocked" class="badge bad">blocked</span>
      <span v-if="p?.holdWithdrawals" class="badge warn">withdrawals held</span>
      <span v-if="p?.holdRewards" class="badge warn">rewards held</span>
      <span v-if="p?.adsDisabled" class="badge info">ads off</span>
      <span v-if="p?.archived" class="badge bad">{{ p.resetAt ? 'archived (reset)' : 'erased' }}</span>
    </div>
    <p v-if="p?.archived && p.resetAt" class="hint">
      This player was reset on {{ dateTime(p.resetAt) }}. This is the old record, kept for the money history. The person starts again as a new player
      the next time they open the game (their Telegram id was <code>{{ p.resetTelegramId }}</code>); find the new record in Players by that id.
    </p>
    <p v-if="error" class="err">{{ error }}</p>
    <p v-if="loading && !p" class="muted">Loading…</p>

    <template v-if="p">
      <div class="grid c2 mb">
        <div class="card">
          <h2>Profile</h2>
          <dl class="kv">
            <dt>Telegram id</dt><dd><code>{{ p.telegramId }}</code></dd>
            <dt>Name</dt><dd>{{ [p.firstName, p.lastName].filter(Boolean).join(' ') || '—' }}</dd>
            <dt>Language</dt><dd>{{ p.language }} <span v-if="p.isPremium">· Premium</span></dd>
            <dt>Country / IP</dt><dd>{{ p.country || '—' }} · <code>{{ p.lastIp || '—' }}</code></dd>
            <dt>Joined</dt><dd>{{ dateTime(p.createdAt) }}</dd>
            <dt>Last seen</dt><dd>{{ dateTime(p.lastSeenAt) }}</dd>
            <dt>Bot</dt><dd>{{ p.botBlocked ? 'blocked the bot' : p.botStarted ? 'started' : 'never started' }}</dd>
            <dt>Invited by</dt>
            <dd>
              <a v-if="p.referredBy" href="#" @click.prevent="router.push(`/players/${p.referredBy}`)">#{{ p.referredBy }}</a>
              <span v-else>—</span>
              <span v-if="p.referredBy" class="muted"> · {{ p.referralCounted ? 'counted (reached level 2)' : 'not counted yet' }}</span>
            </dd>
          </dl>
        </div>

        <div class="card">
          <h2>Game</h2>
          <dl class="kv">
            <dt>Coins</dt>
            <dd>
              <b>{{ num(p.coins) }}</b>
              <button v-if="canManage && !p.archived" class="sm" style="margin-left: 8px" @click="openBalance">Edit coins and stars</button>
            </dd>
            <dt>Stars</dt><dd><b>{{ num(p.stars) }}</b></dd>
            <dt>Coins earned in total</dt><dd>{{ num(p.totalCoinsEarned) }}</dd>
            <dt>Level</dt><dd>{{ p.level }} <span class="muted">(rate card {{ p.miningLevel }}, capacity card {{ p.capacityLevel }})</span></dd>
            <dt>Friend bonus earned</dt><dd>{{ num(p.friendBonusCoins) }} coins</dd>
            <dt>Join bonus for friends</dt>
            <dd>
              {{ p.inviteBonusCoins === null ? 'default' : num(p.inviteBonusCoins) + ' coins' }}
              <button v-if="canBonus" class="sm" @click="((bonusOpen = true), (bonusValue = p.inviteBonusCoins ?? 0))">Change</button>
            </dd>
            <dt>Risk score</dt>
            <dd>
              <b :class="p.riskScore >= 50 ? 'err' : ''">{{ p.riskScore }}</b>
              <span v-for="f in flags" :key="f" class="badge warn" style="margin-left: 6px">{{ f }}</span>
            </dd>
          </dl>
        </div>
      </div>

      <div class="card mb">
        <h2>Control</h2>
        <div class="row">
          <template v-if="canBlock">
            <button v-if="!p.isBlocked" class="danger" :disabled="busy" @click="blocking = true">Block player</button>
            <button v-else :disabled="busy" @click="unblock">Unblock</button>
            <button v-if="p.riskScore > 0 || p.holdWithdrawals || p.holdRewards" :disabled="busy" @click="clearRisk">Clear risk and lift holds</button>
            <label class="row"><input type="checkbox" :checked="p.holdWithdrawals" :disabled="busy" @change="setHold('holdWithdrawals', ($event.target as HTMLInputElement).checked)" /> Hold withdrawals</label>
            <label class="row"><input type="checkbox" :checked="p.holdRewards" :disabled="busy" @change="setHold('holdRewards', ($event.target as HTMLInputElement).checked)" /> Hold rewards</label>
          </template>
          <span class="grow" />
          <button v-if="canDelete" class="danger" :disabled="busy" @click="deleting = true">Erase personal data…</button>
        </div>
        <div v-if="canManage && !p.archived" class="row" style="margin-top: 12px">
          <label class="row">
            <input type="checkbox" :checked="p.adsDisabled" :disabled="busy" @change="setAdsDisabled(($event.target as HTMLInputElement).checked)" />
            No ads for this player (every action works without watching an ad)
          </label>
          <span class="grow" />
          <button class="danger" :disabled="busy" @click="resetOpen = true">Reset player…</button>
        </div>
        <p v-if="p.isBlocked" class="err" style="margin-bottom: 0">Blocked: {{ p.blockReason || 'no reason given' }}</p>

        <h3 class="mt">Internal note (never shown to the player)</h3>
        <textarea v-model="note" :disabled="!canNote" placeholder="Write a note for the team" @focus="startNote" @input="noteTouched = true" />
        <div v-if="canNote" class="row" style="margin-top: 8px"><button class="primary" :disabled="busy || !noteTouched" @click="saveNote">Save note</button></div>
        <p v-if="!noteTouched && p.adminNote" class="hint" style="white-space: pre-wrap">Current note: {{ p.adminNote }}</p>
      </div>

      <div v-if="canLedger" class="card flush">
        <div class="row" style="padding: 14px 18px">
          <h2 style="margin: 0">Money history</h2>
          <span class="grow" />
          <select v-model="currency">
            <option value="">Coins and stars</option>
            <option value="COIN">Coins</option>
            <option value="STAR">Stars</option>
          </select>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Currency</th><th class="right">Change</th><th class="right">Balance after</th><th>Reason</th><th>Reference</th></tr></thead>
            <tbody>
              <tr v-for="e in shown" :key="e.id">
                <td class="nowrap">{{ dateTime(e.createdAt) }}</td>
                <td>{{ e.currency }}</td>
                <td class="right"><b :style="{ color: e.amount < 0 ? 'var(--bad)' : 'var(--ok)' }">{{ e.amount > 0 ? '+' : '' }}{{ num(e.amount) }}</b></td>
                <td class="right">{{ num(e.balanceAfter) }}</td>
                <td>{{ e.reason }}</td>
                <td class="muted">{{ e.refType }} {{ e.refId }}</td>
              </tr>
              <tr v-if="!shown.length && !ledgerLoading"><td colspan="6" class="empty">No entries.</td></tr>
            </tbody>
          </table>
        </div>
        <div v-if="ledgerMore" class="pager"><button :disabled="ledgerLoading" @click="loadLedger(true)">Load more</button></div>
      </div>
    </template>

    <ReasonModal v-if="blocking" title="Block this player" text="They cannot play or withdraw until you unblock them." confirm-text="Block" danger :min-length="0" label="Reason (optional)" :busy="busy" @confirm="block" @close="blocking = false" />

    <Modal v-if="bonusOpen" title="Join bonus for friends of this player" @close="bonusOpen = false">
      <p class="muted" style="margin-top: 0">Coins a new friend of this player receives. Leave the default to use the global setting.</p>
      <label class="field">Coins<input v-model.number="bonusValue" type="number" min="0" /></label>
      <div class="actions">
        <button @click="saveBonus(true)">Use the default</button>
        <button class="primary" :disabled="busy || bonusValue === null || bonusValue < 0" @click="saveBonus(false)">Save</button>
      </div>
    </Modal>

    <Modal v-if="balanceOpen" title="Edit coins and stars" @close="balanceOpen = false">
      <p class="muted" style="margin-top: 0">
        Type the amounts the player should have <b>now</b>. The difference is written to the money history as an admin correction with your reason.
      </p>
      <div class="col">
        <label class="field">Coins<input v-model.number="balanceForm.coins" type="number" min="0" step="1" /></label>
        <label class="field">Stars<input v-model.number="balanceForm.stars" type="number" min="0" step="1" /></label>
        <label class="field">Reason (saved in the history)<input v-model="balanceForm.reason" maxlength="200" placeholder="for example: compensation for a bug" /></label>
      </div>
      <p v-if="balanceError" class="hint">{{ balanceError }}</p>
      <div class="actions">
        <button @click="balanceOpen = false">Cancel</button>
        <button class="primary" :disabled="busy || !!balanceError" @click="saveBalance">Save</button>
      </div>
    </Modal>

    <Modal v-if="resetOpen" title="Reset this player" @close="resetOpen = false">
      <p style="margin-top: 0">
        The player starts again from zero: level 1, no coins, no stars, no cards, boosters, tasks, gifts or streaks. This old record is archived with its whole money
        history (the coins and stars it still had are taken off through the money history). The person becomes a new player the next time they open the game.
      </p>
      <ul class="hint">
        <li>Friends and the inviter are <b>not</b> carried over: the new player has no inviter.</li>
        <li>It is refused while the player has a withdrawal, a gift claim or a top-up that is not finished, or while they are blocked.</li>
        <li><b>This cannot be undone.</b></li>
      </ul>
      <div class="col">
        <label class="field">Reason (saved in the history)<input v-model="resetReason" maxlength="200" /></label>
        <label class="field">Type <code>RESET</code> to confirm<input v-model="resetConfirm" /></label>
      </div>
      <div class="actions">
        <button @click="resetOpen = false">Cancel</button>
        <button class="danger" :disabled="busy || resetConfirm !== 'RESET' || resetReason.trim().length < 3" @click="resetPlayer">Reset</button>
      </div>
    </Modal>

    <Modal v-if="deleting" title="Erase this player's personal data" @close="deleting = false">
      <p style="margin-top: 0">
        Name, username, address and notes are removed and the account cannot be used again. The money history stays (anonymised) so the books still balance.
        <b>This cannot be undone.</b>
      </p>
      <label class="field">Type <code>DELETE</code> to confirm<input v-model="confirmText" /></label>
      <div class="actions">
        <button @click="deleting = false">Cancel</button>
        <button class="danger" :disabled="busy || confirmText !== 'DELETE'" @click="deletePlayer">Erase</button>
      </div>
    </Modal>
  </div>
</template>
