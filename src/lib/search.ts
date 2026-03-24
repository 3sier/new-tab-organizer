export type SearchableItem = {
  title: string
  url: string
}

const MAX_SEARCH_FUZZY_DISTANCE = 3

export const SEARCH_RESULT_LIMIT = 12

function normalizeSearchText(raw: string) {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function splitSearchTerms(query: string) {
  return normalizeSearchText(query).split(/\s+/).filter(Boolean)
}

function levenshteinDistance(leftRaw: string, rightRaw: string, maxDistance: number) {
  const left = leftRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const right = rightRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  if (Math.abs(left.length - right.length) > maxDistance) return maxDistance + 1
  if (left.length === 0) return Math.min(right.length, maxDistance + 1)
  if (right.length === 0) return Math.min(left.length, maxDistance + 1)

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1]
    let rowMin = Number.POSITIVE_INFINITY

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const insertion = current[rightIndex] + 1
      const deletion = previous[rightIndex + 1] + 1
      const substitution = previous[rightIndex] + (left[leftIndex] === right[rightIndex] ? 0 : 1)
      const distance = Math.min(insertion, deletion, substitution)
      current.push(distance)
      if (distance < rowMin) rowMin = distance
    }

    previous = current

    if (rowMin > maxDistance) return maxDistance + 1
  }

  return previous[right.length]
}

function scoreSearchTokenMatch(value: string, query: string, queryTerms: string[]) {
  const normalizedValue = normalizeSearchText(value)
  if (!normalizedValue) return 0

  let score = 0
  let matchedTerms = 0

  if (normalizedValue === query) {
    score += 140
    matchedTerms = queryTerms.length
  } else {
    if (normalizedValue.startsWith(query)) {
      score += 95
      matchedTerms += 1
    } else if (normalizedValue.includes(query)) {
      const index = normalizedValue.indexOf(query)
      score += 70 - Math.min(55, index)
    }
  }

  const tokens = normalizedValue
    .replace(/^https?:\/\//, '')
    .split(/[\s/._\-?&=#:;,@+%]+/)
    .filter(Boolean)

  for (const term of queryTerms) {
    let termMatched = false
    let termScore = 0

    for (const token of tokens) {
      if (token === term) {
        termMatched = true
        termScore = 52
        break
      }

      if (token.startsWith(term)) {
        termMatched = true
        termScore = Math.max(termScore, 32)
        break
      }
    }

    if (!termMatched && term.length >= 3) {
      for (const token of tokens) {
        if (!token || Math.abs(token.length - term.length) > MAX_SEARCH_FUZZY_DISTANCE) continue

        const distance = levenshteinDistance(token, term, MAX_SEARCH_FUZZY_DISTANCE)
        if (distance <= MAX_SEARCH_FUZZY_DISTANCE) {
          const distanceScore = 28 - distance * 8
          if (distanceScore > termScore) termScore = distanceScore
          if (distance <= 2) termMatched = true
        }
      }
    }

    if (termScore > 0) score += termScore
    if (termMatched) matchedTerms += 1
  }

  if (queryTerms.length > 1 && matchedTerms === queryTerms.length) {
    score += 18
  }

  return score
}

export function bookmarkHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function getSearchScore(bookmark: SearchableItem, query: string) {
  const queryTerms = splitSearchTerms(query)
  if (!queryTerms.length) return 0

  const normalizedQuery = normalizeSearchText(query)
  const normalizedHost = normalizeSearchText(bookmarkHost(bookmark.url))
  const normalizedUrl = normalizeSearchText(bookmark.url)

  const titleScore = scoreSearchTokenMatch(bookmark.title, normalizedQuery, queryTerms) * 1.6
  const hostScore = scoreSearchTokenMatch(normalizedHost, normalizedQuery, queryTerms) * 1.35
  const urlScore = scoreSearchTokenMatch(normalizedUrl, normalizedQuery, queryTerms) * 0.85

  return titleScore + hostScore + urlScore
}

export function buildBrowserSearchUrl(query: string) {
  return `https://search.brave.com/search?q=${encodeURIComponent(query)}`
}
