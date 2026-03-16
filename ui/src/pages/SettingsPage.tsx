import { api } from '@/api/client'
import { useThemeStore } from '@/store/theme'
import type { FontFamily, FontSize, AccentColor } from '@/store/theme'
import { Download } from 'lucide-react'
import { cn } from '@/lib/utils'

const fontFamilyOptions: { value: FontFamily; label: string }[] = [
  { value: 'system', label: 'System UI' },
  { value: 'jetbrains', label: 'JetBrains Mono' },
  { value: 'fira-code', label: 'Fira Code' },
  { value: 'cascadia', label: 'Cascadia Code' },
  { value: 'monospace', label: 'Monospace (browser default)' },
]

const fontSizeOptions: { value: FontSize; label: string }[] = [
  { value: 'xs', label: '11px (Compact)' },
  { value: 'sm', label: '12px (Default)' },
  { value: 'md', label: '13px (Comfortable)' },
  { value: 'lg', label: '14px (Large)' },
]

const accentColors: { value: AccentColor; hsl: string; label: string }[] = [
  { value: 'teal', hsl: '174 72% 46%', label: 'Teal' },
  { value: 'blue', hsl: '214 84% 56%', label: 'Blue' },
  { value: 'purple', hsl: '262 83% 64%', label: 'Purple' },
  { value: 'orange', hsl: '25 95% 53%', label: 'Orange' },
  { value: 'red', hsl: '0 72% 51%', label: 'Red' },
  { value: 'green', hsl: '142 71% 45%', label: 'Green' },
]

export function SettingsPage() {
  const { fontFamily, fontSize, accentColor, setFontFamily, setFontSize, setAccentColor } = useThemeStore()

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 overflow-auto h-full">
      <h1 className="text-lg font-semibold">Settings</h1>

      {/* Appearance */}
      <section className="bg-card rounded-lg border border-border p-4 space-y-5">
        <h2 className="text-sm font-medium">Appearance</h2>

        {/* Accent color */}
        <div>
          <label className="text-xs text-muted-foreground block mb-2">Accent Color</label>
          <div className="flex gap-2">
            {accentColors.map((c) => (
              <button
                key={c.value}
                onClick={() => setAccentColor(c.value)}
                title={c.label}
                className={cn(
                  'w-7 h-7 rounded-full border-2 transition-all',
                  accentColor === c.value ? 'border-foreground scale-110' : 'border-transparent'
                )}
                style={{ backgroundColor: `hsl(${c.hsl})` }}
              />
            ))}
          </div>
        </div>

        {/* Font family */}
        <div>
          <label className="text-xs text-muted-foreground block mb-2">Font Family</label>
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value as FontFamily)}
            className="w-full text-sm bg-input border border-border rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {fontFamilyOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: fontFamily === 'system' ? 'system-ui' : `var(--font-mono)` }}>
            Preview: The quick brown fox jumps over the lazy dog
          </p>
        </div>

        {/* Font size */}
        <div>
          <label className="text-xs text-muted-foreground block mb-2">Font Size</label>
          <div className="flex gap-2 flex-wrap">
            {fontSizeOptions.map((o) => (
              <button
                key={o.value}
                onClick={() => setFontSize(o.value)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs border transition-colors',
                  fontSize === o.value
                    ? 'bg-primary/20 text-primary border-primary/40'
                    : 'bg-muted text-muted-foreground border-border hover:text-foreground'
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* CA Certificate */}
      <section className="bg-card rounded-lg border border-border p-4 space-y-4">
        <h2 className="text-sm font-medium">CA Certificate</h2>
        <p className="text-sm text-muted-foreground">
          Install the PitokMonitor CA certificate in your browser to intercept HTTPS traffic.
        </p>

        <div className="flex gap-2">
          <a
            href={api.ca.certUrl()}
            download="pitokmonitor-ca.crt"
            className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
          >
            <Download size={14} />
            Download CA Certificate
          </a>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 text-xs text-amber-300 space-y-1">
          <div className="font-medium">If Chrome still shows "Not Secure" after installing:</div>
          <ol className="ml-3 space-y-1 list-decimal list-inside">
            <li>Open Keychain Access → System keychain (not Login)</li>
            <li>Find "PitokMonitor CA" → double-click</li>
            <li>Expand "Trust" → set "When using this certificate" to <strong>Always Trust</strong></li>
            <li>Close &amp; enter your password when prompted</li>
            <li>Restart Chrome completely (Cmd+Q, not just close window)</li>
          </ol>
          <div className="mt-2 font-medium">If the cert was generated before today, regenerate it:</div>
          <code className="block bg-black/30 rounded px-2 py-1 font-mono text-xs mt-1">
            ./pitokmonitor ca regenerate
          </code>
          <div className="text-xs text-muted-foreground mt-1">Then re-download and re-install the new cert.</div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Browser Installation</div>
          <InstallStep
            title="macOS (Chrome / Edge / Safari)"
            steps={[
              'Download the .crt file above',
              'Double-click it → it opens Keychain Access',
              'IMPORTANT: Change destination to "System" keychain (not "login")',
              'Enter your password',
              'Find "PitokMonitor CA" in System keychain → double-click',
              'Expand "Trust" → "When using this certificate: Always Trust"',
              'Restart the browser completely',
            ]}
          />
          <InstallStep
            title="Firefox (all platforms)"
            steps={[
              'Settings → Privacy & Security → Certificates → View Certificates',
              'Authorities tab → Import → select pitokmonitor-ca.crt',
              'Check "Trust this CA to identify websites"',
            ]}
          />
          <InstallStep
            title="Windows (Chrome / Edge)"
            steps={[
              'Double-click pitokmonitor-ca.crt → Install Certificate',
              'Select "Local Machine" → Next',
              'Place in "Trusted Root Certification Authorities"',
              'Restart browser',
            ]}
          />
          <InstallStep
            title="Linux (Chrome)"
            steps={[
              'chrome://settings/certificates → Authorities → Import',
              'Select pitokmonitor-ca.crt',
              'Check "Trust this certificate for identifying websites"',
            ]}
          />
        </div>
      </section>

      {/* Proxy config */}
      <section className="bg-card rounded-lg border border-border p-4 space-y-2">
        <h2 className="text-sm font-medium">Proxy Configuration</h2>
        <p className="text-sm text-muted-foreground">
          Configure your browser or system to use{' '}
          <code className="font-mono text-primary bg-muted px-1 rounded">127.0.0.1:8080</code> as the HTTP/HTTPS proxy.
        </p>
        <p className="text-sm text-muted-foreground">
          MCP server (SSE) at{' '}
          <code className="font-mono text-primary bg-muted px-1 rounded">http://localhost:9090/sse</code>
        </p>
      </section>
    </div>
  )
}

function InstallStep({ title, steps }: { title: string; steps: string[] }) {
  return (
    <details className="group">
      <summary className="cursor-pointer text-sm text-foreground/80 hover:text-foreground py-1 select-none">
        {title}
      </summary>
      <ol className="mt-1 ml-4 space-y-1">
        {steps.map((s, i) => (
          <li key={i} className="text-xs text-muted-foreground list-decimal list-inside">{s}</li>
        ))}
      </ol>
    </details>
  )
}
