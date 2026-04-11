import { useState } from 'react'
import type { WordBankEntry } from '../types'

interface Props {
  entries: WordBankEntry[]
  onDelete: (id: number) => void
  onUpdateNotes: (id: number, notes: string) => void
  onExport: () => void
}

export default function WordBankPanel({ entries, onDelete, onUpdateNotes, onExport }: Props) {
  const mono = 'DM Mono, monospace'
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editNotes, setEditNotes] = useState('')

  return (
    <div style={{ background: 'var(--panel-bg)', borderTop: '2px solid var(--border)', padding: '24px', marginTop: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontFamily: 'Lora, serif', fontSize: '1rem', fontWeight: 600 }}>
          Word Bank{' '}
          <span style={{ fontFamily: mono, fontSize: '0.75rem', color: 'var(--ink-muted)', marginLeft: 8 }}>
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </span>
        </h3>
        {entries.length > 0 && (
          <button onClick={onExport} style={{
            background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6,
            padding: '6px 16px', fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem',
            fontWeight: 500, cursor: 'pointer',
          }}>
            Export to Anki →
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem', fontStyle: 'italic', fontFamily: 'Lora, serif' }}>
          Select text and press <kbd>A</kbd> to add to your export list.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {entries.map(entry => (
            <div key={entry.id} style={{
              background: 'var(--paper)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '12px 14px',
            }}>
              <div style={{ fontFamily: 'Lora, serif', fontWeight: 600, fontSize: '1rem', marginBottom: 4 }}>
                {entry.selected_text}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginBottom: 6, lineHeight: 1.5, fontFamily: mono }}>
                {entry.sentence_context.replace(/\{\{c\d+::(.*?)\}\}/g, '[$1]').slice(0, 100)}
                {entry.sentence_context.length > 100 ? '…' : ''}
              </div>
              {entry.sentence_translation && (
                <div style={{ fontSize: '0.78rem', fontStyle: 'italic', fontFamily: 'Lora, serif', color: 'var(--ink-muted)', marginBottom: 6 }}>
                  {entry.sentence_translation}
                </div>
              )}

              {editingId === entry.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 }}>
                  <textarea
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    placeholder="Add notes…"
                    autoFocus
                    rows={3}
                    style={{
                      width: '100%', fontSize: '0.75rem', padding: '6px',
                      background: 'var(--paper-alt)', border: '1px solid var(--border)',
                      borderRadius: 4, color: 'var(--ink)', outline: 'none',
                      fontFamily: 'DM Sans, sans-serif', resize: 'vertical', boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => { onUpdateNotes(entry.id, editNotes); setEditingId(null) }}
                      style={{
                        fontSize: '0.7rem', background: 'var(--accent)', color: 'white',
                        border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{
                        fontSize: '0.7rem', background: 'transparent',
                        border: '1px solid var(--border)', borderRadius: 4,
                        padding: '2px 8px', cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => { setEditingId(entry.id); setEditNotes(entry.notes ?? '') }}
                  style={{
                    fontSize: '0.72rem',
                    color: entry.notes ? 'var(--ink-muted)' : 'var(--accent)',
                    cursor: 'pointer', marginBottom: 4,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4,
                  }}
                >
                  {entry.notes || '+ Add notes'}
                </div>
              )}

              <button
                onClick={() => onDelete(entry.id)}
                style={{
                  fontSize: '0.7rem', color: 'var(--ink-muted)', background: 'transparent',
                  border: 'none', cursor: 'pointer', padding: 0, marginTop: 2,
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
