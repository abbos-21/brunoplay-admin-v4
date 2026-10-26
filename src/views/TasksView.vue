<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { api } from '@/api/client'
import { useAuth } from '@/composables/useAuth'
import { useBusy, useLoader } from '@/composables/useBusy'
import { dateTime, num, toLocalInput } from '@/composables/format'
import Modal from '@/components/Modal.vue'

interface Task {
  id: number
  category: 'MAIN' | 'OTHER'
  type: 'CHANNEL_JOIN' | 'INVITE_FRIENDS' | 'OPEN_LINK' | 'WATCH_ADS'
  titleEn?: string
  titleRu?: string
  descEn?: string
  descRu?: string
  url: string
  channelUsername: string
  required: number
  rewardCoins: number
  rewardStars: number
  repeat: 'ONCE' | 'DAILY' | 'WEEKLY'
  startsAt?: string | null
  endsAt: string | null
  isActive: boolean
  sortOrder: number
  completedCount: number
}
interface Form {
  category: string
  type: string
  titleEn: string
  titleRu: string
  descEn: string
  descRu: string
  url: string
  channelUsername: string
  required: number
  rewardCoins: number
  rewardStars: number
  repeat: string
  startsAt: string
  endsAt: string
  isActive: boolean
  sortOrder: number
}

const auth = useAuth()
const { busy, run } = useBusy()
const { data, loading, error, load } = useLoader(() => api.get<{ tasks: Task[] | null }>('/admin/tasks'))
onMounted(load)
const tasks = computed(() => data.value?.tasks ?? [])
const canWrite = computed(() => auth.can('tasks.write'))

const TYPE_LABEL: Record<string, string> = {
  CHANNEL_JOIN: 'Join a channel',
  INVITE_FRIENDS: 'Invite friends',
  OPEN_LINK: 'Open a link',
  WATCH_ADS: 'Watch ads',
}

const empty = (): Form => ({
  category: 'MAIN', type: 'OPEN_LINK', titleEn: '', titleRu: '', descEn: '', descRu: '', url: '', channelUsername: '',
  required: 1, rewardCoins: 0, rewardStars: 0, repeat: 'ONCE', startsAt: '', endsAt: '', isActive: true, sortOrder: 0,
})
const editing = ref<number | 'new' | null>(null)
const form = reactive<Form>(empty())
const formError = ref('')

function openNew() {
  Object.assign(form, empty())
  formError.value = ''
  editing.value = 'new'
}
function openEdit(t: Task) {
  Object.assign(form, {
    category: t.category, type: t.type, titleEn: t.titleEn ?? '', titleRu: t.titleRu ?? '', descEn: t.descEn ?? '', descRu: t.descRu ?? '',
    url: t.url, channelUsername: t.channelUsername, required: t.required, rewardCoins: t.rewardCoins, rewardStars: t.rewardStars,
    repeat: t.repeat, startsAt: t.startsAt ? toLocalInput(t.startsAt) : '', endsAt: t.endsAt ? toLocalInput(t.endsAt) : '',
    isActive: t.isActive, sortOrder: t.sortOrder,
  })
  formError.value = ''
  editing.value = t.id
}

async function save() {
  formError.value = ''
  if (!form.titleEn.trim() || !form.titleRu.trim()) return (formError.value = 'The title is required in both languages.')
  if (form.type === 'CHANNEL_JOIN' && !form.channelUsername.trim()) return (formError.value = 'Enter the channel username (the bot must be an admin there).')
  if ((form.type === 'OPEN_LINK' || form.type === 'CHANNEL_JOIN') && !form.url.trim()) return (formError.value = 'Enter the link.')
  if (!Number(form.rewardCoins) && !Number(form.rewardStars)) return (formError.value = 'Give a reward in coins or stars.')
  const body = {
    ...form,
    required: Number(form.required) || 1,
    rewardCoins: Number(form.rewardCoins) || 0,
    rewardStars: Number(form.rewardStars) || 0,
    sortOrder: Number(form.sortOrder) || 0,
    startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
    endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
  }
  const ok = await run(
    () => (editing.value === 'new' ? api.post('/admin/tasks', body) : api.put(`/admin/tasks/${editing.value}`, body)),
    editing.value === 'new' ? 'Task created' : 'Task saved',
  )
  if (ok) {
    editing.value = null
    load(true)
  }
}

async function toggle(t: Task) {
  await run(
    () => api.put(`/admin/tasks/${t.id}`, {
      category: t.category, type: t.type, titleEn: t.titleEn, titleRu: t.titleRu, descEn: t.descEn ?? '', descRu: t.descRu ?? '', url: t.url,
      channelUsername: t.channelUsername, required: t.required, rewardCoins: t.rewardCoins, rewardStars: t.rewardStars, repeat: t.repeat,
      startsAt: t.startsAt ?? null, endsAt: t.endsAt, isActive: !t.isActive, sortOrder: t.sortOrder,
    }),
    t.isActive ? 'Task hidden' : 'Task shown',
  )
  load(true)
}

const deleting = ref<Task | null>(null)
async function remove() {
  const t = deleting.value
  if (!t) return
  if (await run(() => api.del(`/admin/tasks/${t.id}`), 'Task deleted')) {
    deleting.value = null
    load(true)
  }
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Tasks</h1>
      <span class="grow" />
      <button v-if="canWrite" class="primary" @click="openNew">+ New task</button>
    </div>
    <p class="hint">
      Players see MAIN tasks first. A new active task is announced to everyone the bot can reach (once). Deleting a task also erases its progress records (rewards already paid stay in the ledger); to keep the history, hide the task instead.
    </p>
    <p v-if="error" class="err">{{ error }}</p>

    <div class="card flush">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Order</th><th>Task</th><th>Type</th><th class="right">Reward</th><th>Repeat</th><th class="right">Done by</th><th>Shown</th><th>Ends</th><th /></tr></thead>
          <tbody>
            <tr v-for="t in tasks" :key="t.id" :style="{ opacity: t.isActive ? 1 : 0.55 }">
              <td>{{ t.sortOrder }}</td>
              <td>
                <b>{{ t.titleEn }}</b><span class="badge" style="margin-left: 6px">{{ t.category }}</span>
                <div class="hint">{{ t.titleRu }}</div>
              </td>
              <td>{{ TYPE_LABEL[t.type] }}<span v-if="t.required > 1" class="muted"> × {{ t.required }}</span></td>
              <td class="right">
                <span v-if="t.rewardCoins">{{ num(t.rewardCoins) }} 🪙</span>
                <span v-if="t.rewardStars"> {{ num(t.rewardStars) }} ⭐</span>
              </td>
              <td>{{ t.repeat }}</td>
              <td class="right">{{ num(t.completedCount) }}</td>
              <td><span class="badge" :class="t.isActive ? 'ok' : ''">{{ t.isActive ? 'yes' : 'hidden' }}</span></td>
              <td class="nowrap">{{ t.endsAt ? dateTime(t.endsAt) : '—' }}</td>
              <td class="nowrap right">
                <template v-if="canWrite">
                  <button class="sm" :disabled="busy" @click="openEdit(t)">Edit</button>
                  <button class="sm" :disabled="busy" @click="toggle(t)">{{ t.isActive ? 'Hide' : 'Show' }}</button>
                  <button class="sm danger" :disabled="busy" @click="deleting = t">Delete</button>
                </template>
              </td>
            </tr>
            <tr v-if="!tasks.length && !loading"><td colspan="9" class="empty">No tasks yet.</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <Modal v-if="editing !== null" :title="editing === 'new' ? 'New task' : 'Edit task'" wide @close="editing = null">
      <div class="grid c2">
        <label class="field">Category
          <select v-model="form.category"><option value="MAIN">MAIN (top of the list)</option><option value="OTHER">OTHER</option></select>
        </label>
        <label class="field">Type
          <select v-model="form.type"><option v-for="(l, k) in TYPE_LABEL" :key="k" :value="k">{{ l }}</option></select>
        </label>
        <label class="field">Title (English)<input v-model="form.titleEn" maxlength="200" /></label>
        <label class="field">Title (Russian)<input v-model="form.titleRu" maxlength="200" /></label>
        <label class="field">Description (English)<textarea v-model="form.descEn" maxlength="500" /></label>
        <label class="field">Description (Russian)<textarea v-model="form.descRu" maxlength="500" /></label>
        <label v-if="form.type === 'CHANNEL_JOIN'" class="field">Channel username (without @)
          <input v-model="form.channelUsername" placeholder="brunoplay_news" />
          <span class="hint">The bot must be an administrator of the channel to verify membership.</span>
        </label>
        <label v-if="form.type === 'CHANNEL_JOIN' || form.type === 'OPEN_LINK'" class="field">Link<input v-model="form.url" placeholder="https://t.me/…" /></label>
        <label v-if="form.type === 'INVITE_FRIENDS' || form.type === 'WATCH_ADS'" class="field">
          {{ form.type === 'INVITE_FRIENDS' ? 'Friends to invite' : 'Ads to watch' }}
          <input v-model.number="form.required" type="number" min="1" max="1000" />
        </label>
        <label class="field">Reward: coins<input v-model.number="form.rewardCoins" type="number" min="0" /></label>
        <label class="field">Reward: stars<input v-model.number="form.rewardStars" type="number" min="0" /></label>
        <label class="field">Repeat
          <select v-model="form.repeat"><option value="ONCE">Once</option><option value="DAILY">Every day</option><option value="WEEKLY">Every week</option></select>
        </label>
        <label class="field">Sort order (smaller first)<input v-model.number="form.sortOrder" type="number" /></label>
        <label class="field">Starts (your local time, optional)<input v-model="form.startsAt" type="datetime-local" /></label>
        <label class="field">Ends (optional)<input v-model="form.endsAt" type="datetime-local" /></label>
      </div>
      <label class="row" style="margin-top: 12px"><input v-model="form.isActive" type="checkbox" /> Visible to players</label>
      <p v-if="formError" class="err">{{ formError }}</p>
      <div class="actions">
        <button @click="editing = null">Cancel</button>
        <button class="primary" :disabled="busy" @click="save">Save</button>
      </div>
    </Modal>

    <Modal v-if="deleting" title="Delete this task?" @close="deleting = null">
      <p style="margin-top: 0">“{{ deleting.titleEn }}” disappears for everyone together with its progress records. Rewards already paid are not taken back.</p>
      <div class="actions">
        <button @click="deleting = null">Cancel</button>
        <button class="danger" :disabled="busy" @click="remove">Delete</button>
      </div>
    </Modal>
  </div>
</template>
