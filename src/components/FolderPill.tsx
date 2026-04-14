import type { FormEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { FolderItem } from '../types'

export type FolderPillProps = {
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

export function FolderPill(props: FolderPillProps) {
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
