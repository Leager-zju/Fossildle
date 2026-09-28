import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const callback = useRef(onClose)
  callback.current = onClose
  useEffect(() => {
    const dialog = ref.current
    const prior = document.activeElement as HTMLElement | null
    dialog?.showModal()
    const handleCancel = (event: Event) => { event.preventDefault(); callback.current() }
    dialog?.addEventListener('cancel', handleCancel)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.removeEventListener('cancel', handleCancel)
      dialog?.close()
      document.body.style.overflow = previous
      prior?.focus()
    }
  }, [])
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onClick={event => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose() } }}><div className="modal-heading"><div><span className="eyebrow">FOSSILDLE / FIELD STATION</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" aria-label="关闭弹窗" onClick={onClose}><X size={20} /></button></div>{children}</dialog>
}
