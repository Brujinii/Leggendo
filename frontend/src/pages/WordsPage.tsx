import { useState, useEffect } from 'react'
import { getLearningWords, deleteWord } from '../api'
import type { LearningWord } from '../types'
import { ALL_LANG_LABELS } from '../lib/languages'

export default function WordsPage({ onNavigateToArticle }: { onNavigateToArticle?: (id: number) => void }) {
  const [words, setWords] = useState<LearningWord[]>([])
  const [allLanguages, setAllLanguages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [filterLang, setFilterLang] = useState('')
  const [search, setSearch] = useState('')
  const [exportingPDF, setExportingPDF] = useState(false)
  const mono = 'DM Mono, monospace'

  // Load all words once to build the language list
  useEffect(() => {
    getLearningWords().then(all => {
      const langs = [...new Set(all.map(w => w.language))].filter(Boolean).sort()
      setAllLanguages(langs)
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    getLearningWords(filterLang || undefined).then(w => { setWords(w); setLoading(false) })
  }, [filterLang])

  const handleRemove = async (id: number) => {
    await deleteWord(id)
    setWords(prev => prev.filter(w => w.id !== id))
  }

  const handleExportPDF = async () => {
    setExportingPDF(true)
    try {
      const params = filterLang ? `?language=${filterLang}` : ''
      const response = await fetch(`/api/export/words-pdf${params}`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `leggendo_words_${filterLang || 'all'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('PDF export failed:', error)
    } finally {
      setExportingPDF(false)
    }
  }

  const filtered = words.filter(w =>
    !search || w.word.toLowerCase().includes(search.toLowerCase()) ||
    (w.sentence_context || '').toLowerCase().includes(search.toLowerCase())
  )

  const inputStyle: React.CSSProperties = {
    background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 6,
    padding: '6px 10px', color: 'var(--ink)', fontFamily: 'DM Sans, sans-serif',
    fontSize: '0.85rem', outline: 'none',
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Lora, serif', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
          Words Learning
        </h1>
        <span style={{ fontFamily: mono, fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
          {filtered.length} {filtered.length === 1 ? 'word' : 'words'}
        </span>
        <button 
          onClick={handleExportPDF} 
          disabled={exportingPDF || filtered.length === 0}
          style={{
            marginLeft: 'auto',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 14px',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '0.8rem',
            cursor: exportingPDF || filtered.length === 0 ? 'default' : 'pointer',
            opacity: exportingPDF || filtered.length === 0 ? 0.6 : 1
          }}
        >
          {exportingPDF ? 'Generating PDF...' : '📄 Export PDF'}
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search words…"
          style={{ ...inputStyle, flex: 1 }}
        />
        <select value={filterLang} onChange={e => setFilterLang(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
          <option value="">All languages</option>
          {allLanguages.map(l => <option key={l} value={l}>{ALL_LANG_LABELS[l] || l}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={{ color: 'var(--ink-muted)', fontStyle: 'italic', fontFamily: 'Lora, serif' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>📖</div>
          <p style={{ fontFamily: 'Lora, serif', fontStyle: 'italic' }}>
            {words.length === 0 ? 'No words marked as learning yet. Press L while reading to mark a word.' : 'No words match your search.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* Header row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 72px',
            padding: '6px 14px', fontFamily: mono, fontSize: '9px',
            letterSpacing: '0.1em', color: 'var(--ink-muted)', textTransform: 'uppercase',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>Word</span><span>Sentence</span><span>Article</span><span></span>
          </div>

          {filtered.map(w => (
            <div key={w.id} style={{
              display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 72px',
              padding: '12px 14px', alignItems: 'start',
              background: 'var(--paper)', borderBottom: '1px solid var(--border)',
              transition: 'background 0.1s', minWidth: 0,
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--panel-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--paper)')}
            >
              <div style={{ minWidth: 0 }}>
                <span style={{
                  fontFamily: 'Lora, serif', fontWeight: 600, fontSize: '1.05rem',
                  wordBreak: 'break-word', display: 'block',
                }}>
                  {w.word}
                </span>
                <div style={{ fontFamily: mono, fontSize: '0.62rem', color: 'var(--accent)', marginTop: 2 }}>
                  {ALL_LANG_LABELS[w.language] || w.language}
                </div>
              </div>

              <div style={{
                fontFamily: 'Lora, serif', fontSize: '0.85rem', lineHeight: 1.55,
                color: 'var(--ink-muted)', paddingRight: 16, minWidth: 0,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {w.sentence_context || <span style={{ fontStyle: 'italic' }}>No sentence saved</span>}
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', fontFamily: 'DM Sans, sans-serif', minWidth: 0, paddingRight: 8 }}>
                {w.article_title ? (
                  <span
                    style={{
                      cursor: onNavigateToArticle ? 'pointer' : 'default',
                      color: onNavigateToArticle ? 'var(--accent)' : 'inherit',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                    onClick={() => w.article_id && onNavigateToArticle?.(w.article_id)}
                  >
                    {w.article_title}
                  </span>
                ) : <span style={{ fontStyle: 'italic' }}>—</span>}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
                <button
                  onClick={() => handleRemove(w.id)}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--ink-muted)', fontSize: '0.75rem', fontFamily: mono,
                    padding: '2px 6px', borderRadius: 4,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-muted)')}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}