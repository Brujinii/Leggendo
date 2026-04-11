import { useState } from 'react'
import type { WordBankEntry } from '../types'
import { exportCSV } from '../api'

interface EditableEntry extends WordBankEntry {
  skipped: boolean
  isDuplicate: boolean
}

interface Props {
  entries: WordBankEntry[]
  allExportedTexts: Set<string>
  onClose: () => void
  onExported: (exportedIds: number[]) => void
}

function hasCloze(text: string): boolean {
  return /\{\{c\d+::[^}]+\}\}/.test(text)
}

export default function ExportOverlay({ entries, allExportedTexts, onClose, onExported }: Props) {
  const [cards, setCards] = useState<EditableEntry[]>(() =>
    entries.map(e => ({
      ...e,
      skipped: e.exported_at !== null,
      isDuplicate: allExportedTexts.has(e.selected_text.toLowerCase()),
    }))
  )
  const [exporting, setExporting] = useState(false)
  const [done, setDone] = useState(false)

  const updateCard = (id: number, field: string, value: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const toggleSkip = (id: number) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, skipped: !c.skipped } : c))
  }

  const toExport = cards.filter(c => !c.skipped)
  const skipped = cards.filter(c => c.skipped)

  const handleExport = async () => {
    if (toExport.length === 0) return
    setExporting(true)
    try {
      const updates: Record<string, any> = {}
      for (const card of toExport) {
        updates[String(card.id)] = {
          sentence_context: card.sentence_context,
          sentence_translation: card.sentence_translation,
          hint: card.hint,
          notes: card.notes,
        }
      }
      await exportCSV(toExport.map(c => c.id), updates)
      setDone(true)
      onExported(toExport.map(c => c.id))
    } catch (e) {
      console.error(e)
    } finally {
      setExporting(false)
    }
  }

  const mono = 'DM Mono, monospace'

  const textarea = (rows = 2): React.CSSProperties => ({
    width: '100%',
    fontFamily: 'Lora, serif',
    fontSize: '0.9rem',
    padding: '8px 10px',
    background: 'var(--paper)',
    border: '1px solid var(--border)',
    borderRadius: 5,
    color: 'var(--ink)',
    outline: 'none',
    resize: 'vertical',
    lineHeight: '1.6',
  })

  const input: React.CSSProperties = {
    width: '100%',
    fontFamily: 'DM Sans, sans-serif',
    fontSize: '0.82rem',
    padding: '6px 10px',
    background: 'var(--paper)',
    border: '1px solid var(--border)',
    borderRadius: 5,
    color: 'var(--ink)',
    outline: 'none',
  }

  const fieldLabel: React.CSSProperties = {
    fontSize: '9px',
    letterSpacing: '0.12em',
    color: 'var(--ink-muted)',
    fontFamily: mono,
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: 4,
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000000cc', zIndex: 200,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ── Header ── */}
      <div style={{
        background: 'var(--panel-bg)', borderBottom: '1px solid var(--border)',
        padding: '14px 28px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontFamily: 'Lora, serif', fontWeight: 600, fontSize: '1.15rem' }}>
            Export to Anki
          </span>
          <span style={{ fontFamily: mono, fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
            {toExport.length} cards · {skipped.length} skipped
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {done ? (
            <span style={{ fontFamily: mono, fontSize: '0.8rem', color: '#34d399' }}>
              ✓ {toExport.length} cards exported
            </span>
          ) : (
            <button onClick={handleExport} disabled={exporting || toExport.length === 0} style={{
              background: toExport.length === 0 ? 'var(--border)' : 'var(--accent)',
              color: toExport.length === 0 ? 'var(--ink-muted)' : 'white',
              border: 'none', borderRadius: 6, padding: '8px 22px',
              fontFamily: 'DM Sans, sans-serif', fontWeight: 500, fontSize: '0.875rem',
              cursor: toExport.length === 0 ? 'default' : 'pointer',
              opacity: exporting ? 0.7 : 1,
            }}>
              {exporting ? 'Exporting…' : `Export ${toExport.length} cards`}
            </button>
          )}
          <button onClick={onClose} style={{
            background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
            padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
            fontSize: '0.875rem', color: 'var(--ink-muted)',
          }}>
            {done ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>

      {/* ── Import hint ── */}
      {!done && (
        <div style={{
          background: 'var(--accent-light)', padding: '7px 28px', flexShrink: 0,
          fontSize: '0.75rem', color: 'var(--ink-muted)', fontFamily: mono,
        }}>
          Anki → File → Import → select CSV → Note Type: "Language Learning Cloze Deletion" → map columns in order
        </div>
      )}

      {/* ── Card grid ── */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '24px 28px' }}>
        {done ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✓</div>
            <div style={{ fontFamily: 'Lora, serif', fontSize: '1.2rem', fontWeight: 600, marginBottom: 6 }}>
              {toExport.length} cards exported
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>
              leggendo_export.csv downloaded — import it in Anki.
            </div>
          </div>
        ) : (
          <>
            {/* Active cards */}
            {toExport.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{
                  fontFamily: mono, fontSize: '9px', letterSpacing: '0.12em',
                  color: 'var(--ink-muted)', textTransform: 'uppercase', marginBottom: 14,
                }}>
                  Cards to export ({toExport.length})
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(560px, 1fr))',
                  gap: 16,
                }}>
                  {toExport.map(card => {
                    const missingCloze = !hasCloze(card.sentence_context || '')
                    return (
                      <div key={card.id} style={{
                        background: 'var(--panel-bg)',
                        border: `1px solid ${missingCloze ? '#f59e0b' : 'var(--border)'}`,
                        borderRadius: 10, padding: '18px 20px',
                        display: 'flex', flexDirection: 'column', gap: 12,
                      }}>
                        {/* Warnings */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {card.isDuplicate && (
                            <span style={{
                              fontFamily: mono, fontSize: '0.65rem', color: '#f59e0b',
                              background: '#f59e0b22', padding: '2px 7px', borderRadius: 3,
                            }}>⚠ Previously exported</span>
                          )}
                          {missingCloze && (
                            <span style={{
                              fontFamily: mono, fontSize: '0.65rem', color: '#ef4444',
                              background: '#ef444422', padding: '2px 7px', borderRadius: 3,
                            }}>✕ No cloze term — add {`{{c1::word}}`} manually</span>
                          )}
                        </div>

                        {/* Target language — full width, cloze syntax visible */}
                        <div>
                          <label style={fieldLabel}>Target Language</label>
                          <textarea
                            value={card.sentence_context || ''}
                            onChange={e => updateCard(card.id, 'sentence_context', e.target.value)}
                            rows={3}
                            style={textarea(3)}
                          />
                        </div>

                        {/* Known language — full width */}
                        <div>
                          <label style={fieldLabel}>Known Language</label>
                          <textarea
                            value={card.sentence_translation || ''}
                            onChange={e => updateCard(card.id, 'sentence_translation', e.target.value)}
                            rows={3}
                            placeholder="Translation…"
                            style={textarea(3)}
                          />
                        </div>

                        {/* Hint + Notes side by side */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div>
                            <label style={fieldLabel}>Hint</label>
                            <textarea
                              value={card.hint || ''}
                              onChange={e => updateCard(card.id, 'hint', e.target.value)}
                              placeholder="Shown on card front…"
                              rows={4}
                              style={{
                                width: '100%',
                                fontFamily: 'Lora, serif',
                                fontSize: '0.82rem',
                                padding: '6px 10px',
                                background: 'var(--paper)',
                                border: '1px solid var(--border)',
                                borderRadius: 5,
                                color: 'var(--ink)',
                                outline: 'none',
                                resize: 'vertical',
                                lineHeight: '1.5',
                              }}
                            />
                          </div>
                          <div>
                            <label style={fieldLabel}>Notes</label>
                            <textarea
                              value={card.notes || ''}
                              onChange={e => updateCard(card.id, 'notes', e.target.value)}
                              placeholder="Shown after answer…"
                              rows={4}
                              style={{
                                width: '100%',
                                fontFamily: 'Lora, serif',
                                fontSize: '0.82rem',
                                padding: '6px 10px',
                                background: 'var(--paper)',
                                border: '1px solid var(--border)',
                                borderRadius: 5,
                                color: 'var(--ink)',
                                outline: 'none',
                                resize: 'vertical',
                                lineHeight: '1.5',
                              }}
                            />
                          </div>
                        </div>

                        {/* Skip button */}
                        <div>
                          <button onClick={() => toggleSkip(card.id)} style={{
                            fontSize: '0.72rem', fontFamily: mono,
                            background: 'transparent', border: '1px solid var(--border)',
                            borderRadius: 4, padding: '3px 10px', cursor: 'pointer',
                            color: 'var(--ink-muted)',
                          }}>Skip this card</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Skipped cards — collapsed rows */}
            {skipped.length > 0 && (
              <div>
                <div style={{
                  fontFamily: mono, fontSize: '9px', letterSpacing: '0.12em',
                  color: 'var(--ink-muted)', textTransform: 'uppercase', marginBottom: 10,
                }}>
                  Skipped ({skipped.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {skipped.map(card => (
                    <div key={card.id} style={{
                      background: 'var(--panel-bg)', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '8px 14px',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <span style={{ fontFamily: 'Lora, serif', fontWeight: 600, fontSize: '0.9rem', flex: '0 0 auto' }}>
                        {card.selected_text}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', flex: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(card.sentence_context || '').replace(/\{\{c\d+::(.*?)\}\}/g, '[$1]')}
                      </span>
                      {card.exported_at && (
                        <span style={{ fontFamily: mono, fontSize: '0.65rem', color: 'var(--ink-muted)', flex: '0 0 auto' }}>
                          exported {new Date(card.exported_at).toLocaleDateString()}
                        </span>
                      )}
                      <button onClick={() => toggleSkip(card.id)} style={{
                        fontSize: '0.7rem', fontFamily: mono, flex: '0 0 auto',
                        background: 'transparent', border: '1px solid var(--accent)',
                        borderRadius: 4, padding: '2px 8px', cursor: 'pointer', color: 'var(--accent)',
                      }}>Include</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
