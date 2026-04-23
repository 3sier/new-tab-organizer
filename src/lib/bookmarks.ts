import type { BookmarkNode, FlatBookmark, FolderItem } from '../types'

export function isFolder(node: BookmarkNode) {
  return !node.url
}

const SAFE_PROTOCOLS = new Set([
  'about:',
  'brave:',
  'chrome:',
  'edge:',
  'file:',
  'ftp:',
  'http:',
  'https:',
  'magnet:',
  'mailto:',
  'sms:',
  'tel:',
])

const BLOCKED_PROTOCOLS = new Set([
  'data:',
  'javascript:',
])

const NETWORK_PROTOCOLS = new Set([
  'ftp:',
  'http:',
  'https:',
])

const DOUBLE_SLASH_PROTOCOLS = new Set([
  'http:',
  'https:',
])

function parseProtocol(raw: string): { protocol: string, rest: string } | null {
  const match = raw.match(/^([a-zA-Z][a-zA-Z\d+.-]*):(.*)$/)
  if (!match) return null

  return {
    protocol: `${match[1].toLowerCase()}:`,
    rest: match[2],
  }
}

function getExplicitProtocol(raw: string): string | null {
  const parsedProtocol = parseProtocol(raw)
  if (!parsedProtocol) return null

  const { protocol, rest } = parsedProtocol

  if (rest.startsWith('//')) return protocol
  if (SAFE_PROTOCOLS.has(protocol) || BLOCKED_PROTOCOLS.has(protocol)) return protocol

  return null
}

function isIpAddress(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':')
}

function hasSupportedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  if (!normalized) return false

  return normalized === 'localhost' || normalized.includes('.') || isIpAddress(normalized)
}

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  const parsedProtocol = parseProtocol(trimmed)
  if (
    parsedProtocol
    && DOUBLE_SLASH_PROTOCOLS.has(parsedProtocol.protocol)
    && parsedProtocol.rest.startsWith('/')
    && !parsedProtocol.rest.startsWith('//')
  ) {
    return ''
  }

  const explicitProtocol = getExplicitProtocol(trimmed)
  const withProtocol = explicitProtocol ? trimmed : `https://${trimmed}`

  try {
    const parsed = new URL(withProtocol)
    const protocol = parsed.protocol.toLowerCase()

    if (!SAFE_PROTOCOLS.has(protocol)) return ''
    if (NETWORK_PROTOCOLS.has(protocol) && !hasSupportedHostname(parsed.hostname)) return ''
    if (protocol === 'file:' && !parsed.pathname) return ''

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
