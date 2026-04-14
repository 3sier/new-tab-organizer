import type { FormEvent } from 'react'
import type { CreateMode, FolderItem } from '../types'

type CreateDialogProps = {
  mode: CreateMode
  folders: FolderItem[]
  selectedFolderId: string
  newFolderName: string
  newBookmarkTitle: string
  newBookmarkUrl: string
  formError: string | null
  onClose: () => void
  onModeChange: (mode: CreateMode) => void
  onFolderNameChange: (value: string) => void
  onBookmarkTitleChange: (value: string) => void
  onBookmarkUrlChange: (value: string) => void
  onCreateFolder: (event: FormEvent) => void
  onCreateBookmark: (event: FormEvent) => void
}

export function CreateDialog({
  mode,
  selectedFolderId,
  newFolderName,
  newBookmarkTitle,
  newBookmarkUrl,
  formError,
  onClose,
  onModeChange,
  onFolderNameChange,
  onBookmarkTitleChange,
  onBookmarkUrlChange,
  onCreateFolder,
  onCreateBookmark,
}: CreateDialogProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card glass-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-tabs">
            <button
              type="button"
              className={`modal-tab ${mode === 'bookmark' ? 'is-active' : ''}`}
              onClick={() => onModeChange('bookmark')}
            >
              Marcador
            </button>
            <button
              type="button"
              className={`modal-tab ${mode === 'folder' ? 'is-active' : ''}`}
              onClick={() => onModeChange('folder')}
            >
              Carpeta
            </button>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-choice-grid">
          <button
            type="button"
            className={`modal-choice-card ${mode === 'bookmark' ? 'is-active' : ''}`}
            onClick={() => onModeChange('bookmark')}
          >
            <strong>Nuevo marcador</strong>
            <span>Título y enlace</span>
          </button>
          <button
            type="button"
            className={`modal-choice-card ${mode === 'folder' ? 'is-active' : ''}`}
            onClick={() => onModeChange('folder')}
          >
            <strong>Nueva carpeta</strong>
            <span>Organiza tus accesos</span>
          </button>
        </div>

        {mode === 'folder' ? (
          <form className="modal-form" onSubmit={onCreateFolder}>
            <p className="eyebrow">Nueva carpeta</p>
            <input
              value={newFolderName}
              onChange={(event) => onFolderNameChange(event.target.value)}
              placeholder="Ej. IA"
              autoFocus
            />
            {formError ? <p className="form-error">{formError}</p> : null}
            <button type="submit">Crear carpeta</button>
          </form>
        ) : (
          <form className="modal-form" onSubmit={onCreateBookmark}>
            <p className="eyebrow">Nuevo marcador</p>
            <input
              value={newBookmarkTitle}
              onChange={(event) => onBookmarkTitleChange(event.target.value)}
              placeholder="Título"
              autoFocus
            />
            <input
              value={newBookmarkUrl}
              onChange={(event) => onBookmarkUrlChange(event.target.value)}
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
  )
}
