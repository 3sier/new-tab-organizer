import type { BookmarkNode, FlatBookmark, WidgetVisibility } from '../types'
import { DEFAULT_WIDGET_VISIBILITY } from '../types'
import { findFolderByPath, flattenBookmarks, getFolderPath, isFolder } from './bookmarks'

export const CONFIG_EXPORT_VERSION = 2
export const CONFIG_APP_LABEL = 'Brave New Tab Organizer'

export type PinnedRef = {
  url: string
  title: string
}

export type ExportedNode =
  | { type: 'folder'; title: string; children: ExportedNode[] }
  | { type: 'bookmark'; title: string; url: string }

export type ExportedRoot = {
  rootId: string
  title: string
  children: ExportedNode[]
}

const EXPORTABLE_ROOT_IDS = ['1', '2']

export type ConfigPayload = {
  version: number
  exportedAt: string
  app: string
  config: {
    wallpaper: string
    wallpaperBlur: number
    note: string
    weatherCity: string
    pinnedBookmarks: PinnedRef[]
    selectedFolderPath: string[]
    widgetVisibility: WidgetVisibility
    bookmarksTree: ExportedRoot[]
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isPinnedRefArray(value: unknown): value is PinnedRef[] {
  return Array.isArray(value) && value.every((item) => (
    isRecord(item) && typeof item.url === 'string' && typeof item.title === 'string'
  ))
}

function isWidgetVisibility(value: unknown): value is WidgetVisibility {
  if (!isRecord(value)) return false
  return (
    typeof value.wallpaperPanel === 'boolean'
    && typeof value.weatherWidget === 'boolean'
    && typeof value.pinnedWidget === 'boolean'
    && typeof value.noteWidget === 'boolean'
  )
}

function clampBlur(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0
  return Math.max(0, Math.min(Math.round(raw), 40))
}

export type ParsedConfig = {
  wallpaper: string
  wallpaperBlur: number
  note: string
  weatherCity: string
  pinnedBookmarks: PinnedRef[]
  selectedFolderPath: string[]
  widgetVisibility: WidgetVisibility
  bookmarksTree: ExportedRoot[]
}

function isExportedNodeArray(value: unknown): value is ExportedNode[] {
  if (!Array.isArray(value)) return false
  return value.every((item) => {
    if (!isRecord(item)) return false
    if (item.type === 'folder') {
      return typeof item.title === 'string' && isExportedNodeArray(item.children)
    }
    if (item.type === 'bookmark') {
      return typeof item.title === 'string' && typeof item.url === 'string'
    }
    return false
  })
}

function isExportedRootArray(value: unknown): value is ExportedRoot[] {
  if (!Array.isArray(value)) return false
  return value.every((item) => (
    isRecord(item)
    && typeof item.rootId === 'string'
    && typeof item.title === 'string'
    && isExportedNodeArray(item.children)
  ))
}

export function parseConfigPayload(raw: unknown): ParsedConfig | null {
  const root = isRecord(raw) ? raw : null
  if (!root) return null

  const data = isRecord(root.config) ? root.config : root
  if (!isRecord(data)) return null

  const { wallpaper, wallpaperBlur, note, weatherCity, widgetVisibility } = data

  if (
    typeof wallpaper !== 'string'
    || typeof note !== 'string'
    || typeof weatherCity !== 'string'
    || !isWidgetVisibility(widgetVisibility)
  ) {
    return null
  }

  let pinnedBookmarks: PinnedRef[] = []
  if (isPinnedRefArray(data.pinnedBookmarks)) {
    pinnedBookmarks = data.pinnedBookmarks
  } else if (isStringArray(data.pinnedBookmarks)) {
    // v1: array of bookmark IDs — unusable across browsers, drop.
    pinnedBookmarks = []
  } else {
    return null
  }

  let selectedFolderPath: string[] = []
  if (isStringArray(data.selectedFolderPath)) {
    selectedFolderPath = data.selectedFolderPath
  } else if (typeof data.selectedFolder === 'string') {
    // v1: folder ID — unusable across browsers, drop.
    selectedFolderPath = []
  } else if (isStringArray(data.selectedFolder)) {
    selectedFolderPath = data.selectedFolder as string[]
  }

  const bookmarksTree = isExportedRootArray(data.bookmarksTree) ? data.bookmarksTree : []

  return {
    wallpaper,
    wallpaperBlur: clampBlur(wallpaperBlur),
    note,
    weatherCity,
    pinnedBookmarks,
    selectedFolderPath,
    widgetVisibility: { ...DEFAULT_WIDGET_VISIBILITY, ...widgetVisibility },
    bookmarksTree,
  }
}

function nodeToExported(node: BookmarkNode): ExportedNode | null {
  if (node.url) {
    return { type: 'bookmark', title: node.title || node.url, url: node.url }
  }
  const children = (node.children ?? [])
    .map(nodeToExported)
    .filter((n): n is ExportedNode => Boolean(n))
  return { type: 'folder', title: node.title || 'Untitled', children }
}

export function buildExportedRoots(tree: BookmarkNode[]): ExportedRoot[] {
  const roots: ExportedRoot[] = []
  const walk = (nodes: BookmarkNode[] | undefined) => {
    if (!nodes) return
    for (const node of nodes) {
      if (EXPORTABLE_ROOT_IDS.includes(node.id)) {
        const children = (node.children ?? [])
          .map(nodeToExported)
          .filter((n): n is ExportedNode => Boolean(n))
        roots.push({ rootId: node.id, title: node.title || '', children })
      } else {
        walk(node.children)
      }
    }
  }
  walk(tree)
  return roots
}

export function buildExportPayload(params: {
  wallpaper: string
  wallpaperBlur: number
  note: string
  weatherCity: string
  pinnedBookmarkIds: string[]
  selectedFolderId: string
  widgetVisibility: WidgetVisibility
  tree: BookmarkNode[]
}): ConfigPayload {
  const flat = flattenBookmarks(params.tree)
  const byId = new Map(flat.map((b) => [b.id, b]))
  const pinnedBookmarks: PinnedRef[] = params.pinnedBookmarkIds
    .map((id) => byId.get(id))
    .filter((b): b is FlatBookmark => Boolean(b))
    .map((b) => ({ url: b.url, title: b.title }))

  const selectedFolderPath = params.selectedFolderId
    ? getFolderPath(params.tree, params.selectedFolderId) ?? []
    : []

  return {
    version: CONFIG_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    app: CONFIG_APP_LABEL,
    config: {
      wallpaper: params.wallpaper,
      wallpaperBlur: params.wallpaperBlur,
      note: params.note,
      weatherCity: params.weatherCity,
      pinnedBookmarks,
      selectedFolderPath,
      widgetVisibility: params.widgetVisibility,
      bookmarksTree: buildExportedRoots(params.tree),
    },
  }
}

export type ResolvedImport = {
  pinnedBookmarkIds: string[]
  selectedFolderId: string
}

export function normalizeForMatch(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    parsed.hostname = parsed.hostname.toLowerCase()
    let str = parsed.toString()
    if (str.endsWith('/') && !parsed.search) str = str.slice(0, -1)
    return str
  } catch {
    return url.trim().replace(/\/$/, '').toLowerCase()
  }
}

export function buildBookmarkUrlIndex(tree: BookmarkNode[]): Map<string, string> {
  const flat = flattenBookmarks(tree)
  const byUrl = new Map<string, string>()
  for (const b of flat) {
    const key = normalizeForMatch(b.url)
    if (!byUrl.has(key)) byUrl.set(key, b.id)
  }
  return byUrl
}

export function resolveImportedRefs(
  parsed: ParsedConfig,
  tree: BookmarkNode[],
  fallbackSelectedFolderId: string,
): ResolvedImport {
  const byUrl = buildBookmarkUrlIndex(tree)

  const pinnedBookmarkIds = parsed.pinnedBookmarks
    .map((ref) => byUrl.get(normalizeForMatch(ref.url)))
    .filter((id): id is string => Boolean(id))

  let selectedFolderId = fallbackSelectedFolderId
  if (parsed.selectedFolderPath.length) {
    const match = findFolderByPath(tree, parsed.selectedFolderPath)
    if (match && isFolder(match)) selectedFolderId = match.id
  }

  return { pinnedBookmarkIds, selectedFolderId }
}

export function findMissingPins(
  parsed: ParsedConfig,
  tree: BookmarkNode[],
): PinnedRef[] {
  const byUrl = buildBookmarkUrlIndex(tree)
  return parsed.pinnedBookmarks.filter((ref) => !byUrl.has(normalizeForMatch(ref.url)))
}
