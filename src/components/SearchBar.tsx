import { type FormEvent, type RefObject } from 'react'

type SearchBarProps = {
  activeFolderLabel: string
  value: string
  searchInputRef: RefObject<HTMLInputElement | null>
  onChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
  onFocus: () => void
}

export function SearchBar({
  activeFolderLabel,
  value,
  searchInputRef,
  onChange,
  onSubmit,
  onFocus,
}: SearchBarProps) {
  return (
    <form className="search-wrap glass-card" onSubmit={onSubmit}>
      <input
        ref={searchInputRef}
        className="search-input"
        type="search"
        placeholder={`Busca en ${activeFolderLabel.toLowerCase()}...`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
      />
    </form>
  )
}
