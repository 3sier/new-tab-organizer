import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, PointerEvent as ReactPointerEvent, WheelEvent } from 'react'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
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
} from '@dnd-kit/sortable'
import './App.css'
import { SearchBar } from './components/SearchBar'
import { Toast } from './components/Toast'
import { ShortcutCard } from './components/ShortcutCard'
import { FolderPill } from './components/FolderPill'
import { MoveTray } from './components/MoveTray'
import { NoteWidget } from './components/NoteWidget'
import { PinnedWidget } from './components/PinnedWidget'
import { WeatherWidget } from './components/WeatherWidget'
import { SettingsPopover } from './components/SettingsPopover'
import { CreateDialog } from './components/CreateDialog'
import { EditDialog } from './components/EditDialog'
import { useClock } from './hooks/useClock'
import { useWeather } from './hooks/useWeather'
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
import {
  collectFolders,
  FALLBACK_TREE,
  findFolderById,
  flattenBookmarks,
  getFavicon,
  normalizeUrl,
} from './lib/bookmarks'
import type {
  BookmarkNode,
  CreateMode,
  EditingBookmarkState,
  FlatBookmark,
  FolderItem,
  FolderScrollbarState,
  ToastState,
  ToastTone,
  WidgetVisibility,
} from './types'
import { DEFAULT_WIDGET_VISIBILITY } from './types'
import {
  buildExportPayload,
  buildBookmarkUrlIndex,
  normalizeForMatch,
  parseConfigPayload,
  resolveImportedRefs,
  type ConfigPayload,
  type ExportedNode,
} from './lib/config'

function getGreeting(hour: number) {
  if (hour < 6) return 'Buenas noches'
  if (hour < 12) return 'Buenos días'
  if (hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

const WIDGET_VISIBILITY_STORAGE_KEYS: Record<keyof WidgetVisibility, string> = {
  wallpaperPanel: STORAGE_KEYS.widgetShowWallpaperPanel,
  weatherWidget: STORAGE_KEYS.widgetShowWeatherWidget,
  pinnedWidget: STORAGE_KEYS.widgetShowPinnedWidget,
  noteWidget: STORAGE_KEYS.widgetShowNoteWidget,
}

function isTypingTarget(element: EventTarget | null): boolean {
  if (!(element instanceof HTMLElement)) return false
  if (element.isContentEditable) return true
  return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT'
}


function App() {
  const [tree, setTree] = useState<BookmarkNode[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string>(getStoredFolderFromLocalStorage)
  const [search, setSearch] = useState('')
  const [searchResultIndex, setSearchResultIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const folderRowRef = useRef<HTMLElement>(null)
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
  const { weather, error: weatherError, loading: weatherLoading, setError: setWeatherError } = useWeather(weatherCity)
  const [weatherEditorOpen, setWeatherEditorOpen] = useState(false)
  const [configPanelOpen, setConfigPanelOpen] = useState(false)
  const now = useClock()
  const [wallpaper, setWallpaper] = useState(getInitialWallpaper)
  const [wallpaperBlur, setWallpaperBlur] = useState(0)
  const [widgetVisibility, setWidgetVisibility] = useState<WidgetVisibility>(DEFAULT_WIDGET_VISIBILITY)
  const [note, setNote] = useState('Termina la home, limpia el layout y deja todo bonito.')
  const [pinnedBookmarkIds, setPinnedBookmarkIds] = useState<string[]>([])
  const [activeBookmarkDrag, setActiveBookmarkDrag] = useState<FlatBookmark | null>(null)
  const [activeFolderDragId, setActiveFolderDragId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [wallpaperReady, setWallpaperReady] = useState(() => !getWallpaperPreviewFromLocalStorage())
  const [folderScrollbar, setFolderScrollbar] = useState<FolderScrollbarState>({
    visible: false,
    thumbWidth: 0,
    thumbOffset: 0,
  })

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

  const loadBookmarks = useCallback(async (): Promise<BookmarkNode[]> => {
    setLoading(true)
    setError(null)

    try {
      if (browserChrome?.bookmarks?.getTree) {
        const root = await browserChrome.bookmarks.getTree()
        setTree(root)
        return root
      }
      setTree(FALLBACK_TREE)
      return FALLBACK_TREE
    } catch (err) {
      setError('No se pudieron cargar los marcadores.')
      setTree(FALLBACK_TREE)
      console.error(err)
      return FALLBACK_TREE
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

  const updateFolderScrollbar = useCallback(() => {
    const row = folderRowRef.current
    if (!row) return

    const maxScroll = row.scrollWidth - row.clientWidth
    if (maxScroll <= 1) {
      setFolderScrollbar((current) => (
        current.visible || current.thumbWidth !== 0 || current.thumbOffset !== 0
          ? { visible: false, thumbWidth: 0, thumbOffset: 0 }
          : current
      ))
      return
    }

    const thumbWidth = Math.max(72, Math.round((row.clientWidth * row.clientWidth) / row.scrollWidth))
    const maxOffset = Math.max(0, row.clientWidth - thumbWidth)
    const thumbOffset = Math.round((row.scrollLeft / maxScroll) * maxOffset)

    setFolderScrollbar((current) => (
      current.visible === true
      && current.thumbWidth === thumbWidth
      && current.thumbOffset === thumbOffset
        ? current
        : { visible: true, thumbWidth, thumbOffset }
    ))
  }, [])

  useEffect(() => {
    const row = folderRowRef.current
    if (!row) return undefined

    updateFolderScrollbar()
    row.addEventListener('scroll', updateFolderScrollbar, { passive: true })

    const resizeObserver = new ResizeObserver(() => updateFolderScrollbar())
    resizeObserver.observe(row)
    window.addEventListener('resize', updateFolderScrollbar)

    return () => {
      row.removeEventListener('scroll', updateFolderScrollbar)
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateFolderScrollbar)
    }
  }, [updateFolderScrollbar])

  useEffect(() => {
    updateFolderScrollbar()
  }, [updateFolderScrollbar, folders, organizeMode, editingFolderId, selectedFolderId, quickLinks.length])

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

  const resetCreateForm = useCallback(() => {
    setNewFolderName('')
    setNewBookmarkTitle('')
    setNewBookmarkUrl('')
    setFormError(null)
  }, [])

  const openCreateModal = useCallback((mode: CreateMode) => {
    setCreateMode(mode)
    setCreateModalOpen(true)
    setFormError(null)
  }, [])

  const closeCreateModal = useCallback(() => {
    setCreateModalOpen(false)
    resetCreateForm()
  }, [resetCreateForm])

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
    const payload = buildExportPayload({
      wallpaper: wallpaperValue,
      wallpaperBlur,
      note,
      weatherCity,
      pinnedBookmarkIds,
      selectedFolderId,
      widgetVisibility,
      tree,
    })

    downloadConfig(payload)
    pushToast('Configuración exportada')
  }

  const handleImportConfig = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const raw = await file.text()
      const parsed = parseConfigPayload(JSON.parse(raw))

      if (!parsed) {
        throw new Error('Formato de configuración incorrecto')
      }

      const nextWidgetVisibility = {
        ...widgetVisibility,
        ...parsed.widgetVisibility,
      }

      setWallpaperBlur(parsed.wallpaperBlur)
      await storageSet(STORAGE_KEYS.wallpaperBlur, parsed.wallpaperBlur)

      setNote(parsed.note)
      await storageSet(STORAGE_KEYS.note, parsed.note)

      setWeatherCity(parsed.weatherCity)
      setWeatherDraft(parsed.weatherCity)
      await storageSet(STORAGE_KEYS.weatherCity, parsed.weatherCity)

      setWidgetVisibility(nextWidgetVisibility)
      await Promise.all(Object.keys(nextWidgetVisibility).map((key) => storageSet(
        WIDGET_VISIBILITY_STORAGE_KEYS[key as keyof WidgetVisibility],
        nextWidgetVisibility[key as keyof WidgetVisibility],
      )))

      setWallpaperReady(false)
      await setStoredWallpaper(parsed.wallpaper)
      const resolvedWallpaper = await getStoredWallpaper().catch(() => parsed.wallpaper)
      setWallpaper(resolvedWallpaper || parsed.wallpaper)
      setWallpaperReady(true)

      let freshTree = await loadBookmarks()
      const counts = { folders: 0, bookmarks: 0 }

      if (browserChrome?.bookmarks?.create && parsed.bookmarksTree.length) {
        const urlIndex = buildBookmarkUrlIndex(freshTree)

        const processChildren = async (nodes: ExportedNode[], parentId: string) => {
          const existing = await browserChrome.bookmarks.getChildren(parentId)
          const folderByTitle = new Map<string, chrome.bookmarks.BookmarkTreeNode>()
          for (const e of existing) {
            if (!e.url) folderByTitle.set(e.title, e)
          }

          for (const child of nodes) {
            if (child.type === 'folder') {
              let match = folderByTitle.get(child.title)
              if (!match) {
                try {
                  match = await browserChrome.bookmarks.create({ parentId, title: child.title })
                  counts.folders += 1
                  folderByTitle.set(child.title, match)
                } catch (err) {
                  console.error('No se pudo crear carpeta importada', child.title, err)
                  continue
                }
              }
              await processChildren(child.children, match.id)
            } else {
              const key = normalizeForMatch(child.url)
              if (urlIndex.has(key)) continue
              try {
                await browserChrome.bookmarks.create({
                  parentId,
                  title: child.title || child.url,
                  url: child.url,
                })
                urlIndex.set(key, 'imported')
                counts.bookmarks += 1
              } catch (err) {
                console.error('No se pudo crear marcador importado', child.url, err)
              }
            }
          }
        }

        for (const root of parsed.bookmarksTree) {
          const rootExists = Boolean(findFolderById(freshTree, root.rootId))
          const targetId = rootExists ? root.rootId : '1'
          await processChildren(root.children, targetId)
        }

        if (counts.folders || counts.bookmarks) {
          freshTree = await loadBookmarks()
        }
      }

      const resolved = resolveImportedRefs(parsed, freshTree, selectedFolderId)

      setPinnedBookmarkIds(resolved.pinnedBookmarkIds)
      await storageSet(STORAGE_KEYS.pinnedBookmarks, resolved.pinnedBookmarkIds)

      if (resolved.selectedFolderId) {
        setSelectedFolderId(resolved.selectedFolderId)
        await persistSelectedFolder(resolved.selectedFolderId)
      }

      const missingPins = parsed.pinnedBookmarks.length - resolved.pinnedBookmarkIds.length
      const folderMissing = parsed.selectedFolderPath.length > 0 && !resolved.selectedFolderId
      const notes: string[] = []
      if (counts.folders) notes.push(`${counts.folders} carpeta(s) creadas`)
      if (counts.bookmarks) notes.push(`${counts.bookmarks} marcador(es) creados`)
      if (missingPins > 0) notes.push(`${missingPins} pin(s) no resueltos`)
      if (folderMissing) notes.push('carpeta activa no encontrada')
      if (notes.length) {
        pushToast(`Configuración importada (${notes.join(', ')})`, 'info')
      } else {
        pushToast('Configuración importada')
      }
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

  const handleFolderRowWheel = (event: WheelEvent<HTMLElement>) => {
    const row = event.currentTarget
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
    if (row.scrollWidth <= row.clientWidth) return

    row.scrollLeft += event.deltaY
    event.preventDefault()
  }

  const handleFolderScrollbarTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return

    const row = folderRowRef.current
    if (!row) return

    const maxScroll = row.scrollWidth - row.clientWidth
    if (maxScroll <= 0) return

    const bounds = event.currentTarget.getBoundingClientRect()
    const clickX = event.clientX - bounds.left
    const maxOffset = Math.max(1, row.clientWidth - folderScrollbar.thumbWidth)
    const centeredOffset = clickX - folderScrollbar.thumbWidth / 2
    const nextOffset = Math.max(0, Math.min(maxOffset, centeredOffset))
    row.scrollLeft = (nextOffset / maxOffset) * maxScroll
  }

  const handleFolderScrollbarThumbPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const row = folderRowRef.current
    if (!row) return

    event.preventDefault()

    const startX = event.clientX
    const startScrollLeft = row.scrollLeft
    const maxScroll = row.scrollWidth - row.clientWidth
    const maxOffset = Math.max(1, row.clientWidth - folderScrollbar.thumbWidth)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX
      const nextScrollLeft = startScrollLeft + (deltaX / maxOffset) * maxScroll
      row.scrollLeft = Math.max(0, Math.min(maxScroll, nextScrollLeft))
    }

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  const exitOrganizeMode = useCallback(() => {
    setOrganizeMode(false)
    setConfigPanelOpen(false)
    setEditingFolderId(null)
    setEditingBookmark(null)
    setFormError(null)
  }, [])

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
    setWeatherError,
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
            <SettingsPopover
              containerRef={settingsPopoverRef}
              open={configPanelOpen}
              organizeMode={organizeMode}
              wallpaper={wallpaper}
              wallpaperBlur={wallpaperBlur}
              wallpapers={WALLPAPER_PRESETS}
              isCustomWallpaper={isCustomWallpaper(wallpaper)}
              widgetVisibility={widgetVisibility}
              onToggleOpen={() => {
                if (configPanelOpen) {
                  exitOrganizeMode()
                  return
                }
                setConfigPanelOpen(true)
                setOrganizeMode(true)
              }}
              onExport={() => void handleExportConfig()}
              onImport={(event) => void handleImportConfig(event)}
              onSelectWallpaperPreset={handleWallpaperPreset}
              onUploadWallpaper={handleWallpaperChange}
              onResetWallpaper={handleWallpaperReset}
              onWallpaperBlurChange={handleWallpaperBlurChange}
              onWidgetVisibilityChange={(key, value) => void handleWidgetVisibilityChange(key, value)}
            />
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
            <div className="folder-row-shell">
              <section
                ref={folderRowRef}
                className={`folder-row ${activeBookmarkDrag ? 'is-dragging-bookmark' : ''} ${activeFolderDragId ? 'is-dragging-folder' : ''}`}
                onWheel={handleFolderRowWheel}
              >
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

              {folderScrollbar.visible ? (
                <div className="folder-row-scrollbar" onPointerDown={handleFolderScrollbarTrackPointerDown}>
                  <button
                    type="button"
                    className="folder-row-scrollbar-thumb"
                    style={{
                      width: `${folderScrollbar.thumbWidth}px`,
                      transform: `translateX(${folderScrollbar.thumbOffset}px)`,
                    }}
                    aria-label="Desplazar carpetas"
                    onPointerDown={handleFolderScrollbarThumbPointerDown}
                  />
                </div>
              ) : null}
            </div>
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
              {!search.trim() && widgetVisibility.pinnedWidget ? (
                <PinnedWidget bookmarks={pinnedBookmarks} />
              ) : null}

              {widgetVisibility.weatherWidget ? (
                <WeatherWidget
                  weather={weather}
                  error={weatherError}
                  loading={weatherLoading}
                  editorOpen={weatherEditorOpen}
                  draft={weatherDraft}
                  city={weatherCity}
                  onToggleEditor={() => {
                    setWeatherEditorOpen((open) => !open)
                    setWeatherDraft(weatherCity)
                    setWeatherError(null)
                  }}
                  onDraftChange={setWeatherDraft}
                  onSubmit={(event) => void handleWeatherSubmit(event)}
                  onCancel={() => {
                    setWeatherEditorOpen(false)
                    setWeatherDraft(weatherCity)
                    setWeatherError(null)
                  }}
                />
              ) : null}

              {widgetVisibility.noteWidget ? (
                <NoteWidget note={note} onChange={(value) => void handleNoteChange(value)} />
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
          <CreateDialog
            mode={createMode}
            folders={folders}
            selectedFolderId={selectedFolderId}
            newFolderName={newFolderName}
            newBookmarkTitle={newBookmarkTitle}
            newBookmarkUrl={newBookmarkUrl}
            formError={formError}
            onClose={closeCreateModal}
            onModeChange={(mode) => { setCreateMode(mode); setFormError(null) }}
            onFolderNameChange={(value) => { setNewFolderName(value); setFormError(null) }}
            onBookmarkTitleChange={(value) => setNewBookmarkTitle(value)}
            onBookmarkUrlChange={(value) => { setNewBookmarkUrl(value); setFormError(null) }}
            onCreateFolder={(event) => void handleCreateFolder(event)}
            onCreateBookmark={(event) => void handleCreateBookmark(event)}
          />
        ) : null}

        {editingBookmark ? (
          <EditDialog
            editingBookmark={editingBookmark}
            folders={folders}
            selectedFolderId={selectedFolderId}
            formError={formError}
            onChange={(value) => setEditingBookmark(value)}
            onUrlChange={(url) => { setEditingBookmark({ ...editingBookmark, url }); setFormError(null) }}
            onSubmit={(event) => void handleSaveBookmark(event)}
            onCancel={() => { setEditingBookmark(null); setFormError(null) }}
          />
        ) : null}

        <Toast toast={toast} />
      </section>
    </main>
  )
}

export default App
