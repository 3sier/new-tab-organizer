import { useDroppable } from '@dnd-kit/core'
import type { FolderItem } from '../types'

export type MoveTrayProps = {
  folders: FolderItem[]
  selectedFolderId: string
  activeFolderId?: string
  activeBookmarkTitle: string
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

export function MoveTray({ folders, selectedFolderId, activeFolderId, activeBookmarkTitle }: MoveTrayProps) {
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
