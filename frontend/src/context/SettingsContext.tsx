import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { AppSettings } from '../types'

const DEFAULTS: AppSettings = {
  theme: 'sepia',
  defaultSourceLang: 'IT',
  defaultTargetLang: 'EN',
  fontSize: 'md',
  uiFontSize: 'md',
  readerLayout: 'medium',
  ankiNoteType: 'Language Learning Cloze Deletion',
  ankiDeckPrefix: '',
  languageSettings: {
    IT: { mode: 'monolingual' },
    DE: { mode: 'both' },
    TR: { mode: 'both' },
    FR: { mode: 'both' },
    ES: { mode: 'both' },
  },
}

interface SettingsContextType {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULTS,
  updateSettings: () => {},
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem('lector_settings')
      return stored ? { ...DEFAULTS, ...JSON.parse(stored) } : DEFAULTS
    } catch {
      return DEFAULTS
    }
  })

  useEffect(() => {
    localStorage.setItem('lector_settings', JSON.stringify(settings))
    document.documentElement.setAttribute('data-theme', settings.theme)
    document.documentElement.setAttribute('data-fontsize', settings.fontSize)
    document.documentElement.setAttribute('data-uifontsize', settings.uiFontSize || 'md')
  }, [settings])

  const updateSettings = (patch: Partial<AppSettings>) =>
    setSettings(prev => ({ ...prev, ...patch }))

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
