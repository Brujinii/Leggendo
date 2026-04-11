import { useState, useEffect } from 'react'
import { getAllWordBank, deleteWordBankEntry } from '../api'
import type { WordBankEntry } from '../types'
import ExportOverlay from '../components/ExportOverlay'
import { ALL_LANG_LABELS } from '../lib/languages'

type FilterExported = 'all' | 'no' | 'yes'

export default function ExportPage() {
  const [entries, setEntries] = useState<WordBankEntry[]>([])
  const [allLanguages, setAllLanguages] = useState<string[]>([])
  const [filterLang, setFilterLang] = useState('')
  const [filterExported, setFilterExported] = useState<FilterExported>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [showOverlay, setShowOverlay] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load all entries once to get the full language list for the dropdown
  useEffect(() => {
    getAllWordBank().then(all => {
      const langs = [...new Set(all.map(e => e.language || ''))].filter(Boolean).sort()
      setAllLanguages(langs)
    })
  }, [])

  const load = async () => {
    setLoading(true)
    const data = await getAllWordBank({
      language: filterLang || undefined,
      exported: filterExported === 'all' ? undefined : filterExported,
    })
    setEntries(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [filterLang, filterExported])

  const filtered = entries.filter(e => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      e.selected_text.toLowerCase().includes(q) ||
      e.sentence_context.toLowerCase().includes(q) ||
      (e.article_title || '').toLowerCase().includes(q)
    )
  })

  const allExportedTexts = new Set(
    entries.filter(e => e.exported_at).map(e => e.selected_text.toLowerCase())
  )

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(e => e.id)))
    }
  }

  const handleDelete = async (id: number) => {
    await deleteWordBankEntry(id)
    setEntries(prev => prev.filter(e => e.id !== id))
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  const handleExported = (exportedIds: number[]) => {
    const now = new Date().toISOString()
    setEntries(prev => prev.map(e =>
      exportedIds.includes(e.id) ? { ...e, exported_at: now } : e
    ))
    setSelected(new Set())
  }

  const selectedEntries = filtered.filter(e => selected.has(e.id))

  const mono = 'DM Mono, monospace'
  const inputStyle = {
    fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem',
    background: 'var(--paper)', border: '1px solid var(--border)',
    borderRadius: 6, padding: '6px 10px', color: 'var(--ink)', outline: 'none',
  }

  // group entries by language
  const languages = allLanguages

  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'Lora, serif', fontSize: '1.6rem', fontWeight: 600 }}>Export</h1>
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem', marginTop: 4 }}>
            Manage and export your word bank to Anki
          </p>
        </div>
        <button
          onClick={() => setShowOverlay(true)}
          disabled={selected.size === 0}
          style={{
            background: selected.size > 0 ? 'var(--accent)' : 'var(--border)',
            color: selected.size > 0 ? 'white' : 'var(--ink-muted)',
            border: 'none', borderRadius: 6, padding: '10px 22px',
            fontFamily: 'DM Sans, sans-serif', fontWeight: 500, fontSize: '0.9rem',
            cursor: selected.size > 0 ? 'pointer' : 'default',
          }}
        >
          Export {selected.size > 0 ? `${selected.size} selected` : '…'}
        </button>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search words, sentences, articles…"
          style={{ ...inputStyle, minWidth: 260 }}
        />
        <select value={filterLang} onChange={e => setFilterLang(e.target.value)} style={inputStyle}>
          <option value="">All languages</option>
          {languages.map(l => <option key={l} value={l}>{ALL_LANG_LABELS[l] || l}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
          {(['all', 'no', 'yes'] as FilterExported[]).map(f => (
            <button key={f} onClick={() => setFilterExported(f)} style={{
              padding: '6px 14px', border: 'none', cursor: 'pointer',
              fontFamily: mono, fontSize: '0.7rem',
              background: filterExported === f ? 'var(--accent)' : 'var(--paper)',
              color: filterExported === f ? 'white' : 'var(--ink-muted)',
              borderRight: f !== 'yes' ? '1px solid var(--border)' : 'none',
            }}>
              {f === 'all' ? 'All' : f === 'no' ? 'Pending' : 'Exported'}
            </button>
          ))}
        </div>
        <span style={{ fontFamily: mono, fontSize: '0.7rem', color: 'var(--ink-muted)', marginLeft: 'auto' }}>
          {filtered.length} entries
        </span>
      </div>

      {/* Select all row */}
      {filtered.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
          paddingBottom: 10, borderBottom: '1px solid var(--border)',
        }}>
          <input type="checkbox"
            checked={selected.size === filtered.length && filtered.length > 0}
            onChange={toggleSelectAll}
            style={{ cursor: 'pointer', width: 15, height: 15 }}
          />
          <span style={{ fontFamily: mono, fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
            {selected.size === filtered.length ? 'Deselect all' : 'Select all'}
          </span>
        </div>
      )}

      {/* Entry list */}
      {loading ? (
        <div style={{ color: 'var(--ink-muted)', fontStyle: 'italic', padding: '40px 0', textAlign: 'center' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-muted)' }}>
          <div style={{ fontFamily: 'Lora, serif', fontStyle: 'italic', fontSize: '1.1rem', marginBottom: 8 }}>
            No entries found
          </div>
          <div style={{ fontSize: '0.85rem' }}>Add words to your word bank while reading to see them here</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(entry => {
            const isSelected = selected.has(entry.id)
            const isExported = !!entry.exported_at
            return (
              <div key={entry.id} onClick={() => toggleSelect(entry.id)} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                background: isSelected ? 'var(--accent-light)' : 'var(--panel-bg)',
                border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 8, padding: '12px 14px', cursor: 'pointer',
                transition: 'all 0.12s', opacity: isExported && filterExported !== 'yes' ? 0.65 : 1,
              }}>
                <input type="checkbox" checked={isSelected} onChange={() => {}}
                  style={{ marginTop: 2, cursor: 'pointer', width: 15, height: 15, flexShrink: 0 }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'Lora, serif', fontWeight: 600, fontSize: '1rem' }}>
                      {entry.selected_text}
                    </span>
                    {isExported && (
                      <span style={{
                        fontFamily: mono, fontSize: '0.65rem', padding: '1px 6px',
                        background: '#34d39922', color: '#34d399', borderRadius: 3,
                      }}>exported {new Date(entry.exported_at!).toLocaleDateString()}</span>
                    )}
                    {allExportedTexts.has(entry.selected_text.toLowerCase()) && !isExported && (
                      <span style={{
                        fontFamily: mono, fontSize: '0.65rem', padding: '1px 6px',
                        background: '#f59e0b22', color: '#f59e0b', borderRadius: 3,
                      }}>⚠ duplicate</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', lineHeight: 1.5, marginBottom: 4 }}>
                    {entry.sentence_context}
                  </div>
                  {entry.sentence_translation && (
                    <div style={{ fontSize: '0.78rem', fontStyle: 'italic', fontFamily: 'Lora, serif', color: 'var(--ink-muted)' }}>
                      {entry.sentence_translation}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 12, marginTop: 6, alignItems: 'center' }}>
                    <span style={{ fontFamily: mono, fontSize: '0.65rem', color: 'var(--ink-muted)' }}>
                      {entry.article_title}
                    </span>
                    {entry.language && (
                      <span style={{ fontFamily: mono, fontSize: '0.65rem', color: 'var(--ink-muted)' }}>
                        {ALL_LANG_LABELS[entry.language] || entry.language}
                      </span>
                    )}
                    {entry.tags && (
                      <span style={{ fontFamily: mono, fontSize: '0.65rem', color: 'var(--accent)' }}>
                        {entry.tags}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={e => { e.stopPropagation(); handleDelete(entry.id) }}
                  style={{
                    background: 'transparent', border: 'none', color: 'var(--ink-muted)',
                    cursor: 'pointer', fontSize: '0.85rem', padding: '2px 6px',
                    borderRadius: 4, flexShrink: 0,
                  }}
                  title="Delete entry"
                >✕</button>
              </div>
            )
          })}
        </div>
      )}

      {showOverlay && (
        <ExportOverlay
          entries={selectedEntries}
          allExportedTexts={allExportedTexts}
          onClose={() => setShowOverlay(false)}
          onExported={(ids) => { handleExported(ids); setShowOverlay(false) }}
        />
      )}
    </div>
  )
}
