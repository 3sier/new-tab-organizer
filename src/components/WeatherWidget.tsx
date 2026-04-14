import type { FormEvent } from 'react'
import type { WeatherData } from '../types'

type WeatherWidgetProps = {
  weather: WeatherData | null
  error: string | null
  loading: boolean
  editorOpen: boolean
  draft: string
  city: string
  onToggleEditor: () => void
  onDraftChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
  onCancel: () => void
}

function weatherLabel(code: number) {
  if (code === 0) return 'Despejado'
  if ([1, 2, 3].includes(code)) return 'Nubes'
  if ([45, 48].includes(code)) return 'Niebla'
  if ([51, 53, 55, 56, 57].includes(code)) return 'Llovizna'
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Lluvia'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Nieve'
  if ([95, 96, 99].includes(code)) return 'Tormenta'
  return 'Variable'
}

function weatherEmoji(code: number) {
  if (code === 0) return '☀️'
  if ([1, 2, 3].includes(code)) return '⛅'
  if ([45, 48].includes(code)) return '🌫️'
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧️'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️'
  if ([95, 96, 99].includes(code)) return '⛈️'
  return '🌤️'
}

function getForecastDayLabel(date: string, index: number) {
  if (index === 0) return 'Hoy'
  if (index === 1) return 'Mañana'
  return new Date(date).toLocaleDateString('es-ES', { weekday: 'short' })
}

export function WeatherWidget({
  weather,
  error,
  loading,
  editorOpen,
  draft,
  onToggleEditor,
  onDraftChange,
  onSubmit,
  onCancel,
}: WeatherWidgetProps) {
  return (
    <section className="glass-card widget-card weather-widget">
      <div className="weather-head">
        <p className="eyebrow">Tiempo</p>
        <button type="button" className="weather-city-button" onClick={onToggleEditor}>
          {editorOpen ? 'Cerrar' : 'Cambiar ciudad'}
        </button>
      </div>

      {editorOpen ? (
        <form className="weather-form weather-form-expanded" onSubmit={onSubmit}>
          <input
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Ciudad"
            autoFocus
          />
          <div className="weather-form-actions">
            <button type="submit">Guardar</button>
            <button type="button" className="secondary-button" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {weather ? (
        <>
          <h3>{weather.city}</h3>
          <div className="weather-main">
            <span className="weather-emoji">{weatherEmoji(weather.weatherCode)}</span>
            <strong>{weather.temperature}°</strong>
          </div>
          <p>{weatherLabel(weather.weatherCode)}</p>
          <p>Máx {weather.tempMax}° · Mín {weather.tempMin}°</p>
          <div className="weather-forecast-mini weather-forecast-grid">
            {weather.forecast.map((day, index) => (
              <div key={day.date}>
                <span>{getForecastDayLabel(day.date, index)}</span>
                <strong>{weatherEmoji(day.weatherCode)} {day.tempMax}°</strong>
                <small>Mín {day.tempMin}°</small>
              </div>
            ))}
          </div>
        </>
      ) : error ? (
        <p>{error}</p>
      ) : loading ? (
        <p>Cargando previsión…</p>
      ) : (
        <p>Cargando tiempo…</p>
      )}
    </section>
  )
}
