'use client'
import { createContext, useContext, useCallback, useMemo, useState } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

const ToastContext = createContext<any>(null)

let idCounter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<any[]>([])

  const remove = useCallback((id: number) => {
    setToasts((t: any[]) => t.filter((toast: any) => toast.id !== id))
  }, [])

  const push = useCallback((message: string, type = 'info') => {
    const id = ++idCounter
    setToasts((t: any[]) => [...t, { id, message, type }])
    setTimeout(() => remove(id), 4500)
  }, [remove])

  const toast = useMemo(() => ({
    success: (msg: string) => push(msg, 'success'),
    error: (msg: string) => push(msg, 'error'),
    info: (msg: string) => push(msg, 'info'),
  }), [push])

  const icons: Record<string, React.ReactNode> = {
    success: <CheckCircle2 className="w-5 h-5 text-mint-500 shrink-0" />,
    error: <XCircle className="w-5 h-5 text-urgence-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-primary-300 shrink-0" />,
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 sm:w-96">
        {toasts.map((t: any) => (
          <div
            key={t.id}
            className="flex items-start gap-3 bg-white/90 dark:bg-primary-700/90 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-2xl shadow-glass px-4 py-3"
          >
            {icons[t.type]}
            <p className="text-sm flex-1 text-primary-900 dark:text-sable">{t.message}</p>
            <button onClick={() => remove(t.id)} className="text-primary-300 hover:text-primary-700 dark:hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast doit être utilisé dans un ToastProvider')
  return ctx
}
