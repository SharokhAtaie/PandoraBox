import { useEffect } from 'react'
import { useThemeStore, fontFamilyMap, fontSizeMap, accentColorMap } from '@/store/theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { fontFamily, fontSize, accentColor } = useThemeStore()

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--font-mono', fontFamilyMap[fontFamily])
    root.style.setProperty('--font-size-base', fontSizeMap[fontSize])
    root.style.setProperty('--primary', accentColorMap[accentColor])
    root.style.setProperty('--accent', accentColorMap[accentColor])
  }, [fontFamily, fontSize, accentColor])

  return <>{children}</>
}
