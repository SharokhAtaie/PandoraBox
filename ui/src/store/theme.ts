import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type FontFamily = 'system' | 'jetbrains' | 'fira-code' | 'cascadia' | 'monospace'
export type FontSize = 'xs' | 'sm' | 'md' | 'lg'
export type AccentColor = 'teal' | 'blue' | 'purple' | 'orange' | 'red' | 'green'

interface ThemeStore {
  fontFamily: FontFamily
  fontSize: FontSize
  accentColor: AccentColor
  setFontFamily: (f: FontFamily) => void
  setFontSize: (s: FontSize) => void
  setAccentColor: (c: AccentColor) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      fontFamily: 'jetbrains',
      fontSize: 'sm',
      accentColor: 'teal',
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setFontSize: (fontSize) => set({ fontSize }),
      setAccentColor: (accentColor) => set({ accentColor }),
    }),
    { name: 'pitok-theme' }
  )
)

// CSS variable maps
export const fontFamilyMap: Record<FontFamily, string> = {
  system: 'ui-sans-serif, system-ui, sans-serif',
  jetbrains: "'JetBrains Mono', monospace",
  'fira-code': "'Fira Code', monospace",
  cascadia: "'Cascadia Code', monospace",
  monospace: 'monospace',
}

export const fontSizeMap: Record<FontSize, string> = {
  xs: '11px',
  sm: '12px',
  md: '13px',
  lg: '14px',
}

// HSL values for accent colors
export const accentColorMap: Record<AccentColor, string> = {
  teal: '174 72% 46%',
  blue: '214 84% 56%',
  purple: '262 83% 64%',
  orange: '25 95% 53%',
  red: '0 72% 51%',
  green: '142 71% 45%',
}
