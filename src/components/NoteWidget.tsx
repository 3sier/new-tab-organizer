type NoteWidgetProps = {
  note: string
  onChange: (value: string) => void
}

export function NoteWidget({ note, onChange }: NoteWidgetProps) {
  return (
    <section className="glass-card widget-card form-widget">
      <p className="eyebrow">Quick note</p>
      <textarea
        className="note-input"
        value={note}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Escribe una nota rápida..."
      />
    </section>
  )
}
