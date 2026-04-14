import { useEffect, useState } from 'react'

export function useClock(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(interval)
  }, [intervalMs])

  return now
}
