import type { BookmarkNode, FlatBookmark, FolderItem } from '../types'

export function isFolder(node: BookmarkNode) {
  return !node.url
}

export function normalizeUrl(raw: string): string {
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

export function flattenBookmarks(
  nodes: BookmarkNode[] | undefined,
  parentId?: string,
  parentTitle?: string,
): FlatBookmark[] {
  if (!nodes) return []

  return nodes.flatMap((node) => {
    if (node.url) {
      return [{ id: node.id, title: node.title || node.url, url: node.url, parentId, parentTitle }]
    }

    return flattenBookmarks(node.children, node.id, node.title)
  })
}

export function collectFolders(nodes: BookmarkNode[] | undefined): FolderItem[] {
  if (!nodes) return []

  return nodes.flatMap((node) => {
    if (!isFolder(node)) return []

    const current = node.id === '0' || node.id === '1' || node.id === '2'
      ? []
      : [{ id: node.id, title: node.title || 'Untitled folder', childrenCount: node.children?.length ?? 0 }]

    return [...current, ...collectFolders(node.children)]
  })
}

export function findFolderById(
  nodes: BookmarkNode[] | undefined,
  folderId: string,
): BookmarkNode | null {
  if (!nodes) return null

  for (const node of nodes) {
    if (node.id === folderId && isFolder(node)) return node
    const nested = findFolderById(node.children, folderId)
    if (nested) return nested
  }

  return null
}

export function getFolderPath(
  nodes: BookmarkNode[] | undefined,
  folderId: string,
  acc: string[] = [],
): string[] | null {
  if (!nodes) return null

  for (const node of nodes) {
    if (!isFolder(node)) continue
    const nextAcc = [...acc, node.title]
    if (node.id === folderId) return nextAcc
    const nested = getFolderPath(node.children, folderId, nextAcc)
    if (nested) return nested
  }

  return null
}

export function findFolderByPath(
  nodes: BookmarkNode[] | undefined,
  path: string[],
): BookmarkNode | null {
  if (!path.length || !nodes) return null

  const [head, ...rest] = path
  const match = nodes.find((node) => isFolder(node) && node.title === head)
  if (!match) return null
  if (!rest.length) return match
  return findFolderByPath(match.children, rest)
}

export function getFavicon(url: string) {
  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
  } catch {
    return ''
  }
}

export const FALLBACK_TREE: BookmarkNode[] = [
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
