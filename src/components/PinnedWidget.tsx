import type { FlatBookmark } from '../types'
import { getFavicon } from '../lib/bookmarks'
import { bookmarkHost } from '../lib/search'

type PinnedWidgetProps = {
  bookmarks: FlatBookmark[]
}

export function PinnedWidget({ bookmarks }: PinnedWidgetProps) {
  if (!bookmarks.length) return null

  return (
    <section className="glass-card widget-card pinned-side-widget">
      <div className="pinned-strip-head">
        <p className="eyebrow">Fijados</p>
        <span>{bookmarks.length}</span>
      </div>

      <div className="pinned-icon-row pinned-icon-row-side">
        {bookmarks.map((bookmark) => (
          <article key={bookmark.id} className="pinned-icon-card" title={bookmark.title}>
            <a href={bookmark.url} className="pinned-icon-link">
              <div className="shortcut-icon pinned-icon-only">
                {getFavicon(bookmark.url) ? (
                  <img src={getFavicon(bookmark.url)} alt="" />
                ) : (
                  <span>{bookmarkHost(bookmark.url).slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <span className="pinned-icon-label">{bookmark.title}</span>
            </a>
          </article>
        ))}
      </div>
    </section>
  )
}
