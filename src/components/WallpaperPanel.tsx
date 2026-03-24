import { type ChangeEvent } from 'react'
import { type WallpaperPreset } from '../lib/wallpaper'

type WallpaperPanelProps = {
  wallpaper: string
  wallpaperBlur: number
  wallpapers: WallpaperPreset[]
  isCustomWallpaper: boolean
  onSelectPreset: (presetId: string) => void
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onReset: () => void
  onBlurChange: (value: number) => void
}

export function WallpaperPanel({
  wallpaper,
  wallpaperBlur,
  wallpapers,
  isCustomWallpaper,
  onSelectPreset,
  onUpload,
  onReset,
  onBlurChange,
}: WallpaperPanelProps) {
  return (
    <section className="glass-card widget-card hero-widget">
      <p className="eyebrow">Ambiente</p>
      <h3>Wallpapers</h3>
      <p>Elige uno predefinido o sube una imagen propia.</p>
      <div className="wallpaper-preset-grid">
        {wallpapers.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`wallpaper-swatch ${wallpaper === preset.id ? 'is-active' : ''}`}
            onClick={() => onSelectPreset(preset.id)}
            title={preset.name}
            style={{ backgroundImage: preset.background }}
          >
            <span>{preset.name}</span>
          </button>
        ))}
      </div>
      <div className="wallpaper-actions">
        <label className="upload-button">
          <input type="file" accept="image/*" onChange={onUpload} />
          Subir wallpaper
        </label>
        {isCustomWallpaper ? (
          <button type="button" className="secondary-button" onClick={onReset}>
            Quitar wallpaper y usar preset
          </button>
        ) : null}
      </div>
      <div className="wallpaper-blur-control">
        <div className="wallpaper-blur-head">
          <span>Blur</span>
          <strong>{wallpaperBlur}px</strong>
        </div>
        <input
          className="wallpaper-blur-slider"
          type="range"
          min="0"
          max="40"
          step="1"
          value={wallpaperBlur}
          onChange={(event) => onBlurChange(Number(event.target.value))}
        />
      </div>
    </section>
  )
}
