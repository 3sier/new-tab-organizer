import { STORAGE_KEYS, storageGet, storageSet } from './storage'
import { createWallpaperPreview } from './image'

export type WallpaperPreset = {
  id: string
  name: string
  background: string
}

export const CUSTOM_WALLPAPER_MARKER = '__custom_wallpaper__'

const WALLPAPER_DB_NAME = 'newtab-assets'
const WALLPAPER_DB_VERSION = 1
const WALLPAPER_STORE_NAME = 'assets'
const WALLPAPER_RECORD_KEY = 'wallpaper'

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: 'midnight-default',
    name: 'Midnight',
    background: 'linear-gradient(135deg, #090c12 0%, #0d1118 35%, #111723 100%)',
  },
  {
    id: 'violet-glow',
    name: 'Violet Glow',
    background: 'radial-gradient(circle at top left, rgba(124, 140, 255, 0.45), transparent 34%), linear-gradient(140deg, #0c1020 0%, #1a1336 45%, #091018 100%)',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    background: 'radial-gradient(circle at 20% 20%, rgba(34, 211, 238, 0.35), transparent 32%), radial-gradient(circle at 80% 10%, rgba(167, 139, 250, 0.28), transparent 26%), linear-gradient(140deg, #06111a 0%, #0a1f2b 45%, #120d24 100%)',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    background: 'radial-gradient(circle at top, rgba(251, 146, 60, 0.35), transparent 34%), linear-gradient(140deg, #1f1126 0%, #4c1d32 46%, #0b1326 100%)',
  },
  {
    id: 'forest-mist',
    name: 'Forest Mist',
    background: 'radial-gradient(circle at 25% 15%, rgba(74, 222, 128, 0.22), transparent 28%), linear-gradient(140deg, #08130f 0%, #11231c 45%, #0b1719 100%)',
  },
]

function isWallpaperPreset(value: string) {
  return WALLPAPER_PRESETS.some((item) => item.id === value)
}

export function isCustomWallpaper(value: string) {
  return value !== '' && !isWallpaperPreset(value)
}

export function getWallpaperStyle(wallpaper: string) {
  const preset = WALLPAPER_PRESETS.find((item) => item.id === wallpaper)
  if (preset) {
    return { backgroundImage: preset.background }
  }

  if (wallpaper) {
    return { backgroundImage: `url(${wallpaper})` }
  }

  return { backgroundImage: WALLPAPER_PRESETS[0].background }
}

export function getInitialWallpaper() {
  try {
    if (typeof window === 'undefined') return WALLPAPER_PRESETS[0].id

    const storedWallpaper = window.localStorage.getItem(STORAGE_KEYS.wallpaper) ?? ''

    if (isWallpaperPreset(storedWallpaper)) {
      return storedWallpaper
    }

    if (storedWallpaper === CUSTOM_WALLPAPER_MARKER) {
      return window.localStorage.getItem(STORAGE_KEYS.wallpaperPreview) || WALLPAPER_PRESETS[0].id
    }
  } catch {
    // Fall back to the default preset.
  }

  return WALLPAPER_PRESETS[0].id
}

function openWallpaperDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB no disponible'))
      return
    }

    const request = window.indexedDB.open(WALLPAPER_DB_NAME, WALLPAPER_DB_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(WALLPAPER_STORE_NAME)) {
        database.createObjectStore(WALLPAPER_STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB'))
  })
}

async function wallpaperAssetGet(): Promise<string> {
  const database = await openWallpaperDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(WALLPAPER_STORE_NAME, 'readonly')
    const store = transaction.objectStore(WALLPAPER_STORE_NAME)
    const request = store.get(WALLPAPER_RECORD_KEY)

    request.onsuccess = () => {
      database.close()
      resolve(typeof request.result === 'string' ? request.result : '')
    }
    request.onerror = () => {
      database.close()
      reject(request.error ?? new Error('No se pudo leer el wallpaper'))
    }
  })
}

async function wallpaperAssetSet(value: string) {
  const database = await openWallpaperDatabase()

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(WALLPAPER_STORE_NAME, 'readwrite')
    const store = transaction.objectStore(WALLPAPER_STORE_NAME)
    const request = store.put(value, WALLPAPER_RECORD_KEY)

    request.onsuccess = () => {
      database.close()
      resolve()
    }
    request.onerror = () => {
      database.close()
      reject(request.error ?? new Error('No se pudo guardar el wallpaper'))
    }
  })
}

async function wallpaperAssetDelete() {
  try {
    const database = await openWallpaperDatabase()

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(WALLPAPER_STORE_NAME, 'readwrite')
      const store = transaction.objectStore(WALLPAPER_STORE_NAME)
      const request = store.delete(WALLPAPER_RECORD_KEY)

      request.onsuccess = () => {
        database.close()
        resolve()
      }
      request.onerror = () => {
        database.close()
        reject(request.error ?? new Error('No se pudo borrar el wallpaper'))
      }
    })
  } catch {
    // If IndexedDB is unavailable there is nothing to delete.
  }
}

export async function getStoredWallpaper(): Promise<string> {
  let storedValue = ''

  try {
    storedValue = await storageGet(STORAGE_KEYS.wallpaper)
  } catch {
    storedValue = ''
  }

  if (!storedValue) {
    try {
      if (typeof window !== 'undefined') {
        storedValue = window.localStorage.getItem(STORAGE_KEYS.wallpaper) ?? ''
      }
    } catch {
      storedValue = ''
    }
  }

  if (!storedValue) return ''

  if (storedValue === CUSTOM_WALLPAPER_MARKER) {
    return wallpaperAssetGet()
  }

  if (isWallpaperPreset(storedValue)) {
    return storedValue
  }

  if (storedValue.startsWith('data:')) {
    await wallpaperAssetSet(storedValue)
    try {
      await storageSet(STORAGE_KEYS.wallpaper, CUSTOM_WALLPAPER_MARKER)
      window.localStorage.setItem(STORAGE_KEYS.wallpaper, CUSTOM_WALLPAPER_MARKER)
    } catch {
      // Best-effort migration from legacy storage.
    }
  }

  return storedValue
}

export async function setStoredWallpaper(value: string) {
  const storageValue = isWallpaperPreset(value) ? value : CUSTOM_WALLPAPER_MARKER

  if (storageValue === CUSTOM_WALLPAPER_MARKER) {
    await wallpaperAssetSet(value)
  } else {
    await wallpaperAssetDelete()
  }

  await storageSet(STORAGE_KEYS.wallpaper, storageValue)

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEYS.wallpaper, storageValue)

    if (storageValue === CUSTOM_WALLPAPER_MARKER) {
      const preview = await createWallpaperPreview(value)
      if (preview) {
        window.localStorage.setItem(STORAGE_KEYS.wallpaperPreview, preview)
      }
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.wallpaperPreview)
    }
  }
}
