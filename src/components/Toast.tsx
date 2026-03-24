type ToastState = {
  id: number
  message: string
  tone: 'success' | 'error' | 'info'
}

type ToastProps = {
  toast: ToastState | null
}

export function Toast({ toast }: ToastProps) {
  if (!toast) return null

  return (
    <div className={`toast toast-${toast.tone}`} role="status" aria-live="polite">
      {toast.message}
    </div>
  )
}
