import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import './App.css'
import { SearchBar } from './components/SearchBar'
import { Toast } from './components/Toast'
import { WallpaperPanel } from './components/WallpaperPanel'
import {
  buildBrowserSearchUrl,
  bookmarkHost,
  SEARCH_RESULT_LIMIT,
  getSearchScore,
} from './lib/search'
import {
  browserChrome,
  getStoredFolderFromLocalStorage,
  getWallpaperPreviewFromLocalStorage,
  persistSelectedFolder,
  STORAGE_KEYS,
  storageGet,
  storageGetNumber,
  storageGetStringArray,
  storageGetBoolean,
  storageSet,
} from './lib/storage'
import {
  isCustomWallpaper,
  getInitialWallpaper,
  getWallpaperStyle,
  getStoredWallpaper,
  setStoredWallpaper,
  WALLPAPER_PRESETS,
} from './lib/wallpaper'
import {
  createOptimizedWallpaperDataUrl,
  readFileAsDataUrl,
} from './lib/image'

type BookmarkNode = chrome.bookmarks.BookmarkTreeNode

type CreateMode = 'folder' | 'bookmark'
type ToastTone = 'success' | 'error' | 'info'

type WeatherData = {
  city: string
  temperature: number
  weatherCode: number
  tempMax: number
  tempMin: number
  forecast: {
    date: string
    weatherCode: number
    tempMax: number
    tempMin: number
  }[]
}

type WidgetVisibility = {
  wallpaperPanel: boolean
  weatherWidget: boolean
  pinnedWidget: boolean
  noteWidget: boolean
}

type ConfigPayload = {
  version: number
  exportedAt: string
  app: string
  config: {
    wallpaper: string
    wallpaperBlur: number
    note: string
    weatherCity: string
    pinnedBookmarks: string[]
    selectedFolder: string
    widgetVisibility: WidgetVisibility
  }
}

type ToastState = {
  id: number
  message: string
  tone: ToastTone
}

type FlatBookmark = {
  id: string
  title: string
  url: string
  parentId?: string
  parentTitle?: string
}

type FolderItem = {
  id: string
  title: string
  childrenCount: number
}

type EditingBookmarkState = {
  id: string
  title: string
  url: string
  parentId?: string
}

type ShortcutCardProps = {
  bookmark: FlatBookmark
  canManageBookmarks: boolean
  isPinned: boolean
  organizeMode: boolean
  sortable: boolean
  isHighlighted: boolean
  onDelete: (id: string) => void
  onEdit: (bookmark: FlatBookmark) => void
  onTogglePin: (bookmarkId: string) => void
  onHover: () => void
}

type FolderPillProps = {
  folder: FolderItem
  isActive: boolean
  canManageBookmarks: boolean
  organizeMode: boolean
  isEditing: boolean
  editingFolderTitle: string
  onSelect: (id: string) => void
  onStartRename: (folder: FolderItem) => void
  onDelete: (id: string, title: string) => void
  onRenameSubmit: (event: FormEvent) => void
  onRenameChange: (value: string) => void
  onRenameCancel: () => void
}

type MoveTrayProps = {
  folders: FolderItem[]
  selectedFolderId: string
  activeFolderId?: string
  activeBookmarkTitle: string
}

const FALLBACK_TREE: BookmarkNode[] = [
  {
    id: 'root',
    title: 'Bookmarks',
    dateAdded: Date.now(),
    children: [
      {
        id: 'work',
        title: 'Work',
        dateAdded: Date.now(),
        children: [
          { id: '1', title: 'GitHub', url: 'https://github.com', dateAdded: Date.now() },
          { id: '2', title: 'Figma', url: 'https://figma.com', dateAdded: Date.now() },
          { id: '3', title: 'Linear', url: 'https://linear.app', dateAdded: Date.now() },
        ],
      },
      {
        id: 'design',
        title: 'Design',
        dateAdded: Date.now(),
        children: [
          { id: '4', title: 'Dribbble', url: 'https://dribbble.com', dateAdded: Date.now() },
          { id: '5', title: 'Awwwards', url: 'https://awwwards.com', dateAdded: Date.now() },
          { id: '6', title: 'Behance', url: 'https://behance.net', dateAdded: Date.now() },
        ],
      },
    ],
  } as BookmarkNode,
]

function isFolder(node: BookmarkNode) {
  return !node.url
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const parsed = new URL(withProtocol)
    if (!parsed.hostname.includes('.')) return ''
    return parsed.toString()
  } catch {
    return ''
  }
}

function flattenBookmarks(nodes: BookmarkNode[] | undefined, parentId?: string, parentTitle?: string): FlatBookmark[] {
  if (!nodes) return []

  return nodes.flatMap((node) => {
    if (node.url) {
      return [{ id: node.id, title: node.title || node.url, url: node.url, parentId, parentTitle }]
    }

    return flattenBookmarks(node.children, node.id, node.title)
  })
}

function collectFolders(nodes: BookmarkNode[] | undefined): FolderItem[] {
  if (!nodes) return []

  return nodes.flatMap((node) => {
    if (!isFolder(node)) return []

    const current = node.id === '0' || node.id === '1' || node.id === '2'
      ? []
      : [{ id: node.id, title: node.title || 'Untitled folder', childrenCount: node.children?.length ?? 0 }]

    return [...current, ...collectFolders(node.children)]
  })
}

function findFolderById(nodes: BookmarkNode[] | undefined, folderId: string): BookmarkNode | null {
  if (!nodes) return null

  for (const node of nodes) {
    if (node.id === folderId && isFolder(node)) return node
    const nested = findFolderById(node.children, folderId)
    if (nested) return nested
  }

  return null
}

function getGreeting(hour: number) {
  if (hour < 6) return 'Buenas noches'
  if (hour < 12) return 'Buenos días'
  if (hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function getFavicon(url: string) {
  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
  } catch {
    return ''
  }
}

function weatherLabel(code: number) {
  if (code === 0) return 'Despejado'
  if ([1, 2, 3].includes(code)) return 'Nubes'
  if ([45, 48].includes(code)) return 'Niebla'
  if ([51, 53, 55, 56, 57].includes(code)) return 'Llovizna'
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Lluvia'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Nieve'
  if ([95, 96, 99].includes(code)) return 'Tormenta'
  return 'Variable'
}

function weatherEmoji(code: number) {
  if (code === 0) return '☀️'
  if ([1, 2, 3].includes(code)) return '⛅'
  if ([45, 48].includes(code)) return '🌫️'
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧️'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️'
  if ([95, 96, 99].includes(code)) return '⛈️'
  return '🌤️'
}

const CONFIG_EXPORT_VERSION = 1
const CONFIG_APP_LABEL = 'Brave New Tab Organizer'
const DEFAULT_WIDGET_VISIBILITY: WidgetVisibility = {
  wallpaperPanel: true,
  weatherWidget: true,
  pinnedWidget: true,
  noteWidget: true,
}
const WIDGET_VISIBILITY_STORAGE_KEYS: Record<keyof WidgetVisibility, string> = {
  wallpaperPanel: STORAGE_KEYS.widgetShowWallpaperPanel,
  weatherWidget: STORAGE_KEYS.widgetShowWeatherWidget,
  pinnedWidget: STORAGE_KEYS.widgetShowPinnedWidget,
  noteWidget: STORAGE_KEYS.widgetShowNoteWidget,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isWidgetVisibility(value: unknown): value is WidgetVisibility {
  if (!isRecord(value)) return false
  return (
    typeof value.wallpaperPanel === 'boolean' &&
    typeof value.weatherWidget === 'boolean' &&
    typeof value.pinnedWidget === 'boolean' &&
    typeof value.noteWidget === 'boolean'
  )
}

function normalizeConfigPayload(raw: unknown): ConfigPayload | null {
  const data = isRecord(raw) && isRecord(raw.config) ? raw.config : raw
  if (!isRecord(data)) return null

  const wallpaper = data.wallpaper
  const wallpaperBlur = data.wallpaperBlur
  const note = data.note
  const weatherCity = data.weatherCity
  const pinnedBookmarks = data.pinnedBookmarks
  const selectedFolder = data.selectedFolder
  const widgetVisibility = data.widgetVisibility
  const hasBasicFields = (
    typeof wallpaper === 'string'
    && typeof note === 'string'
    && typeof weatherCity === 'string'
    && isStringArray(pinnedBookmarks)
    && typeof selectedFolder === 'string'
  )

  if (!hasBasicFields || !isWidgetVisibility(widgetVisibility)) return null

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: CONFIG_APP_LABEL,
    config: {
      wallpaper,
      wallpaperBlur: typeof wallpaperBlur === 'number' && Number.isFinite(wallpaperBlur) ? wallpaperBlur : 0,
      note,
      weatherCity,
      pinnedBookmarks,
      selectedFolder,
      widgetVisibility,
    },
  }
}

function isTypingTarget(element: EventTarget | null): boolean {
  if (!(element instanceof HTMLElement)) return false
  if (element.isContentEditable) return true
  return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT'
}

async function fetchWeather(city: string): Promise<WeatherData> {
  const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es&format=json`)
  const geoJson = await geoRes.json()
  const place = geoJson?.results?.[0]

  if (!place) {
    throw new Error('Ciudad no encontrada')
  }

  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`,
  )
  const weatherJson = await weatherRes.json()

  return {
    city: place.name,
    temperature: Math.round(weatherJson.current.temperature_2m),
    weatherCode: weatherJson.current.weather_code,
    tempMax: Math.round(weatherJson.daily.temperature_2m_max[0]),
    tempMin: Math.round(weatherJson.daily.temperature_2m_min[0]),
    forecast: weatherJson.daily.time.map((date: string, index: number) => ({
      date,
      weatherCode: weatherJson.daily.weather_code[index],
      tempMax: Math.round(weatherJson.daily.temperature_2m_max[index]),
      tempMin: Math.round(weatherJson.daily.temperature_2m_min[index]),
    })),
  }
}

function getForecastDayLabel(date: string, index: number) {
  if (index === 0) return 'Hoy'
  if (index === 1) return 'Mañana'

  return new Date(date).toLocaleDateString('es-ES', { weekday: 'short' })
}

function ShortcutCard({
  bookmark,
  canManageBookmarks,
  isPinned,
  organizeMode,
  sortable,
  isHighlighted,
  onDelete,
  onEdit,
  onTogglePin,
  onHover,
}: ShortcutCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bookmark.id,
    disabled: !organizeMode || !sortable,
    data: { type: 'bookmark', bookmark },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`shortcut-card ${organizeMode ? 'is-organize' : ''} ${isHighlighted ? 'is-search-highlight' : ''}`}
      onMouseEnter={onHover}
    >
      {organizeMode ? (
        <button type="button" className="drag-handle always-visible" aria-label={`Mover ${bookmark.title}`} {...attributes} {...listeners}>
          ⋮⋮
        </button>
      ) : null}

      <button
        type="button"
        className={`pin-chip ${isPinned ? 'is-active' : ''} ${canManageBookmarks && organizeMode ? 'is-organize-offset' : ''}`}
        onClick={() => onTogglePin(bookmark.id)}
        title={isPinned ? 'Quitar de fijados' : 'Fijar marcador'}
        aria-label={isPinned ? `Quitar ${bookmark.title} de fijados` : `Fijar ${bookmark.title}`}
      >
        {isPinned ? '★' : '☆'}
      </button>

      <a href={bookmark.url} className="shortcut-link">
        <div className="shortcut-icon">
          {getFavicon(bookmark.url) ? <img src={getFavicon(bookmark.url)} alt="" /> : <span>{bookmarkHost(bookmark.url).slice(0, 1).toUpperCase()}</span>}
        </div>
        <div className="shortcut-copy">
          <strong>{bookmark.title}</strong>
          <small>{bookmarkHost(bookmark.url)}</small>
        </div>
      </a>

      {canManageBookmarks && organizeMode ? (
        <div className="shortcut-actions visible-actions">
          <button type="button" className="icon-chip" onClick={() => onEdit(bookmark)} title="Editar marcador">✎</button>
          <button type="button" className="delete-chip" onClick={() => onDelete(bookmark.id)} title="Borrar marcador">×</button>
        </div>
      ) : null}
    </article>
  )
}

function FolderPill(props: FolderPillProps) {
  const {
    folder,
    isActive,
    canManageBookmarks,
    organizeMode,
    isEditing,
    editingFolderTitle,
    onSelect,
    onStartRename,
    onDelete,
    onRenameSubmit,
    onRenameChange,
    onRenameCancel,
  } = props

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `folder-sort-${folder.id}`,
    disabled: !organizeMode,
    data: { type: 'folder', folderId: folder.id },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`folder-pill folder-pill-group ${isActive ? 'is-active' : ''} ${organizeMode ? 'is-organize' : ''}`}
    >
      {organizeMode ? (
        <button type="button" className="folder-drag-handle always-visible" aria-label={`Mover carpeta ${folder.title}`} {...attributes} {...listeners}>
          ⋮⋮
        </button>
      ) : null}

      {isEditing ? (
        <form className="folder-rename-form" onSubmit={onRenameSubmit}>
          <input value={editingFolderTitle} onChange={(event) => onRenameChange(event.target.value)} autoFocus />
          <button type="submit" className="folder-mini-action">✓</button>
          <button type="button" className="folder-mini-action" onClick={onRenameCancel}>×</button>
        </form>
      ) : (
        <>
          <button type="button" className="folder-pill-main" onClick={() => onSelect(folder.id)}>
            <span className="folder-pill-title">{folder.title}</span>
            <span>{folder.childrenCount}</span>
          </button>
          {canManageBookmarks && organizeMode ? (
            <>
              <button type="button" className="folder-pill-icon" onClick={() => onStartRename(folder)} aria-label={`Renombrar carpeta ${folder.title}`} title={`Renombrar carpeta ${folder.title}`}>✎</button>
              <button type="button" className="folder-pill-delete" onClick={() => onDelete(folder.id, folder.title)} aria-label={`Borrar carpeta ${folder.title}`} title={`Borrar carpeta ${folder.title}`}>×</button>
            </>
          ) : null}
        </>
      )}
    </div>
  )
}

function MoveTrayFolderTarget({
  folder,
  isCurrent,
  isHighlighted,
}: {
  folder: FolderItem
  isCurrent: boolean
  isHighlighted: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `move-folder-${folder.id}`,
    disabled: isCurrent,
    data: { type: 'move-folder', folderId: folder.id },
  })

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`move-tray-target ${isCurrent ? 'is-current' : ''} ${isHighlighted || isOver ? 'is-highlighted' : ''}`}
      disabled={isCurrent}
    >
      <span className="move-tray-target-label">{folder.title}</span>
      <span className="move-tray-target-meta">{isCurrent ? 'Carpeta actual' : `${folder.childrenCount} links`}</span>
    </button>
  )
}

function MoveTray({ folders, selectedFolderId, activeFolderId, activeBookmarkTitle }: MoveTrayProps) {
  return (
    <div className="move-tray glass-card" aria-live="polite">
      <div className="move-tray-copy">
        <p className="eyebrow">Mover marcador</p>
        <h3>{activeBookmarkTitle}</h3>
        <p>Suelta en una carpeta para moverlo. Si lo sueltas en la cuadrícula, solo reordena dentro de {activeFolderId === selectedFolderId ? 'la carpeta actual' : 'la vista activa'}.</p>
      </div>

      <div className="move-tray-grid">
        {folders.map((folder) => (
          <MoveTrayFolderTarget
            key={folder.id}
            folder={folder}
            isCurrent={folder.id === selectedFolderId}
            isHighlighted={false}
          />
        ))}
      </div>
    </div>
  )
}

function App() {
  const [tree, setTree] = useState<BookmarkNode[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string>(getStoredFolderFromLocalStorage)
  const [search, setSearch] = useState('')
  const [searchResultIndex, setSearchResultIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const settingsPopoverRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [organizeMode, setOrganizeMode] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createMode, setCreateMode] = useState<CreateMode>('bookmark')
  const [newFolderName, setNewFolderName] = useState('')
  const [newBookmarkTitle, setNewBookmarkTitle] = useState('')
  const [newBookmarkUrl, setNewBookmarkUrl] = useState('')
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderTitle, setEditingFolderTitle] = useState('')
  const [editingBookmark, setEditingBookmark] = useState<EditingBookmarkState | null>(null)
  const [weatherCity, setWeatherCity] = useState('Madrid')
  const [weatherDraft, setWeatherDraft] = useState('Madrid')
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [weatherError, setWeatherError] = useState<string | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherEditorOpen, setWeatherEditorOpen] = useState(false)
  const [configPanelOpen, setConfigPanelOpen] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [wallpaper, setWallpaper] = useState(getInitialWallpaper)
  const [wallpaperBlur, setWallpaperBlur] = useState(0)
  const [widgetVisibility, setWidgetVisibility] = useState<WidgetVisibility>(DEFAULT_WIDGET_VISIBILITY)
  const [note, setNote] = useState('Termina la home, limpia el layout y deja todo bonito.')
  const [pinnedBookmarkIds, setPinnedBookmarkIds] = useState<string[]>([])
  const [activeBookmarkDrag, setActiveBookmarkDrag] = useState<FlatBookmark | null>(null)
  const [activeFolderDragId, setActiveFolderDragId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [wallpaperReady, setWallpaperReady] = useState(() => !getWallpaperPreviewFromLocalStorage())

  const canManageBookmarks = Boolean(browserChrome?.bookmarks)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const pushToast = useCallback((message: string, tone: ToastTone = 'success') => {
    setToast({ id: Date.now(), message, tone })
  }, [])

  useEffect(() => {
    if (!toast) return undefined

    const timeout = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const [
          savedWallpaper,
          savedWallpaperBlur,
          savedNote,
          savedWeatherCity,
          savedPinnedBookmarks,
          savedSelectedFolder,
          savedWallpaperPanelVisibility,
          savedWeatherWidgetVisibility,
          savedPinnedWidgetVisibility,
          savedNoteWidgetVisibility,
        ] = await Promise.all([
          getStoredWallpaper().catch(() => ''),
          storageGetNumber(STORAGE_KEYS.wallpaperBlur),
          storageGet(STORAGE_KEYS.note),
          storageGet(STORAGE_KEYS.weatherCity),
          storageGetStringArray(STORAGE_KEYS.pinnedBookmarks),
          storageGet(STORAGE_KEYS.selectedFolder),
          storageGetBoolean(STORAGE_KEYS.widgetShowWallpaperPanel),
          storageGetBoolean(STORAGE_KEYS.widgetShowWeatherWidget),
          storageGetBoolean(STORAGE_KEYS.widgetShowPinnedWidget),
          storageGetBoolean(STORAGE_KEYS.widgetShowNoteWidget),
        ])

        if (savedWallpaper) {
          setWallpaper(savedWallpaper)
          setWallpaperReady(true)
        }
        if (savedWallpaperBlur !== null) setWallpaperBlur(Math.max(0, Math.min(savedWallpaperBlur, 40)))
        if (savedNote) setNote(savedNote)
        if (savedWeatherCity) {
          setWeatherCity(savedWeatherCity)
          setWeatherDraft(savedWeatherCity)
        }
        if (savedPinnedBookmarks.length) setPinnedBookmarkIds(savedPinnedBookmarks)
        if (savedSelectedFolder) {
          setSelectedFolderId(savedSelectedFolder)
        }
        setWidgetVisibility({
          wallpaperPanel: savedWallpaperPanelVisibility ?? DEFAULT_WIDGET_VISIBILITY.wallpaperPanel,
          weatherWidget: savedWeatherWidgetVisibility ?? DEFAULT_WIDGET_VISIBILITY.weatherWidget,
          pinnedWidget: savedPinnedWidgetVisibility ?? DEFAULT_WIDGET_VISIBILITY.pinnedWidget,
          noteWidget: savedNoteWidgetVisibility ?? DEFAULT_WIDGET_VISIBILITY.noteWidget,
        })
      } catch (error) {
        console.error('No se pudieron cargar las preferencias guardadas', error)
      }
    })()
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        setWeatherLoading(true)
        setWeatherError(null)
        const data = await fetchWeather(weatherCity)
        setWeather(data)
      } catch {
        setWeather(null)
        setWeatherError('No se pudo cargar el tiempo')
      } finally {
        setWeatherLoading(false)
      }
    })()
  }, [weatherCity])

  const loadBookmarks = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (browserChrome?.bookmarks?.getTree) {
        const root = await browserChrome.bookmarks.getTree()
        setTree(root)
      } else {
        setTree(FALLBACK_TREE)
      }
    } catch (err) {
      setError('No se pudieron cargar los marcadores.')
      setTree(FALLBACK_TREE)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBookmarks()
  }, [loadBookmarks])

  const folders = useMemo(() => collectFolders(tree), [tree])
  const allBookmarks = useMemo(() => flattenBookmarks(tree), [tree])
  const pinnedBookmarks = useMemo(() => {
    const bookmarkMap = new Map(allBookmarks.map((bookmark) => [bookmark.id, bookmark]))
    return pinnedBookmarkIds
      .map((bookmarkId) => bookmarkMap.get(bookmarkId))
      .filter((bookmark): bookmark is FlatBookmark => Boolean(bookmark))
  }, [allBookmarks, pinnedBookmarkIds])

  useEffect(() => {
    if (!folders.length) return
    if (!selectedFolderId || !folders.some((folder) => folder.id === selectedFolderId)) {
      setSelectedFolderId(folders[0].id)
    }
  }, [folders, selectedFolderId])

  useEffect(() => {
    if (!selectedFolderId) return
    if (!folders.some((folder) => folder.id === selectedFolderId)) return
    void persistSelectedFolder(selectedFolderId)
  }, [selectedFolderId, folders])

  const selectedFolder = useMemo(
    () => (selectedFolderId ? findFolderById(tree, selectedFolderId) : null),
    [tree, selectedFolderId],
  )

  const folderBookmarks = useMemo(() => {
    return selectedFolder ? flattenBookmarks(selectedFolder.children, selectedFolder.id, selectedFolder.title) : []
  }, [selectedFolder])

  const bookmarkMatches = useMemo(() => {
    const query = search.trim()
    if (!query) return []

    return allBookmarks
      .map((bookmark) => ({ bookmark, score: getSearchScore(bookmark, query) }))
      .filter((item) => item.score >= 15)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score
        return left.bookmark.title.localeCompare(right.bookmark.title, 'es')
      })
      .map((item) => item.bookmark)
  }, [search, allBookmarks])

  useEffect(() => {
    if (loading) return

    const availableIds = new Set(allBookmarks.map((bookmark) => bookmark.id))
    const nextPinned = pinnedBookmarkIds.filter((bookmarkId) => availableIds.has(bookmarkId))

    if (nextPinned.length !== pinnedBookmarkIds.length) {
      setPinnedBookmarkIds(nextPinned)
      void storageSet(STORAGE_KEYS.pinnedBookmarks, nextPinned)
    }
  }, [allBookmarks, pinnedBookmarkIds, loading])

  const visibleBookmarks = search.trim() ? bookmarkMatches : folderBookmarks
  const quickLinks = visibleBookmarks.slice(0, SEARCH_RESULT_LIMIT)
  const hasSearchResults = search.trim().length > 0 && quickLinks.length > 0

  useEffect(() => {
    if (!search.trim()) {
      setSearchResultIndex(0)
      return
    }

    if (!quickLinks.length) {
      setSearchResultIndex(0)
      return
    }

    setSearchResultIndex((currentIndex) => Math.min(currentIndex, quickLinks.length - 1))
  }, [search, quickLinks.length])

  const activeSearchResult = useMemo(() => {
    if (!search.trim() || !quickLinks.length) return null
    return quickLinks[Math.min(searchResultIndex, quickLinks.length - 1)] || null
  }, [search, quickLinks, searchResultIndex])

  const handleOpenSearchResult = useCallback((bookmark: FlatBookmark) => {
    window.location.href = bookmark.url
  }, [])

  const openResultForActiveSearch = useCallback(() => {
    if (!search.trim()) return false

    if (activeSearchResult) {
      handleOpenSearchResult(activeSearchResult)
      return true
    }

    if (bookmarkMatches[0]) {
      handleOpenSearchResult(bookmarkMatches[0])
      return true
    }

    return false
  }, [activeSearchResult, bookmarkMatches, handleOpenSearchResult, search])

  const canReorderBookmarks = organizeMode && !search.trim() && Boolean(selectedFolderId)

  const hour = now.getHours()
  const greeting = getGreeting(hour)
  const timeLabel = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const dateLabel = now.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const activeFolderLabel = selectedFolder?.title || 'Carpeta'
  const wallpaperFilter = wallpaperBlur > 0 ? `blur(${wallpaperBlur}px)` : 'none'

  const handleSearchSubmit = useCallback((event: FormEvent) => {
    event.preventDefault()
    const query = search.trim()
    if (!query) return

    if (openResultForActiveSearch()) {
      return
    }

    window.location.href = buildBrowserSearchUrl(query)
  }, [openResultForActiveSearch, search])

  const resetCreateForm = () => {
    setNewFolderName('')
    setNewBookmarkTitle('')
    setNewBookmarkUrl('')
    setFormError(null)
  }

  const openCreateModal = (mode: CreateMode) => {
    setCreateMode(mode)
    setCreateModalOpen(true)
    setFormError(null)
  }

  const closeCreateModal = () => {
    setCreateModalOpen(false)
    resetCreateForm()
  }

  const handleCreateFolder = async (event: FormEvent) => {
    event.preventDefault()
    const title = newFolderName.trim()
    if (!title || !canManageBookmarks || !browserChrome) return

    const created = await browserChrome.bookmarks.create({ parentId: '1', title })

    setSelectedFolderId(created.id)
    await loadBookmarks()
    closeCreateModal()
    pushToast(`Carpeta “${title}” creada`)
  }

  const handleCreateBookmark = async (event: FormEvent) => {
    event.preventDefault()
    const title = newBookmarkTitle.trim()
    const normalizedUrl = normalizeUrl(newBookmarkUrl)

    if (!normalizedUrl) {
      setFormError('Pon una URL válida. Si escribes youtube.com, yo le añado https://.')
      pushToast('La URL no es válida', 'error')
      return
    }

    if (!selectedFolderId || !canManageBookmarks || !browserChrome) return

    await browserChrome.bookmarks.create({
      parentId: selectedFolderId,
      title: title || normalizedUrl,
      url: normalizedUrl,
    })

    await loadBookmarks()
    closeCreateModal()
    pushToast(`Marcador “${title || bookmarkHost(normalizedUrl)}” guardado`)
  }

  const handleDeleteBookmark = async (id: string) => {
    if (!canManageBookmarks || !browserChrome) return
    const bookmark = allBookmarks.find((item) => item.id === id)
    await browserChrome.bookmarks.remove(id)
    await loadBookmarks()
    pushToast(`Marcador “${bookmark?.title || 'sin título'}” borrado`, 'info')
  }

  const handleDeleteFolder = async (folderId: string, folderTitle: string) => {
    if (!canManageBookmarks || !browserChrome) return
    const confirmed = window.confirm(`¿Borrar la carpeta "${folderTitle}" y todo lo que contiene?`)
    if (!confirmed) return
    await browserChrome.bookmarks.removeTree(folderId)
    if (selectedFolderId === folderId) setSelectedFolderId('')
    await loadBookmarks()
    pushToast(`Carpeta “${folderTitle}” borrada`, 'info')
  }

  const startRenameFolder = (folder: FolderItem) => {
    setEditingFolderId(folder.id)
    setEditingFolderTitle(folder.title)
  }

  const handleRenameFolder = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingFolderId || !editingFolderTitle.trim() || !canManageBookmarks || !browserChrome) return
    const nextTitle = editingFolderTitle.trim()
    await browserChrome.bookmarks.update(editingFolderId, { title: nextTitle })
    setEditingFolderId(null)
    setEditingFolderTitle('')
    await loadBookmarks()
    pushToast(`Carpeta renombrada a “${nextTitle}”`)
  }

  const startEditBookmark = (bookmark: FlatBookmark) => {
    setEditingBookmark({ id: bookmark.id, title: bookmark.title, url: bookmark.url, parentId: bookmark.parentId })
    setFormError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSaveBookmark = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingBookmark || !canManageBookmarks || !browserChrome) return

    const normalizedUrl = normalizeUrl(editingBookmark.url)
    if (!normalizedUrl) {
      setFormError('Pon una URL válida. Si escribes youtube.com, yo le añado https://.')
      pushToast('La URL no es válida', 'error')
      return
    }

    await browserChrome.bookmarks.update(editingBookmark.id, {
      title: editingBookmark.title.trim() || normalizedUrl,
      url: normalizedUrl,
    })

    if (editingBookmark.parentId) {
      await browserChrome.bookmarks.move(editingBookmark.id, { parentId: editingBookmark.parentId })
    }

    setEditingBookmark(null)
    setFormError(null)
    await loadBookmarks()
    pushToast('Marcador actualizado')
  }

  const handleWallpaperPreset = async (presetId: string) => {
    try {
      setWallpaper(presetId)
      setWallpaperReady(true)
      await setStoredWallpaper(presetId)
      pushToast('Wallpaper actualizado')
    } catch (error) {
      console.error('No se pudo guardar el wallpaper', error)
      pushToast('No se pudo guardar el wallpaper', 'error')
    }
  }

  const handleWallpaperChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const originalDataUrl = await readFileAsDataUrl(file)
      const optimizedDataUrl = await createOptimizedWallpaperDataUrl(originalDataUrl)

      if (!optimizedDataUrl) {
        throw new Error('Imagen vacía')
      }

      setWallpaper(optimizedDataUrl)
      setWallpaperReady(true)
      await setStoredWallpaper(optimizedDataUrl)
      pushToast('Wallpaper personalizado guardado')
    } catch (error) {
      console.error('No se pudo guardar el wallpaper personalizado', error)
      pushToast('No se pudo guardar la imagen de fondo', 'error')
    } finally {
      event.target.value = ''
    }
  }

  const handleWallpaperReset = async () => {
    try {
      const defaultWallpaper = WALLPAPER_PRESETS[0].id
      setWallpaper(defaultWallpaper)
      setWallpaperReady(true)
      await setStoredWallpaper(defaultWallpaper)
      pushToast('Wallpaper personalizado eliminado')
    } catch (error) {
      console.error('No se pudo restaurar el wallpaper', error)
      pushToast('No se pudo restaurar el wallpaper', 'error')
    }
  }

  const handleWallpaperBlurChange = async (value: number) => {
    const nextBlur = Math.max(0, Math.min(Math.round(value), 40))
    setWallpaperBlur(nextBlur)
    await storageSet(STORAGE_KEYS.wallpaperBlur, nextBlur)
  }

  const handleWidgetVisibilityChange = async (key: keyof WidgetVisibility, value: boolean) => {
    const nextVisibility = { ...widgetVisibility, [key]: value }
    setWidgetVisibility(nextVisibility)
    await storageSet(WIDGET_VISIBILITY_STORAGE_KEYS[key], value)
  }

  const downloadConfig = (payload: ConfigPayload) => {
    const content = JSON.stringify(payload, null, 2)
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `brave-newtab-config-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleExportConfig = async () => {
    const wallpaperValue = await getStoredWallpaper().catch(() => wallpaper)
    const payload: ConfigPayload = {
      version: CONFIG_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      app: CONFIG_APP_LABEL,
      config: {
        wallpaper: wallpaperValue,
        wallpaperBlur,
        note,
        weatherCity,
        pinnedBookmarks: pinnedBookmarkIds,
        selectedFolder: selectedFolderId,
        widgetVisibility,
      },
    }

    downloadConfig(payload)
    pushToast('Configuración exportada')
  }

  const handleImportConfig = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const raw = await file.text()
      const parsed = JSON.parse(raw)
      const normalized = normalizeConfigPayload(parsed)

      if (!normalized) {
        throw new Error('Formato de configuración incorrecto')
      }

      const imported = normalized.config
      const nextPinned = imported.pinnedBookmarks
      const nextWidgetVisibility = {
        ...widgetVisibility,
        ...imported.widgetVisibility,
      }

      setWallpaperBlur(Math.max(0, Math.min(Math.round(imported.wallpaperBlur), 40)))
      await storageSet(STORAGE_KEYS.wallpaperBlur, Math.max(0, Math.min(Math.round(imported.wallpaperBlur), 40)))

      setNote(imported.note)
      await storageSet(STORAGE_KEYS.note, imported.note)

      setWeatherCity(imported.weatherCity)
      setWeatherDraft(imported.weatherCity)
      await storageSet(STORAGE_KEYS.weatherCity, imported.weatherCity)

      setPinnedBookmarkIds(nextPinned)
      await storageSet(STORAGE_KEYS.pinnedBookmarks, nextPinned)

      setSelectedFolderId(imported.selectedFolder)
      await persistSelectedFolder(imported.selectedFolder)

      setWidgetVisibility(nextWidgetVisibility)
      await Promise.all(Object.keys(nextWidgetVisibility).map((key) => storageSet(
        WIDGET_VISIBILITY_STORAGE_KEYS[key as keyof WidgetVisibility],
        nextWidgetVisibility[key as keyof WidgetVisibility],
      )))

      setWallpaperReady(false)
      await setStoredWallpaper(imported.wallpaper)
      const resolvedWallpaper = await getStoredWallpaper().catch(() => imported.wallpaper)
      setWallpaper(resolvedWallpaper || imported.wallpaper)
      setWallpaperReady(true)

      await loadBookmarks()
      pushToast('Configuración importada')
    } catch (error) {
      console.error('No se pudo importar la configuración', error)
      pushToast('No se pudo importar la configuración', 'error')
    } finally {
      event.target.value = ''
    }
  }

  const handleNoteChange = async (value: string) => {
    setNote(value)
    await storageSet(STORAGE_KEYS.note, value)
  }

  const handleWeatherSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const city = weatherDraft.trim()
    if (!city) return
    setWeatherCity(city)
    setWeatherDraft(city)
    setWeatherEditorOpen(false)
    await storageSet(STORAGE_KEYS.weatherCity, city)
    pushToast(`Tiempo actualizado a ${city}`)
  }

  const togglePinnedBookmark = async (bookmarkId: string) => {
    const isPinned = pinnedBookmarkIds.includes(bookmarkId)
    const nextPinned = isPinned
      ? pinnedBookmarkIds.filter((id) => id !== bookmarkId)
      : [...pinnedBookmarkIds, bookmarkId]

    setPinnedBookmarkIds(nextPinned)
    await storageSet(STORAGE_KEYS.pinnedBookmarks, nextPinned)

    const bookmark = allBookmarks.find((item) => item.id === bookmarkId)
    pushToast(isPinned ? `Quitado de fijados: ${bookmark?.title || 'marcador'}` : `Fijado: ${bookmark?.title || 'marcador'}`)
  }

  const resetDragState = () => {
    setActiveBookmarkDrag(null)
    setActiveFolderDragId(null)
  }

  const reorderVisibleBookmarks = async (activeId: string, overId: string) => {
    if (!browserChrome?.bookmarks?.move) return

    const items = quickLinks
    const oldIndex = items.findIndex((item) => item.id === activeId)
    const newIndex = items.findIndex((item) => item.id === overId)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(items, oldIndex, newIndex)
    const moved = reordered[newIndex]

    await browserChrome.bookmarks.move(moved.id, {
      parentId: selectedFolderId,
      index: newIndex,
    })

    await loadBookmarks()
    pushToast('Orden de marcadores actualizado')
  }

  const moveBookmarkToFolder = async (bookmarkId: string, targetFolderId: string) => {
    if (!browserChrome?.bookmarks?.move || targetFolderId === selectedFolderId) return

    const targetFolder = folders.find((folder) => folder.id === targetFolderId)

    await browserChrome.bookmarks.move(bookmarkId, {
      parentId: targetFolderId,
    })

    setSelectedFolderId(targetFolderId)
    await loadBookmarks()
    pushToast(`Marcador movido a ${targetFolder?.title || 'otra carpeta'}`)
  }

  const reorderFolders = async (activeSortId: string, overSortId: string) => {
    if (!browserChrome?.bookmarks?.move) return

    const activeFolderId = activeSortId.replace('folder-sort-', '')
    const overFolderId = overSortId.replace('folder-sort-', '')
    const oldIndex = folders.findIndex((folder) => folder.id === activeFolderId)
    const newIndex = folders.findIndex((folder) => folder.id === overFolderId)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(folders, oldIndex, newIndex)
    const moved = reordered[newIndex]

    await browserChrome.bookmarks.move(moved.id, { parentId: '1', index: newIndex })
    await loadBookmarks()
    pushToast('Orden de carpetas actualizado')
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    const activeType = active.data.current?.type

    if (!over || !browserChrome?.bookmarks?.move) {
      resetDragState()
      return
    }

    const activeId = String(active.id)
    const overId = String(over.id)

    try {
      if (activeType === 'bookmark' && overId.startsWith('move-folder-')) {
        await moveBookmarkToFolder(activeId, overId.replace('move-folder-', ''))
        return
      }

      if (activeType === 'bookmark' && activeId !== overId && canReorderBookmarks) {
        await reorderVisibleBookmarks(activeId, overId)
        return
      }

      if (activeType === 'folder' && activeId !== overId && overId.startsWith('folder-sort-')) {
        await reorderFolders(activeId, overId)
      }
    } finally {
      resetDragState()
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    const activeType = event.active.data.current?.type

    if (activeType === 'bookmark') {
      setActiveBookmarkDrag(event.active.data.current?.bookmark as FlatBookmark)
      setActiveFolderDragId(null)
      return
    }

    if (activeType === 'folder') {
      setActiveFolderDragId(event.active.data.current?.folderId as string)
      setActiveBookmarkDrag(null)
    }
  }

  const handleDragCancel = () => {
    resetDragState()
  }

  const closeConfigPanel = () => {
    setConfigPanelOpen(false)
  }

  const exitOrganizeMode = () => {
    setOrganizeMode(false)
    setConfigPanelOpen(false)
    setEditingFolderId(null)
    setEditingBookmark(null)
    setFormError(null)
  }

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey) && !isTypingTarget(event.target)) {
        event.preventDefault()
        searchInputRef.current?.focus({ preventScroll: true })
        return
      }

      if (
        (event.key === 'n' || event.key === 'N') &&
        event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isTypingTarget(event.target)
      ) {
        event.preventDefault()
        openCreateModal('folder')
        return
      }

      if (
        (event.key === 'n' || event.key === 'N') &&
        !event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isTypingTarget(event.target)
      ) {
        event.preventDefault()
        openCreateModal('bookmark')
        return
      }

      if (hasSearchResults && event.key === 'ArrowDown' && event.target === searchInputRef.current) {
        event.preventDefault()
        setSearchResultIndex((previous) => (previous + 1) % quickLinks.length)
        return
      }

      if (hasSearchResults && event.key === 'ArrowUp' && event.target === searchInputRef.current) {
        event.preventDefault()
        setSearchResultIndex((previous) => (previous - 1 + quickLinks.length) % quickLinks.length)
        return
      }

      if (search.trim() && event.key === 'Enter' && event.target === searchInputRef.current) {
        event.preventDefault()
        if (!openResultForActiveSearch()) {
          window.location.href = buildBrowserSearchUrl(search.trim())
        }
        return
      }

      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !isTypingTarget(event.target)) {
        event.preventDefault()
        searchInputRef.current?.focus({ preventScroll: true })
        return
      }

      if (event.key !== 'Escape') return

      if (createModalOpen) {
        event.preventDefault()
        closeCreateModal()
        return
      }

      if (editingBookmark) {
        event.preventDefault()
        setEditingBookmark(null)
        setFormError(null)
        return
      }

      if (editingFolderId) {
        event.preventDefault()
        setEditingFolderId(null)
        setEditingFolderTitle('')
        setFormError(null)
        return
      }

      if (configPanelOpen) {
        event.preventDefault()
        exitOrganizeMode()
        return
      }

      if (organizeMode) {
        event.preventDefault()
        exitOrganizeMode()
        return
      }

      if (weatherEditorOpen) {
        event.preventDefault()
        setWeatherEditorOpen(false)
        setWeatherDraft(weatherCity)
        setWeatherError(null)
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [
    createModalOpen,
    editingBookmark,
    editingFolderId,
    configPanelOpen,
    organizeMode,
    weatherEditorOpen,
    weatherCity,
    closeCreateModal,
    exitOrganizeMode,
    search,
    hasSearchResults,
    quickLinks.length,
    openCreateModal,
    openResultForActiveSearch,
  ])

  useEffect(() => {
    if (!configPanelOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!settingsPopoverRef.current) return
      if (target instanceof Node && !settingsPopoverRef.current.contains(target)) {
        closeConfigPanel()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [configPanelOpen])

  return (
    <main className="app-shell">
      <div
        className={`wallpaper ${wallpaperReady ? 'is-ready' : 'is-preview'}`}
        style={{
          ...getWallpaperStyle(wallpaper),
          filter: wallpaperReady ? wallpaperFilter : `${wallpaperFilter === 'none' ? '' : `${wallpaperFilter} `}blur(10px) saturate(1.08)`,
        }}
      />
      <div className="gradient-overlay" />

      <section className="dashboard">
        <header className="topbar topbar-clean">
          <div className="topbar-spacer" />
          <div className="topbar-right">
            <div className="topbar-meta">{activeFolderLabel} · {visibleBookmarks.length} links</div>
            {organizeMode ? (
              <button
                type="button"
                className="secondary-button organize-done-button"
                onClick={exitOrganizeMode}
              >
                Listo
              </button>
            ) : null}
            <div className="settings-popover-wrap" ref={settingsPopoverRef}>
              <button
                type="button"
                className={`settings-gear ${configPanelOpen ? 'is-active' : ''}`}
                onClick={() => {
                  if (configPanelOpen) {
                    exitOrganizeMode()
                    return
                  }
                  setConfigPanelOpen(true)
                  setOrganizeMode(true)
                }}
                aria-label="Abrir ajustes"
                aria-expanded={configPanelOpen}
              >
                <span className="settings-gear-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                    <path
                      d="M12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
                      fill="currentColor"
                    />
                    <path
                      d="M19.4 12a7.05 7.05 0 0 0 .05-.96 7.05 7.05 0 0 0-.05-.96l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1c-.5-.4-1.04-.72-1.64-.96l-.38-2.65A.5.5 0 0 0 14 1.5h-4a.5.5 0 0 0-.5.43l-.38 2.65a7.1 7.1 0 0 0-1.64.96l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65a7.05 7.05 0 0 0-.05.96 7.05 7.05 0 0 0 .05.96l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.15.26.48.36.75.22l2.49-1a7.1 7.1 0 0 0 1.64.96l.38 2.65a.5.5 0 0 0 .5.43h4a.5.5 0 0 0 .5-.43l.38-2.65a7.1 7.1 0 0 0 1.64-.96l2.49 1c.27.1.6 0 .75-.22l2-3.46a.5.5 0 0 0-.12-.64L19.4 12Z"
                      fill="currentColor"
                      opacity="0.7"
                    />
                  </svg>
                </span>
              </button>

              {configPanelOpen ? (
                <section className="settings-popover glass-card widget-card form-widget config-panel-card">
                  <p className="eyebrow">Configuración</p>
                  <h3>Ajustes y widgets</h3>
                  <p>Personaliza la vista y gestiona exportación, importación y widgets.</p>

                  <div className="config-actions">
                    <button type="button" className="secondary-button" onClick={() => void handleExportConfig()}>
                      Exportar configuración
                    </button>
                    <label className="upload-button">
                      <input type="file" accept="application/json" onChange={(event) => void handleImportConfig(event)} />
                      Importar configuración
                    </label>
                  </div>

                  {organizeMode && widgetVisibility.wallpaperPanel ? (
                    <WallpaperPanel
                      wallpaper={wallpaper}
                      wallpaperBlur={wallpaperBlur}
                      wallpapers={WALLPAPER_PRESETS}
                      isCustomWallpaper={isCustomWallpaper(wallpaper)}
                      onSelectPreset={handleWallpaperPreset}
                      onUpload={handleWallpaperChange}
                      onReset={handleWallpaperReset}
                      onBlurChange={handleWallpaperBlurChange}
                    />
                  ) : null}

                  <div className="widget-toggle-list">
                    <label className="widget-toggle">
                      <input
                        type="checkbox"
                        checked={widgetVisibility.wallpaperPanel}
                        onChange={(event) => void handleWidgetVisibilityChange('wallpaperPanel', event.target.checked)}
                      />
                      <span>Mostrar panel de wallpaper en organizar</span>
                    </label>
                    <label className="widget-toggle">
                      <input
                        type="checkbox"
                        checked={widgetVisibility.weatherWidget}
                        onChange={(event) => void handleWidgetVisibilityChange('weatherWidget', event.target.checked)}
                      />
                      <span>Mostrar widget del tiempo</span>
                    </label>
                    <label className="widget-toggle">
                      <input
                        type="checkbox"
                        checked={widgetVisibility.pinnedWidget}
                        onChange={(event) => void handleWidgetVisibilityChange('pinnedWidget', event.target.checked)}
                      />
                      <span>Mostrar widget fijados</span>
                    </label>
                    <label className="widget-toggle">
                      <input
                        type="checkbox"
                        checked={widgetVisibility.noteWidget}
                        onChange={(event) => void handleWidgetVisibilityChange('noteWidget', event.target.checked)}
                      />
                      <span>Mostrar nota rápida</span>
                    </label>
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </header>

        <section className="hero">
          <p className="greeting">{greeting}</p>
          <h1>{timeLabel}</h1>
          <p className="date-label">{dateLabel}</p>

          <SearchBar
            activeFolderLabel={activeFolderLabel}
            value={search}
            searchInputRef={searchInputRef}
            onChange={setSearch}
            onSubmit={handleSearchSubmit}
            onFocus={() => setSearchResultIndex(0)}
          />
        </section>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={(event) => void handleDragEnd(event)}
        >
          <SortableContext items={folders.map((folder) => `folder-sort-${folder.id}`)} strategy={horizontalListSortingStrategy}>
            <section className={`folder-row ${activeBookmarkDrag ? 'is-dragging-bookmark' : ''} ${activeFolderDragId ? 'is-dragging-folder' : ''}`}>
              {folders.map((folder) => (
                <FolderPill
                  key={folder.id}
                  folder={folder}
                  isActive={selectedFolderId === folder.id}
                  canManageBookmarks={canManageBookmarks}
                  organizeMode={organizeMode}
                  isEditing={editingFolderId === folder.id}
                  editingFolderTitle={editingFolderTitle}
                  onSelect={setSelectedFolderId}
                  onStartRename={startRenameFolder}
                  onDelete={(id, title) => void handleDeleteFolder(id, title)}
                  onRenameSubmit={(event) => void handleRenameFolder(event)}
                  onRenameChange={setEditingFolderTitle}
                  onRenameCancel={() => setEditingFolderId(null)}
                />
              ))}
              <button type="button" className="folder-add-pill" onClick={() => openCreateModal('bookmark')} title="Añadir">
                +
              </button>
            </section>
          </SortableContext>

          <section className="content-grid">
            <div className="main-column glass-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">{search.trim() ? 'Resultados globales' : 'Marcadores'}</p>
                  <h2>{search.trim() ? `Buscar: ${search.trim()}` : activeFolderLabel}</h2>
                </div>
              </div>

              {loading ? <div className="notice">Cargando marcadores…</div> : null}
              {error ? <div className="notice error">{error}</div> : null}

              <SortableContext items={quickLinks.map((bookmark) => bookmark.id)} strategy={rectSortingStrategy}>
                <div className="shortcut-grid">
                  {quickLinks.map((bookmark, index) => (
                    <ShortcutCard
                      key={bookmark.id}
                      bookmark={bookmark}
                      canManageBookmarks={canManageBookmarks}
                      isPinned={pinnedBookmarkIds.includes(bookmark.id)}
                      organizeMode={organizeMode}
                      sortable={canReorderBookmarks}
                      isHighlighted={search.trim().length > 0 && searchResultIndex === index}
                      onHover={() => setSearchResultIndex(index)}
                      onDelete={(id) => void handleDeleteBookmark(id)}
                      onEdit={startEditBookmark}
                      onTogglePin={(id) => void togglePinnedBookmark(id)}
                    />
                  ))}
                </div>
              </SortableContext>

              {!loading && visibleBookmarks.length === 0 ? (
                <div className="empty-state">
                  <h3>No hay marcadores</h3>
                  <p>Crea uno nuevo para empezar.</p>
                </div>
              ) : null}

              {organizeMode && activeBookmarkDrag ? (
                <MoveTray
                  folders={folders}
                  selectedFolderId={selectedFolderId}
                  activeFolderId={activeBookmarkDrag.parentId}
                  activeBookmarkTitle={activeBookmarkDrag.title}
                />
              ) : null}
            </div>

            <aside className="side-column">
              {!search.trim() && pinnedBookmarks.length && widgetVisibility.pinnedWidget ? (
                <section className="glass-card widget-card pinned-side-widget">
                  <div className="pinned-strip-head">
                    <p className="eyebrow">Fijados</p>
                    <span>{pinnedBookmarks.length}</span>
                  </div>

                  <div className="pinned-icon-row pinned-icon-row-side">
                    {pinnedBookmarks.map((bookmark) => (
                      <article key={bookmark.id} className="pinned-icon-card" title={bookmark.title}>
                        <a href={bookmark.url} className="pinned-icon-link">
                          <div className="shortcut-icon pinned-icon-only">
                            {getFavicon(bookmark.url) ? <img src={getFavicon(bookmark.url)} alt="" /> : <span>{bookmarkHost(bookmark.url).slice(0, 1).toUpperCase()}</span>}
                          </div>
                          <span className="pinned-icon-label">{bookmark.title}</span>
                        </a>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {widgetVisibility.weatherWidget ? (
                <section className="glass-card widget-card weather-widget">
                  <div className="weather-head">
                    <p className="eyebrow">Tiempo</p>
                    <button
                      type="button"
                      className="weather-city-button"
                      onClick={() => {
                        setWeatherEditorOpen((open) => !open)
                        setWeatherDraft(weatherCity)
                        setWeatherError(null)
                      }}
                    >
                      {weatherEditorOpen ? 'Cerrar' : 'Cambiar ciudad'}
                    </button>
                  </div>

                  {weatherEditorOpen ? (
                    <form className="weather-form weather-form-expanded" onSubmit={(event) => void handleWeatherSubmit(event)}>
                      <input
                        value={weatherDraft}
                        onChange={(event) => setWeatherDraft(event.target.value)}
                        placeholder="Ciudad"
                        autoFocus
                      />
                      <div className="weather-form-actions">
                        <button type="submit">Guardar</button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            setWeatherEditorOpen(false)
                            setWeatherDraft(weatherCity)
                            setWeatherError(null)
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {weather ? (
                    <>
                      <h3>{weather.city}</h3>
                      <div className="weather-main">
                        <span className="weather-emoji">{weatherEmoji(weather.weatherCode)}</span>
                        <strong>{weather.temperature}°</strong>
                      </div>
                      <p>{weatherLabel(weather.weatherCode)}</p>
                      <p>Máx {weather.tempMax}° · Mín {weather.tempMin}°</p>
                      <div className="weather-forecast-mini weather-forecast-grid">
                        {weather.forecast.map((day, index) => (
                          <div key={day.date}>
                            <span>{getForecastDayLabel(day.date, index)}</span>
                            <strong>{weatherEmoji(day.weatherCode)} {day.tempMax}°</strong>
                            <small>Mín {day.tempMin}°</small>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : weatherError ? (
                    <p>{weatherError}</p>
                  ) : weatherLoading ? (
                    <p>Cargando previsión…</p>
                  ) : (
                    <p>Cargando tiempo…</p>
                  )}
                </section>
              ) : null}

              {widgetVisibility.noteWidget ? (
                <section className="glass-card widget-card form-widget">
                  <p className="eyebrow">Quick note</p>
                  <textarea className="note-input" value={note} onChange={(event) => void handleNoteChange(event.target.value)} placeholder="Escribe una nota rápida..." />
                </section>
              ) : null}


              {editingBookmark ? (
                <section className="glass-card widget-card form-widget">
                  <p className="eyebrow">Editar marcador</p>
                  <form onSubmit={(event) => void handleSaveBookmark(event)} className="stack-form">
                    <input value={editingBookmark.title} onChange={(event) => setEditingBookmark({ ...editingBookmark, title: event.target.value })} placeholder="Título" />
                    <input value={editingBookmark.url} onChange={(event) => { setEditingBookmark({ ...editingBookmark, url: event.target.value }); setFormError(null) }} placeholder="youtube.com o https://youtube.com" type="text" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
                    <select className="folder-select" value={editingBookmark.parentId || selectedFolderId} onChange={(event) => setEditingBookmark({ ...editingBookmark, parentId: event.target.value })}>
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>{folder.title}</option>
                      ))}
                    </select>
                    {formError ? <p className="form-error">{formError}</p> : null}
                    <div className="dual-actions">
                      <button type="submit">Guardar cambios</button>
                      <button type="button" className="secondary-button" onClick={() => { setEditingBookmark(null); setFormError(null) }}>Cancelar</button>
                    </div>
                  </form>
                </section>
              ) : null}
            </aside>
          </section>

          <DragOverlay>
            {activeBookmarkDrag ? (
              <article className="shortcut-card shortcut-card-overlay">
                <div className="shortcut-link">
                  <div className="shortcut-icon">
                    {getFavicon(activeBookmarkDrag.url) ? <img src={getFavicon(activeBookmarkDrag.url)} alt="" /> : <span>{bookmarkHost(activeBookmarkDrag.url).slice(0, 1).toUpperCase()}</span>}
                  </div>
                  <div className="shortcut-copy">
                    <strong>{activeBookmarkDrag.title}</strong>
                    <small>{bookmarkHost(activeBookmarkDrag.url)}</small>
                  </div>
                </div>
              </article>
            ) : null}
          </DragOverlay>
        </DndContext>

        {createModalOpen ? (
          <div className="modal-backdrop" onClick={closeCreateModal}>
            <div className="modal-card glass-card" onClick={(event) => event.stopPropagation()}>
              <div className="modal-head">
                <div className="modal-tabs">
                  <button
                    type="button"
                    className={`modal-tab ${createMode === 'bookmark' ? 'is-active' : ''}`}
                    onClick={() => { setCreateMode('bookmark'); setFormError(null) }}
                  >
                    Marcador
                  </button>
                  <button
                    type="button"
                    className={`modal-tab ${createMode === 'folder' ? 'is-active' : ''}`}
                    onClick={() => { setCreateMode('folder'); setFormError(null) }}
                  >
                    Carpeta
                  </button>
                </div>
                <button type="button" className="modal-close" onClick={closeCreateModal}>×</button>
              </div>

              <div className="modal-choice-grid">
                <button type="button" className={`modal-choice-card ${createMode === 'bookmark' ? 'is-active' : ''}`} onClick={() => { setCreateMode('bookmark'); setFormError(null) }}>
                  <strong>Nuevo marcador</strong>
                  <span>Título y enlace</span>
                </button>
                <button type="button" className={`modal-choice-card ${createMode === 'folder' ? 'is-active' : ''}`} onClick={() => { setCreateMode('folder'); setFormError(null) }}>
                  <strong>Nueva carpeta</strong>
                  <span>Organiza tus accesos</span>
                </button>
              </div>

              {createMode === 'folder' ? (
                <form className="modal-form" onSubmit={(event) => void handleCreateFolder(event)}>
                  <p className="eyebrow">Nueva carpeta</p>
                  <input
                    value={newFolderName}
                    onChange={(event) => { setNewFolderName(event.target.value); setFormError(null) }}
                    placeholder="Ej. IA"
                    autoFocus
                  />
                  {formError ? <p className="form-error">{formError}</p> : null}
                  <button type="submit">Crear carpeta</button>
                </form>
              ) : (
                <form className="modal-form" onSubmit={(event) => void handleCreateBookmark(event)}>
                  <p className="eyebrow">Nuevo marcador</p>
                  <input
                    value={newBookmarkTitle}
                    onChange={(event) => setNewBookmarkTitle(event.target.value)}
                    placeholder="Título"
                    autoFocus
                  />
                  <input
                    value={newBookmarkUrl}
                    onChange={(event) => { setNewBookmarkUrl(event.target.value); setFormError(null) }}
                    placeholder="youtube.com o https://youtube.com"
                    type="text"
                    inputMode="url"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  {formError ? <p className="form-error">{formError}</p> : null}
                  <button type="submit" disabled={!selectedFolderId}>Guardar marcador</button>
                </form>
              )}
            </div>
          </div>
        ) : null}

        {editingBookmark ? (
          <div className="modal-backdrop" onClick={() => { setEditingBookmark(null); setFormError(null) }}>
            <div className="modal-card glass-card" onClick={(event) => event.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">Editar marcador</p>
                </div>
                <button type="button" className="modal-close" onClick={() => { setEditingBookmark(null); setFormError(null) }}>×</button>
              </div>
              <form onSubmit={(event) => void handleSaveBookmark(event)} className="modal-form">
                <input value={editingBookmark.title} onChange={(event) => setEditingBookmark({ ...editingBookmark, title: event.target.value })} placeholder="Título" autoFocus />
                <input value={editingBookmark.url} onChange={(event) => { setEditingBookmark({ ...editingBookmark, url: event.target.value }); setFormError(null) }} placeholder="youtube.com o https://youtube.com" type="text" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
                <select className="folder-select" value={editingBookmark.parentId || selectedFolderId} onChange={(event) => setEditingBookmark({ ...editingBookmark, parentId: event.target.value })}>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>{folder.title}</option>
                  ))}
                </select>
                {formError ? <p className="form-error">{formError}</p> : null}
                <div className="dual-actions">
                  <button type="submit">Guardar cambios</button>
                  <button type="button" className="secondary-button" onClick={() => { setEditingBookmark(null); setFormError(null) }}>Cancelar</button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        <Toast toast={toast} />
      </section>
    </main>
  )
}

export default App
