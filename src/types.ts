export type BookmarkNode = chrome.bookmarks.BookmarkTreeNode

export type CreateMode = 'folder' | 'bookmark'
export type ToastTone = 'success' | 'error' | 'info'

export type WeatherData = {
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

export type WidgetVisibility = {
  wallpaperPanel: boolean
  weatherWidget: boolean
  pinnedWidget: boolean
  noteWidget: boolean
}

export type ToastState = {
  id: number
  message: string
  tone: ToastTone
}

export type FlatBookmark = {
  id: string
  title: string
  url: string
  parentId?: string
  parentTitle?: string
}

export type FolderItem = {
  id: string
  title: string
  childrenCount: number
}

export type EditingBookmarkState = {
  id: string
  title: string
  url: string
  parentId?: string
}

export type FolderScrollbarState = {
  visible: boolean
  thumbWidth: number
  thumbOffset: number
}

export const DEFAULT_WIDGET_VISIBILITY: WidgetVisibility = {
  wallpaperPanel: true,
  weatherWidget: true,
  pinnedWidget: true,
  noteWidget: true,
}
