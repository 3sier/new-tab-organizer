import { useEffect, useState } from 'react'
import type { WeatherData } from '../types'

async function fetchWeather(city: string): Promise<WeatherData> {
  const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es&format=json`)
  const geoJson = await geoRes.json()
  const place = geoJson?.results?.[0]

  if (!place) {
    throw new Error('Ciudad no encontrada')
  }

  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`,
  )
  const weatherJson = await weatherRes.json()

  return {
    city: place.name,
    temperature: Math.round(weatherJson.current.temperature_2m),
    weatherCode: weatherJson.current.weather_code,
    tempMax: Math.round(weatherJson.daily.temperature_2m_max[0]),
    tempMin: Math.round(weatherJson.daily.temperature_2m_min[0]),
    forecast: weatherJson.daily.time.map((date: string, index: number) => ({
      date,
      weatherCode: weatherJson.daily.weather_code[index],
      tempMax: Math.round(weatherJson.daily.temperature_2m_max[index]),
      tempMin: Math.round(weatherJson.daily.temperature_2m_min[index]),
    })),
  }
}

export function useWeather(city: string) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!city) return
    void (async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchWeather(city)
        setWeather(data)
      } catch {
        setWeather(null)
        setError('No se pudo cargar el tiempo')
      } finally {
        setLoading(false)
      }
    })()
  }, [city])

  return { weather, error, loading, setError }
}
