import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { FlatBookmark } from '../types'
import { getFavicon } from '../lib/bookmarks'
import { bookmarkHost } from '../lib/search'

export type ShortcutCardProps = {
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

export function ShortcutCard({
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
