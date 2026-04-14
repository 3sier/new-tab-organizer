import type { FormEvent } from 'react'
import type { EditingBookmarkState, FolderItem } from '../types'

type EditDialogProps = {
  editingBookmark: EditingBookmarkState
  folders: FolderItem[]
  selectedFolderId: string
  formError: string | null
  onChange: (value: EditingBookmarkState) => void
  onUrlChange: (url: string) => void
  onSubmit: (event: FormEvent) => void
  onCancel: () => void
}

export function EditDialog({
  editingBookmark,
  folders,
  selectedFolderId,
  formError,
  onChange,
  onUrlChange,
  onSubmit,
  onCancel,
}: EditDialogProps) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card glass-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">Editar marcador</p>
          </div>
          <button type="button" className="modal-close" onClick={onCancel}>×</button>
        </div>
        <form onSubmit={onSubmit} className="modal-form">
          <input
            value={editingBookmark.title}
            onChange={(event) => onChange({ ...editingBookmark, title: event.target.value })}
            placeholder="Título"
            autoFocus
          />
          <input
            value={editingBookmark.url}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder="youtube.com o https://youtube.com"
            type="text"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <select
            className="folder-select"
            value={editingBookmark.parentId || selectedFolderId}
            onChange={(event) => onChange({ ...editingBookmark, parentId: event.target.value })}
          >
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>{folder.title}</option>
            ))}
          </select>
          {formError ? <p className="form-error">{formError}</p> : null}
          <div className="dual-actions">
            <button type="submit">Guardar cambios</button>
            <button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
