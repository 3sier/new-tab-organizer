type ChromeLike = typeof globalThis & {
  chrome?: typeof chrome
}

export const STORAGE_KEYS = {
  wallpaper: 'newtab.wallpaper',
  wallpaperPreview: 'newtab.wallpaperPreview',
  wallpaperBlur: 'newtab.wallpaperBlur',
  selectedFolder: 'newtab.selectedFolder',
  note: 'newtab.note',
  weatherCity: 'newtab.weatherCity',
  pinnedBookmarks: 'newtab.pinnedBookmarks',
  widgetShowWallpaperPanel: 'newtab.widgetShowWallpaperPanel',
  widgetShowWeatherWidget: 'newtab.widgetShowWeatherWidget',
  widgetShowPinnedWidget: 'newtab.widgetShowPinnedWidget',
  widgetShowNoteWidget: 'newtab.widgetShowNoteWidget',
}

export const browserChrome = (globalThis as ChromeLike).chrome

export function getWallpaperPreviewFromLocalStorage() {
  try {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem(STORAGE_KEYS.wallpaperPreview) ?? ''
  } catch {
    return ''
  }
}

export function getStoredFolderFromLocalStorage() {
  try {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem(STORAGE_KEYS.selectedFolder) ?? ''
  } catch {
    return ''
  }
}

export async function storageGet(key: string): Promise<string> {
  if (!browserChrome?.storage?.local) return ''
  const result = await browserChrome.storage.local.get(key)
  const value = result[key]
  return typeof value === 'string' ? value : ''
}

export async function storageGetStringArray(key: string): Promise<string[]> {
  if (!browserChrome?.storage?.local) return []
  const result = await browserChrome.storage.local.get(key)
  const value = result[key]
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export async function storageGetNumber(key: string): Promise<number | null> {
  if (!browserChrome?.storage?.local) return null
  const result = await browserChrome.storage.local.get(key)
  const value = result[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export async function storageGetBoolean(key: string): Promise<boolean | null> {
  if (!browserChrome?.storage?.local) return null
  const result = await browserChrome.storage.local.get(key)
  const value = result[key]
  return typeof value === 'boolean' ? value : null
}

export async function storageSet(key: string, value: string | string[] | number | boolean) {
  if (!browserChrome?.storage?.local) return
  await browserChrome.storage.local.set({ [key]: value })
}

export async function persistSelectedFolder(value: string) {
  try {
    await storageSet(STORAGE_KEYS.selectedFolder, value)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.selectedFolder, value)
    }
  } catch {
    // Best-effort persistence for active folder selection.
  }
}
