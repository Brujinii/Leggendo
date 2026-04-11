import { ALL_LANG_CODES, ALL_LANG_LABELS } from '../lib/languages'
import { useState, useEffect } from 'react'
import { useSettings } from '../context/SettingsContext'

// Dictionary modes available per language.
// "translation"  — DeepL word translation only
// "wiktionary"   — Wiktionary definitions (words lemmatized before lookup when spaCy is available)
// "both"         — DeepL translation + Wiktionary definitions
// "monolingual"  — Native-language Wiktionary / TDK / WordReference
type DictMode = 'translation' | 'wiktionary' | 'both' | 'monolingual'

const DICT_MODE_LABELS: Record<DictMode, string> = {
  translation: 'Translation',
  wiktionary:  'Wiktionary',
  both:        'Both',
  monolingual: 'Monolingual',
}

const DICT_MODE_DESCRIPTIONS: Record<DictMode, string> = {
  translation: 'DeepL word translation only — fast, minimal.',
  wiktionary:  'Wiktionary definitions (English source). Words are lemmatized before lookup when spaCy is available.',
  both:        'DeepL translation + Wiktionary definitions.',
  monolingual: 'Native-language dictionary (Wiktionary, TDK, WordReference). Best once you have a foundation.',
}

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings()

  const sectionStyle = {
    background: 'var(--panel-bg)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '24px',
    marginBottom: '20px',
  }

  const labelStyle = {
    fontSize: '0.7rem',
    fontFamily: 'DM Mono, monospace',
    color: 'var(--ink-muted)',
    letterSpacing: '0.1em',
    display: 'block',
    marginBottom: '8px',
    textTransform: 'uppercase' as const,
  }

  const inputStyle = {
    fontFamily: 'DM Sans, sans-serif',
    fontSize: '0.9rem',
    background: 'var(--paper)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '8px 12px',
    color: 'var(--ink)',
    outline: 'none',
    width: '100%',
  }

  const selectStyle = { ...inputStyle }

  const ToggleBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} style={{
      padding: '8px 18px', borderRadius: '6px',
      border: '1px solid var(--border)',
      background: active ? 'var(--accent)' : 'var(--paper)',
      color: active ? 'white' : 'var(--ink-muted)',
      fontFamily: 'DM Sans, sans-serif', fontSize: '0.875rem',
      cursor: 'pointer', transition: 'all 0.15s',
    }}>{children}</button>
  )

  const currentMode = (code: string): DictMode =>
    (settings.languageSettings?.[code]?.mode as DictMode) || 'both'

  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      <h1 style={{ fontFamily: 'Lora, serif', fontSize: '1.6rem', fontWeight: 600, marginBottom: '28px' }}>
        Settings
      </h1>

      {/* Appearance */}
      <div style={sectionStyle}>
        <h2 style={{ fontFamily: 'Lora, serif', fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
          Appearance
        </h2>
        <div className="flex flex-col gap-5">
          <div>
            <label style={labelStyle}>Theme</label>
            <div className="flex gap-2">
              <ToggleBtn active={settings.theme === 'sepia'} onClick={() => updateSettings({ theme: 'sepia' })}>Sepia</ToggleBtn>
              <ToggleBtn active={settings.theme === 'light'} onClick={() => updateSettings({ theme: 'light' })}>Light</ToggleBtn>
              <ToggleBtn active={settings.theme === 'dark'} onClick={() => updateSettings({ theme: 'dark' })}>Dark</ToggleBtn>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Reader Font Size</label>
            <div className="flex gap-2">
              <ToggleBtn active={settings.fontSize === 'sm'} onClick={() => updateSettings({ fontSize: 'sm' })}>Small</ToggleBtn>
              <ToggleBtn active={settings.fontSize === 'md'} onClick={() => updateSettings({ fontSize: 'md' })}>Medium</ToggleBtn>
              <ToggleBtn active={settings.fontSize === 'lg'} onClick={() => updateSettings({ fontSize: 'lg' })}>Large</ToggleBtn>
            </div>
          </div>
          <div>
            <label style={labelStyle}>UI Font Size</label>
            <div className="flex gap-2">
              <ToggleBtn active={settings.uiFontSize === 'sm'} onClick={() => updateSettings({ uiFontSize: 'sm' })}>Small</ToggleBtn>
              <ToggleBtn active={(settings.uiFontSize ?? 'md') === 'md'} onClick={() => updateSettings({ uiFontSize: 'md' })}>Medium</ToggleBtn>
              <ToggleBtn active={settings.uiFontSize === 'lg'} onClick={() => updateSettings({ uiFontSize: 'lg' })}>Large</ToggleBtn>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: 6 }}>
              Affects all UI elements — navigation, panels, buttons.
            </div>
          </div>
          <div>
            <label style={labelStyle}>Reader Layout</label>
            <div className="flex gap-2">
              <ToggleBtn active={settings.readerLayout === 'narrow'} onClick={() => updateSettings({ readerLayout: 'narrow' })}>Narrow</ToggleBtn>
              <ToggleBtn active={settings.readerLayout === 'medium'} onClick={() => updateSettings({ readerLayout: 'medium' })}>Medium</ToggleBtn>
              <ToggleBtn active={(settings.readerLayout === 'full' || !settings.readerLayout)} onClick={() => updateSettings({ readerLayout: 'full' })}>Full width</ToggleBtn>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: 6 }}>
              Narrow and medium center the text — best for wide monitors.
            </div>
          </div>
        </div>
      </div>

      {/* Language defaults */}
      <div style={sectionStyle}>
        <h2 style={{ fontFamily: 'Lora, serif', fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
          Language Defaults
        </h2>
        <div className="flex gap-6">
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Default text language</label>
            <select value={settings.defaultSourceLang}
              onChange={e => updateSettings({ defaultSourceLang: e.target.value })}
              style={selectStyle}>
              {ALL_LANG_CODES.map(c => <option key={c} value={c}>{ALL_LANG_LABELS[c]}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Default translate to</label>
            <select value={settings.defaultTargetLang}
              onChange={e => updateSettings({ defaultTargetLang: e.target.value })}
              style={selectStyle}>
              {ALL_LANG_CODES.map(c => <option key={c} value={c}>{ALL_LANG_LABELS[c]}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Anki settings */}
      <div style={sectionStyle}>
        <h2 style={{ fontFamily: 'Lora, serif', fontSize: '1rem', fontWeight: 600, marginBottom: '4px' }}>
          Anki Integration
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: '16px' }}>
          These fields are for your reference when importing the CSV into Anki.
        </p>
        <div className="flex flex-col gap-4">
          <div>
            <label style={labelStyle}>Note type name</label>
            <input
              value={settings.ankiNoteType || ''}
              onChange={e => updateSettings({ ankiNoteType: e.target.value })}
              placeholder="Language Learning Cloze Deletion"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Deck name prefix</label>
            <input
              value={settings.ankiDeckPrefix || ''}
              onChange={e => updateSettings({ ankiDeckPrefix: e.target.value })}
              placeholder="e.g. Languages (cards go to Languages::Italian)"
              style={inputStyle}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 6 }}>
              When importing, select the deck manually in Anki's importer.
            </p>
          </div>
          <div style={{ background: 'var(--paper-alt)', borderRadius: 6, padding: '12px 14px' }}>
            <div style={{ fontSize: '0.72rem', fontFamily: 'DM Mono, monospace', color: 'var(--ink-muted)', marginBottom: 6, letterSpacing: '0.08em' }}>
              CSV COLUMN ORDER
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {[
                ['1', 'Target Language', 'Cloze sentence with {{c1::word}}'],
                ['2', 'Known Language', 'Sentence translation'],
                ['3', 'Hint', 'Optional — shown on card front'],
                ['4', 'Notes', 'Shown after answer is revealed'],
                ['5', 'Tags', 'Article tags + leggendo + language'],
              ].map(([num, field, desc]) => (
                <div key={num} style={{ display: 'flex', gap: 10, fontSize: '0.78rem' }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--ink-muted)', width: 16 }}>{num}.</span>
                  <span style={{ fontWeight: 500, minWidth: 120 }}>{field}</span>
                  <span style={{ color: 'var(--ink-muted)' }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Per-language dictionary settings */}
      <div style={sectionStyle}>
        <h2 style={{ fontFamily: 'Lora, serif', fontSize: '1rem', fontWeight: 600, marginBottom: 6 }}>
          Dictionary settings by language
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: 12 }}>
          Choose what appears in the sidebar when you click a word.
          Lemmatization (spaCy) is used automatically when available — clicked words are
          looked up by their dictionary form.
        </p>

        {/* Mode legend */}
        <div style={{ background: 'var(--paper-alt)', borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>
          {(Object.entries(DICT_MODE_LABELS) as [DictMode, string][]).map(([mode, label]) => (
            <div key={mode} style={{ display: 'flex', gap: 10, fontSize: '0.76rem', marginBottom: 4 }}>
              <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--accent)', minWidth: 80 }}>{label}</span>
              <span style={{ color: 'var(--ink-muted)' }}>{DICT_MODE_DESCRIPTIONS[mode]}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ALL_LANG_CODES.map(code => {
            const current = currentMode(code)
            return (
              <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.75rem', width: 28, color: 'var(--ink-muted)' }}>{code}</span>
                <span style={{ fontSize: '0.875rem', flex: 1 }}>{ALL_LANG_LABELS[code]}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(Object.keys(DICT_MODE_LABELS) as DictMode[]).map(mode => (
                    <button key={mode} onClick={() => updateSettings({
                      languageSettings: {
                        ...settings.languageSettings,
                        [code]: { mode },
                      }
                    })} style={{
                      padding: '3px 10px', borderRadius: 4, fontSize: '0.72rem',
                      fontFamily: 'DM Mono, monospace', cursor: 'pointer',
                      border: '1px solid var(--border)',
                      background: current === mode ? 'var(--accent)' : 'transparent',
                      color: current === mode ? 'white' : 'var(--ink-muted)',
                      transition: 'all 0.15s',
                    }}>
                      {DICT_MODE_LABELS[mode]}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Keyboard shortcuts */}
      <div style={sectionStyle}>
        <h2 style={{ fontFamily: 'Lora, serif', fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
          Keyboard Shortcuts
        </h2>
        <div className="flex flex-col gap-2" style={{ fontSize: '0.875rem' }}>
          {[
            ['Click word', 'Look up in dictionary'],
            ['Click + drag', 'Select multiple words'],
            ['L', 'Toggle word as Learning'],
            ['N', 'Add note (uses selection if active, freeform if not)'],
            ['A', 'Add selected text to word bank (Anki)'],
            ['T', 'Translate current sentence'],
            ['Esc', 'Deselect'],
          ].map(([key, desc]) => (
            <div key={key} className="flex items-center gap-3">
              <kbd>{key}</kbd>
              <span style={{ color: 'var(--ink-muted)' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* API Keys */}
      <ApiKeysSection inputStyle={inputStyle} labelStyle={labelStyle} sectionStyle={sectionStyle} />
    </div>
  )
}

function ApiKeysSection({ inputStyle, labelStyle, sectionStyle }: {
  inputStyle: React.CSSProperties
  labelStyle: React.CSSProperties
  sectionStyle: React.CSSProperties
}) {
  const mono = 'DM Mono, monospace'
  const [keyInput, setKeyInput] = useState('')
  const [masked, setMasked] = useState('')
  const [configured, setConfigured] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    fetch('/api/settings/api-keys')
      .then(r => r.json())
      .then(d => { setConfigured(d.deepl_configured); setMasked(d.deepl_key_masked) })
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    if (!keyInput.trim()) return
    setSaving(true); setTestResult(null)
    try {
      await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deepl_api_key: keyInput.trim() }),
      })
      setConfigured(true)
      setMasked('•'.repeat(Math.max(0, keyInput.length - 4)) + keyInput.slice(-4))
      setKeyInput(''); setShowKey(false)
    } finally { setSaving(false) }
  }

  const handleTest = async () => {
    setTesting(true); setTestResult(null)
    try {
      const r = await fetch('/api/settings/api-keys/test')
      const d = await r.json()
      setTestResult({ ok: d.ok, message: d.ok ? `✓ Working — "ciao" → "${d.test_translation}"` : `✕ ${d.error}` })
    } finally { setTesting(false) }
  }

  return (
    <div style={sectionStyle}>
      <h2 style={{ fontFamily: 'Lora, serif', fontSize: '1rem', fontWeight: 600, marginBottom: '6px' }}>
        API Keys
      </h2>
      <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: '18px', lineHeight: 1.5 }}>
        DeepL provides word and sentence translation. Get a free key at{' '}
        <a href="https://www.deepl.com/pro#developer" target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--accent)' }}>deepl.com</a>
        {' '}— the free tier gives 500,000 characters/month.
      </p>

      <div className="flex flex-col gap-4">
        <div>
          <label style={labelStyle}>DeepL API Key</label>
          {configured && !showKey && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontFamily: mono, fontSize: '0.82rem', color: 'var(--ink-muted)', letterSpacing: '0.05em' }}>{masked}</span>
              <span style={{ fontSize: '0.72rem', background: '#34d39922', color: '#34d399', borderRadius: 4, padding: '2px 7px', fontFamily: mono }}>configured</span>
              <button onClick={() => setShowKey(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: mono, fontSize: '0.7rem', color: 'var(--accent)', padding: 0 }}>Change</button>
            </div>
          )}
          {(!configured || showKey) && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                placeholder="Paste your DeepL API key…"
                style={{ ...inputStyle, flex: 1, fontFamily: mono, fontSize: '0.85rem' }} />
              <button onClick={handleSave} disabled={saving || !keyInput.trim()} style={{
                background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6,
                padding: '8px 18px', cursor: keyInput.trim() ? 'pointer' : 'default',
                fontFamily: 'DM Sans, sans-serif', fontSize: '0.875rem', fontWeight: 500,
                opacity: saving || !keyInput.trim() ? 0.5 : 1,
              }}>{saving ? 'Saving…' : 'Save'}</button>
              {showKey && (
                <button onClick={() => { setShowKey(false); setKeyInput('') }} style={{
                  background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
                  padding: '8px 14px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                  fontSize: '0.875rem', color: 'var(--ink-muted)',
                }}>Cancel</button>
              )}
            </div>
          )}
        </div>

        {configured && (
          <div>
            <button onClick={handleTest} disabled={testing} style={{
              background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
              padding: '6px 16px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              fontSize: '0.8rem', color: 'var(--ink-muted)', opacity: testing ? 0.6 : 1,
            }}>{testing ? 'Testing…' : 'Test connection'}</button>
            {testResult && (
              <span style={{ marginLeft: 12, fontSize: '0.8rem', fontFamily: mono, color: testResult.ok ? '#34d399' : '#ef4444' }}>
                {testResult.message}
              </span>
            )}
          </div>
        )}

        {/* spaCy info — no config needed, just install instructions */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
          <div style={{ fontSize: '0.72rem', fontFamily: mono, color: 'var(--ink-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>spaCy Lemmatizer</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: 8, lineHeight: 1.5 }}>
            When a spaCy model is installed for the article's language, clicked words are automatically
            looked up by their dictionary form — so clicking "mangiate" finds "mangiare".
            No configuration needed here; install models via <code style={{ fontFamily: mono, fontSize: '0.75rem' }}>config.ps1</code>.
          </p>
          <div style={{ background: 'var(--paper-alt)', borderRadius: 5, padding: '8px 12px', fontFamily: mono, fontSize: '0.75rem', color: 'var(--ink-muted)', lineHeight: 1.8 }}>
            Supported: English · Italian · German · French · Spanish · Turkish
          </div>
        </div>
      </div>
    </div>
  )
}
