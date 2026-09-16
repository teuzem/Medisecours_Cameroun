'use client'

import { type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Trash2, ShieldX, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Modal from './Modal'
import Button from './Button'

const TYPES: Record<string, { icon: any; iconClass: string; bgClass: string }> = {
  danger: {
    icon: Trash2,
    iconClass: 'text-urgence-500',
    bgClass: 'bg-urgence-50 dark:bg-urgence-500/10',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-amber-500',
    bgClass: 'bg-amber-50 dark:bg-amber-500/10',
  },
  success: {
    icon: CheckCircle2,
    iconClass: 'text-mint-500',
    bgClass: 'bg-mint-50 dark:bg-mint-500/10',
  },
  validate: {
    icon: ShieldCheck,
    iconClass: 'text-mint-500',
    bgClass: 'bg-mint-50 dark:bg-mint-500/10',
  },
  invalidate: {
    icon: ShieldX,
    iconClass: 'text-urgence-500',
    bgClass: 'bg-urgence-50 dark:bg-urgence-500/10',
  },
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'warning',
  confirmText,
  cancelText,
  isLoading = false,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => any
  title: string
  message: string
  type?: string
  confirmText?: string
  cancelText?: string
  isLoading?: boolean
}) {
  const { t } = useTranslation()
  const config = TYPES[type] || TYPES.warning
  const Icon = config.icon

  const handleConfirm = async () => {
    await onConfirm()
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
            {cancelText || t('visitor.components.confirmModal.cancel')}
          </Button>
          <Button
            variant={type === 'danger' || type === 'invalidate' ? 'danger' : 'primary'}
            size="sm"
            onClick={handleConfirm}
            isLoading={isLoading}
          >
            {confirmText || t('visitor.components.confirmModal.confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl ${config.bgClass}`}>
          <Icon className={`w-6 h-6 ${config.iconClass}`} />
        </div>
        <div className="flex-1">
          <p className="text-sm text-primary-700 dark:text-sable whitespace-pre-line">
            {message}
          </p>
        </div>
      </div>
    </Modal>
  )
}
