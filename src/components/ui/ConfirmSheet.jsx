import BottomSheet from './BottomSheet'

export default function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
}) {
  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="40vh">
      <div className="px-6 py-5 space-y-4">
        <div>
          <h3 className="text-title-2 text-white">{title}</h3>
          {message && <p className="text-callout text-secondary mt-1">{message}</p>}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 surface-2 rounded-xl text-sm font-semibold text-secondary hover:text-primary transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${
              destructive
                ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/20'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
