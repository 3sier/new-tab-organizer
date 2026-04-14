import type { ChangeEvent, RefObject } from 'react'
import type { WallpaperPreset } from '../lib/wallpaper'
import { WallpaperPanel } from './WallpaperPanel'
import type { WidgetVisibility } from '../types'

type SettingsPopoverProps = {
  containerRef: RefObject<HTMLDivElement | null>
  open: boolean
  organizeMode: boolean
  wallpaper: string
  wallpaperBlur: number
  wallpapers: readonly WallpaperPreset[]
  isCustomWallpaper: boolean
  widgetVisibility: WidgetVisibility
  onToggleOpen: () => void
  onExport: () => void
  onImport: (event: ChangeEvent<HTMLInputElement>) => void
  onSelectWallpaperPreset: (id: string) => void
  onUploadWallpaper: (event: ChangeEvent<HTMLInputElement>) => void
  onResetWallpaper: () => void
  onWallpaperBlurChange: (value: number) => void
  onWidgetVisibilityChange: (key: keyof WidgetVisibility, value: boolean) => void
}

export function SettingsPopover({
  containerRef,
  open,
  organizeMode,
  wallpaper,
  wallpaperBlur,
  wallpapers,
  isCustomWallpaper,
  widgetVisibility,
  onToggleOpen,
  onExport,
  onImport,
  onSelectWallpaperPreset,
  onUploadWallpaper,
  onResetWallpaper,
  onWallpaperBlurChange,
  onWidgetVisibilityChange,
}: SettingsPopoverProps) {
  return (
    <div className="settings-popover-wrap" ref={containerRef}>
      <button
        type="button"
        className={`settings-gear ${open ? 'is-active' : ''}`}
        onClick={onToggleOpen}
        aria-expanded={open}
        aria-label="Abrir ajustes"
      >
        <span className="settings-gear-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
            <path
              d="M12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
              fill="currentColor"
            />
            <path
              d="M19.4 12a7.05 7.05 0 0 0 .05-.96 7.05 7.05 0 0 0-.05-.96l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1c-.5-.4-1.04-.72-1.64-.96l-.38-2.65A.5.5 0 0 0 14 1.5h-4a.5.5 0 0 0-.5.43l-.38 2.65a7.1 7.1 0 0 0-1.64.96l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65a7.05 7.05 0 0 0-.05.96 7.05 7.05 0 0 0 .05.96l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.15.26.48.36.75.22l2.49-1a7.1 7.1 0 0 0 1.64.96l.38 2.65a.5.5 0 0 0 .5.43h4a.5.5 0 0 0 .5-.43l.38-2.65a7.1 7.1 0 0 0 1.64-.96l2.49 1c.27.1.6 0 .75-.22l2-3.46a.5.5 0 0 0-.12-.64L19.4 12Z"
              fill="currentColor"
              opacity="0.7"
            />
          </svg>
        </span>
      </button>

      {open ? (
        <section className="settings-popover glass-card widget-card form-widget config-panel-card">
          <p className="eyebrow">Configuración</p>
          <h3>Ajustes y widgets</h3>
          <p>Personaliza la vista y gestiona exportación, importación y widgets.</p>

          <div className="config-actions">
            <button type="button" className="secondary-button" onClick={onExport}>
              Exportar configuración
            </button>
            <label className="upload-button">
              <input type="file" accept="application/json" onChange={onImport} />
              Importar configuración
            </label>
          </div>

          {organizeMode && widgetVisibility.wallpaperPanel ? (
            <WallpaperPanel
              wallpaper={wallpaper}
              wallpaperBlur={wallpaperBlur}
              wallpapers={wallpapers}
              isCustomWallpaper={isCustomWallpaper}
              onSelectPreset={onSelectWallpaperPreset}
              onUpload={onUploadWallpaper}
              onReset={onResetWallpaper}
              onBlurChange={onWallpaperBlurChange}
            />
          ) : null}

          <div className="widget-toggle-list">
            <label className="widget-toggle">
              <input
                type="checkbox"
                checked={widgetVisibility.wallpaperPanel}
                onChange={(event) => onWidgetVisibilityChange('wallpaperPanel', event.target.checked)}
              />
              <span>Mostrar panel de wallpaper en organizar</span>
            </label>
            <label className="widget-toggle">
              <input
                type="checkbox"
                checked={widgetVisibility.weatherWidget}
                onChange={(event) => onWidgetVisibilityChange('weatherWidget', event.target.checked)}
              />
              <span>Mostrar widget del tiempo</span>
            </label>
            <label className="widget-toggle">
              <input
                type="checkbox"
                checked={widgetVisibility.pinnedWidget}
                onChange={(event) => onWidgetVisibilityChange('pinnedWidget', event.target.checked)}
              />
              <span>Mostrar widget fijados</span>
            </label>
            <label className="widget-toggle">
              <input
                type="checkbox"
                checked={widgetVisibility.noteWidget}
                onChange={(event) => onWidgetVisibilityChange('noteWidget', event.target.checked)}
              />
              <span>Mostrar nota rápida</span>
            </label>
          </div>
        </section>
      ) : null}
    </div>
  )
}
