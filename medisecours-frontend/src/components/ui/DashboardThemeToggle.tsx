'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import { useTranslation } from 'react-i18next'

export default function DashboardThemeToggle() {
  const { dark, toggleTheme } = useTheme()
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="dashboard-icon-button"
      aria-label={dark ? t('visitor.components.themeToggle.enableLight') : t('visitor.components.themeToggle.enableDark')}
      title={dark ? t('visitor.components.themeToggle.light') : t('visitor.components.themeToggle.dark')}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
