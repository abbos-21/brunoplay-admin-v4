<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { API_BASE, api } from '@/api/client'
import { useAuth } from '@/composables/useAuth'
import { useBusy, useLoader } from '@/composables/useBusy'
import { num } from '@/composables/format'
import { useToast } from '@/composables/useToast'
import Modal from '@/components/Modal.vue'

interface Gift { key: string; name_en: string; name_ru: string; star_value: number; imageV: number }

const auth = useAuth()
const toast = useToast()
const { busy, run } = useBusy()
const canWrite = computed(() => auth.can('settings.write.games'))

const catalog = useLoader(() => api.get<{ gifts: Gift[] | null; imageMaxKB: number }>('/admin/gifts/catalog'))
onMounted(() => catalog.load())
const gifts = computed(() => catalog.data.value?.gifts ?? [])
const maxKB = computed(() => catalog.data.value?.imageMaxKB ?? 400)

const imageUrl = (g: Gift) => `${API_BASE}/gift-images/${encodeURIComponent(g.key)}?v=${g.imageV}`

// ---- add / edit
const editing = ref(false)
const isNew = ref(false)
const form = ref({ key: '', nameEn: '', nameRu: '', starValue: 100 })
const picture = ref('') // a picture chosen now (data: address, also used as the preview)
const hadPicture = ref(false) // the gift has a saved picture
const removePicture = ref(false)
const fileError = ref('')

function openNew() {
  isNew.value = true
  form.value = { key: '', nameEn: '', nameRu: '', starValue: 100 }
  picture.value = ''
  hadPicture.value = false
  removePicture.value = false
  fileError.value = ''
  editing.value = true
}
function openEdit(g: Gift) {
  isNew.value = false
  form.value = { key: g.key, nameEn: g.name_en, nameRu: g.name_ru, starValue: g.star_value }
  picture.value = ''
  hadPicture.value = g.imageV > 0
  removePicture.value = false
  fileError.value = ''
  editing.value = true
}

function pick(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  fileError.value = ''
  if (!f) return
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(f.type)) {
    fileError.value = 'Use a PNG, JPEG, WebP or GIF picture.'
    return
  }
  if (f.size > maxKB.value * 1024) {
    fileError.value = `The picture is ${Math.ceil(f.size / 1024)} KB; the limit is ${maxKB.value} KB. Make it smaller (for example 512 x 512 pixels).`
    return
  }
  const r = new FileReader()
  r.onload = () => {
    picture.value = String(r.result)
    removePicture.value = false
  }
  r.readAsDataURL(f)
}

const keyOk = computed(() => /^[a-z0-9][a-z0-9_-]{0,31}$/.test(form.value.key))
const formError = computed(() => {
  const f = form.value
  if (isNew.value) {
    if (!keyOk.value) return 'The key is 1-32 characters: lowercase letters, digits, - or _ (for example: heart).'
    if (gifts.value.some((g) => g.key === f.key)) return 'This key is already used.'
  }
  if (!f.nameEn.trim()) return 'Write the English name.'
  if (!Number.isInteger(f.starValue) || f.starValue < 1) return 'The value in stars must be a whole number, 1 or more.'
  return ''
})

const asRow = (g: Gift) => ({ key: g.key, name_en: g.name_en, name_ru: g.name_ru, star_value: g.star_value })

async function saveCatalog(list: { key: string; name_en: string; name_ru: string; star_value: number }[]) {
  await api.put('/admin/gifts/catalog', { gifts: list })
}

async function save() {
  if (formError.value) return
  const f = form.value
  const row = { key: f.key, name_en: f.nameEn.trim(), name_ru: f.nameRu.trim(), star_value: f.starValue }
  const list = isNew.value ? [...gifts.value.map(asRow), row] : gifts.value.map((g) => (g.key === f.key ? row : asRow(g)))
  const ok = await run(async () => {
    await saveCatalog(list)
    if (picture.value) await api.put(`/admin/gifts/catalog/${encodeURIComponent(f.key)}/image`, { data: picture.value })
    else if (removePicture.value && hadPicture.value) await api.del(`/admin/gifts/catalog/${encodeURIComponent(f.key)}/image`)
    return true
  }, 'Saved')
  if (ok) {
    editing.value = false
    catalog.load(true)
  } else {
    // the list may have been saved before the picture failed: show the truth
    catalog.load(true)
  }
}

async function remove(g: Gift) {
  if (!window.confirm(`Remove the gift "${g.name_en}" (${g.key}) from the catalog? Its picture is deleted too.`)) return
  if (await run(() => saveCatalog(gifts.value.filter((x) => x.key !== g.key).map(asRow)), 'Gift removed')) catalog.load(true)
}

function copyKey(k: string) {
  navigator.clipboard?.writeText(k).then(() => toast.ok('Key copied'), () => toast.ok(k))
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Gift catalog</h1>
      <span class="grow" />
      <button @click="catalog.load()">Refresh</button>
      <button v-if="canWrite" class="primary" @click="openNew">+ Add a gift</button>
    </div>
    <p class="hint">
      The gifts players can win. The <b>key</b> is what the wheel odds and the chest pool use (for example <code>heart</code> or <code>"gift":"heart"</code>);
      it cannot be changed later. A gift without a picture shows the artwork that comes with the app. After adding a gift, put it into the odds
      (Settings → <code>spin.odds</code>) or the chest pool (<code>chest.pool</code>), otherwise nobody can win it.
    </p>

    <div class="card flush">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Picture</th><th>Key</th><th>English</th><th>Russian</th><th class="right">Value (⭐)</th><th /></tr></thead>
          <tbody>
            <tr v-for="g in gifts" :key="g.key">
              <td style="width: 76px">
                <img v-if="g.imageV" :src="imageUrl(g)" alt="" style="height: 56px; width: 56px; object-fit: contain" />
                <span v-else class="muted">app art</span>
              </td>
              <td><code>{{ g.key }}</code> <button class="sm ghost" @click="copyKey(g.key)">Copy</button></td>
              <td><b>{{ g.name_en }}</b></td>
              <td>{{ g.name_ru }}</td>
              <td class="right">{{ num(g.star_value) }}</td>
              <td class="nowrap right">
                <template v-if="canWrite">
                  <button class="sm" :disabled="busy" @click="openEdit(g)">Edit</button>
                  <button class="sm danger" :disabled="busy" @click="remove(g)">Remove</button>
                </template>
              </td>
            </tr>
            <tr v-if="!gifts.length && !catalog.loading.value"><td colspan="6" class="empty">No gifts yet.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <p v-if="catalog.error.value" class="err">{{ catalog.error.value }}</p>

    <Modal v-if="editing" :title="isNew ? 'Add a gift' : `Edit ${form.key}`" @close="editing = false">
      <div class="col">
        <label class="field">Key (cannot be changed later)<input v-model.trim="form.key" :disabled="!isNew" maxlength="32" placeholder="heart" /></label>
        <label class="field">Name (English)<input v-model="form.nameEn" maxlength="60" /></label>
        <label class="field">Name (Russian)<input v-model="form.nameRu" maxlength="60" /></label>
        <label class="field">Value in stars (what a player gets when selling it)<input v-model.number="form.starValue" type="number" min="1" step="1" /></label>

        <div class="field">
          Picture
          <div class="row" style="align-items: center; gap: 12px">
            <img v-if="picture" :src="picture" alt="" style="height: 72px; width: 72px; object-fit: contain" />
            <img v-else-if="hadPicture && !removePicture" :src="`${API_BASE}/gift-images/${encodeURIComponent(form.key)}?v=${gifts.find((g) => g.key === form.key)?.imageV ?? 0}`" alt="" style="height: 72px; width: 72px; object-fit: contain" />
            <span v-else class="muted">No picture: the app's own art is used.</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" @change="pick" />
          </div>
          <label v-if="hadPicture && !picture" class="row" style="margin-top: 6px"><input v-model="removePicture" type="checkbox" /> Remove the saved picture</label>
          <span class="hint">PNG, JPEG, WebP or GIF, up to {{ maxKB }} KB. A square picture with a transparent background looks best (about 512 x 512 pixels).</span>
          <span v-if="fileError" class="err">{{ fileError }}</span>
        </div>
      </div>
      <p v-if="formError" class="err">{{ formError }}</p>
      <div class="actions">
        <button @click="editing = false">Cancel</button>
        <button class="primary" :disabled="busy || !!formError" @click="save">Save</button>
      </div>
    </Modal>
  </div>
</template>
