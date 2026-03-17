import { useEffect, useMemo, useState } from 'react'
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

type BookmarkNode = chrome.bookmarks.BookmarkTreeNode

type ChromeLike = typeof globalThis & {
  chrome?: typeof chrome
}

type CreateMode = 'folder' | 'bookmark'

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

const browserChrome = (globalThis as ChromeLike).chrome
const STORAGE_KEYS = {
  wallpaper: 'newtab.wallpaper',
  note: 'newtab.note',
  weatherCity: 'newtab.weatherCity',
  pinnedBookmarks: 'newtab.pinnedBookmarks',
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
  onDelete: (id: string) => void
  onEdit: (bookmark: FlatBookmark) => void
  onTogglePin: (bookmarkId: string) => void
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

function bookmarkHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
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

function buildBrowserSearchUrl(query: string) {
  return `https://search.brave.com/search?q=${encodeURIComponent(query)}`
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

async function storageGet(key: string): Promise<string> {
  if (!browserChrome?.storage?.local) return ''
  const result = await browserChrome.storage.local.get(key)
  const value = result[key]
  return typeof value === 'string' ? value : ''
}

async function storageGetStringArray(key: string): Promise<string[]> {
  if (!browserChrome?.storage?.local) return []
  const result = await browserChrome.storage.local.get(key)
  const value = result[key]
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

async function storageSet(key: string, value: string | string[]) {
  if (!browserChrome?.storage?.local) return
  await browserChrome.storage.local.set({ [key]: value })
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

function ShortcutCard({ bookmark, canManageBookmarks, isPinned, organizeMode, sortable, onDelete, onEdit, onTogglePin }: ShortcutCardProps) {
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
    <article ref={setNodeRef} style={style} className={`shortcut-card ${organizeMode ? 'is-organize' : ''}`}>
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
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')
  const [search, setSearch] = useState('')
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
  const [now, setNow] = useState(() => new Date())
  const [wallpaper, setWallpaper] = useState('')
  const [note, setNote] = useState('Termina la home, limpia el layout y deja todo bonito.')
  const [pinnedBookmarkIds, setPinnedBookmarkIds] = useState<string[]>([])
  const [activeBookmarkDrag, setActiveBookmarkDrag] = useState<FlatBookmark | null>(null)
  const [activeFolderDragId, setActiveFolderDragId] = useState<string | null>(null)

  const canManageBookmarks = Boolean(browserChrome?.bookmarks)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    void (async () => {
      const [savedWallpaper, savedNote, savedWeatherCity, savedPinnedBookmarks] = await Promise.all([
        storageGet(STORAGE_KEYS.wallpaper),
        storageGet(STORAGE_KEYS.note),
        storageGet(STORAGE_KEYS.weatherCity),
        storageGetStringArray(STORAGE_KEYS.pinnedBookmarks),
      ])

      if (savedWallpaper) setWallpaper(savedWallpaper)
      if (savedNote) setNote(savedNote)
      if (savedWeatherCity) {
        setWeatherCity(savedWeatherCity)
        setWeatherDraft(savedWeatherCity)
      }
      if (savedPinnedBookmarks.length) setPinnedBookmarkIds(savedPinnedBookmarks)
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

  const loadBookmarks = async () => {
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
  }

  useEffect(() => {
    void loadBookmarks()
  }, [])

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

  const selectedFolder = useMemo(
    () => (selectedFolderId ? findFolderById(tree, selectedFolderId) : null),
    [tree, selectedFolderId],
  )

  const folderBookmarks = useMemo(() => {
    return selectedFolder ? flattenBookmarks(selectedFolder.children, selectedFolder.id, selectedFolder.title) : []
  }, [selectedFolder])

  const bookmarkMatches = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return []

    return allBookmarks.filter((bookmark) => {
      const title = bookmark.title.toLowerCase()
      const url = bookmark.url.toLowerCase()
      const host = bookmarkHost(bookmark.url).toLowerCase()
      return title.includes(query) || url.includes(query) || host.includes(query)
    })
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
  const quickLinks = visibleBookmarks.slice(0, 12)
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

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault()
    const query = search.trim()
    if (!query) return

    const exactMatch = bookmarkMatches.find((bookmark) => {
      const normalized = query.toLowerCase()
      return (
        bookmark.title.toLowerCase() === normalized ||
        bookmark.url.toLowerCase() === normalized ||
        bookmarkHost(bookmark.url).toLowerCase() === normalized
      )
    })

    const firstMatch = exactMatch || bookmarkMatches[0]

    if (firstMatch) {
      window.location.href = firstMatch.url
      return
    }

    window.location.href = buildBrowserSearchUrl(query)
  }

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
  }

  const handleCreateBookmark = async (event: FormEvent) => {
    event.preventDefault()
    const title = newBookmarkTitle.trim()
    const normalizedUrl = normalizeUrl(newBookmarkUrl)

    if (!normalizedUrl) {
      setFormError('Pon una URL válida. Si escribes youtube.com, yo le añado https://.')
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
  }

  const handleDeleteBookmark = async (id: string) => {
    if (!canManageBookmarks || !browserChrome) return
    await browserChrome.bookmarks.remove(id)
    await loadBookmarks()
  }

  const handleDeleteFolder = async (folderId: string, folderTitle: string) => {
    if (!canManageBookmarks || !browserChrome) return
    const confirmed = window.confirm(`¿Borrar la carpeta "${folderTitle}" y todo lo que contiene?`)
    if (!confirmed) return
    await browserChrome.bookmarks.removeTree(folderId)
    if (selectedFolderId === folderId) setSelectedFolderId('')
    await loadBookmarks()
  }

  const startRenameFolder = (folder: FolderItem) => {
    setEditingFolderId(folder.id)
    setEditingFolderTitle(folder.title)
  }

  const handleRenameFolder = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingFolderId || !editingFolderTitle.trim() || !canManageBookmarks || !browserChrome) return
    await browserChrome.bookmarks.update(editingFolderId, { title: editingFolderTitle.trim() })
    setEditingFolderId(null)
    setEditingFolderTitle('')
    await loadBookmarks()
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
  }

  const handleWallpaperChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      setWallpaper(result)
      await storageSet(STORAGE_KEYS.wallpaper, result)
    }
    reader.readAsDataURL(file)
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
  }

  const togglePinnedBookmark = async (bookmarkId: string) => {
    const nextPinned = pinnedBookmarkIds.includes(bookmarkId)
      ? pinnedBookmarkIds.filter((id) => id !== bookmarkId)
      : [...pinnedBookmarkIds, bookmarkId]

    setPinnedBookmarkIds(nextPinned)
    await storageSet(STORAGE_KEYS.pinnedBookmarks, nextPinned)
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
  }

  const moveBookmarkToFolder = async (bookmarkId: string, targetFolderId: string) => {
    if (!browserChrome?.bookmarks?.move || targetFolderId === selectedFolderId) return

    await browserChrome.bookmarks.move(bookmarkId, {
      parentId: targetFolderId,
    })

    setSelectedFolderId(targetFolderId)
    await loadBookmarks()
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

  const exitOrganizeMode = () => {
    setOrganizeMode(false)
    setEditingFolderId(null)
    setEditingBookmark(null)
    setFormError(null)
  }

  return (
    <main className="app-shell">
      <div className="wallpaper" style={wallpaper ? { backgroundImage: `url(${wallpaper})` } : undefined} />
      <div className="gradient-overlay" />

      <section className="dashboard">
        <header className="topbar topbar-clean">
          <div className="topbar-spacer" />
          <div className="topbar-right">
            <div className="topbar-meta">{activeFolderLabel} · {visibleBookmarks.length} links</div>
            <button
              type="button"
              className={`organize-toggle ${organizeMode ? 'is-active' : ''}`}
              onClick={() => (organizeMode ? exitOrganizeMode() : setOrganizeMode(true))}
            >
              {organizeMode ? 'Listo' : 'Organizar'}
            </button>
          </div>
        </header>

        <section className="hero">
          <p className="greeting">{greeting}</p>
          <h1>{timeLabel}</h1>
          <p className="date-label">{dateLabel}</p>

          <form className="search-wrap glass-card" onSubmit={handleSearchSubmit}>
            <input className="search-input" type="search" placeholder={`Busca en ${activeFolderLabel.toLowerCase()}...`} value={search} onChange={(event) => setSearch(event.target.value)} />
          </form>
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
                  {quickLinks.map((bookmark) => (
                    <ShortcutCard
                      key={bookmark.id}
                      bookmark={bookmark}
                      canManageBookmarks={canManageBookmarks}
                      isPinned={pinnedBookmarkIds.includes(bookmark.id)}
                      organizeMode={organizeMode}
                      sortable={canReorderBookmarks}
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
              {organizeMode ? (
                <section className="glass-card widget-card hero-widget">
                  <p className="eyebrow">Ambiente</p>
                  <h3>Personaliza el fondo</h3>
                  <p>Sube una imagen y conviértelo en tu dashboard personal.</p>
                  <label className="upload-button">
                    <input type="file" accept="image/*" onChange={handleWallpaperChange} />
                    Elegir wallpaper
                  </label>
                </section>
              ) : null}

              {!search.trim() && pinnedBookmarks.length ? (
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

              <section className="glass-card widget-card form-widget">
                <p className="eyebrow">Quick note</p>
                <textarea className="note-input" value={note} onChange={(event) => void handleNoteChange(event.target.value)} placeholder="Escribe una nota rápida..." />
              </section>

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
      </section>
    </main>
  )
}

export default App
