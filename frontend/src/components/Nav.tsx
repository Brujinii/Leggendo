type Page = 'home' | 'export' | 'words' | 'notes' | 'settings'

interface Props {
  page: Page
  onNavigate: (page: Page) => void
}

export default function Nav({ page, onNavigate }: Props) {
  const linkStyle = (active: boolean) => ({
    fontFamily: 'DM Mono, monospace',
    fontSize: '0.72rem',
    letterSpacing: '0.08em',
    padding: '5px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    border: 'none',
    background: active ? 'var(--accent-light)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--ink-muted)',
    textTransform: 'uppercase' as const,
    transition: 'all 0.15s',
  })

  return (
    <header
      style={{ borderBottom: '1px solid var(--border)', background: 'var(--panel-bg)' }}
      className="px-8 py-3 flex items-center justify-between sticky top-0 z-50"
    >
      <div style={{
        fontFamily: 'Lora, serif', fontSize: '1.3rem', fontWeight: 600,
        color: 'var(--accent)', letterSpacing: '-0.01em', cursor: 'pointer',
      }} onClick={() => onNavigate('home')}>
        Leggendo
      </div>
      <nav className="flex items-center gap-1">
        <button style={linkStyle(page === 'home')} onClick={() => onNavigate('home')}>Library</button>
        <button style={linkStyle(page === 'words')} onClick={() => onNavigate('words')}>Words</button>
        <button style={linkStyle(page === 'notes')} onClick={() => onNavigate('notes')}>Notes</button>
        <button style={linkStyle(page === 'export')} onClick={() => onNavigate('export')}>Export</button>
        <button style={linkStyle(page === 'settings')} onClick={() => onNavigate('settings')}>Settings</button>
      </nav>
    </header>
  )
}
