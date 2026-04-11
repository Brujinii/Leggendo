import { useState } from 'react'
import type { Note } from '../types'

interface Props {
  notes: Note[]
  onDelete: (id: number) => void
  onUpdate: (id: number, text: string) => void
}

export default function NotesPanel({ notes, onDelete, onUpdate }: Props) {
  const mono = 'DM Mono, monospace'
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')

  if (notes.length === 0) return null

  return (
    <aside style={{
      width: 'var(--sidebar-w)', background: 'var(--panel-bg)',
      borderRight: '1px solid var(--border)',
      padding: '20px', display: 'flex', flexDirection: 'column', gap: 14,
      position: 'sticky', top: '53px', height: 'calc(100vh - 53px)',
      overflowY: 'auto', flexShrink: 0,
    }}>
      <div style={{
        fontSize: '10px', letterSpacing: '0.12em', color: 'var(--ink-muted)',
        fontFamily: mono, textTransform: 'uppercase',
      }}>
        Notes <span style={{ color: 'var(--accent)' }}>{notes.length}</span>
      </div>

      {notes.map(note => (
        <div key={note.id} style={{
          background: 'var(--paper)', border: '1px solid var(--border)',
          borderRadius: 7, padding: '10px 12px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {note.selected_text && (
            <div style={{
              borderLeft: '2px solid var(--accent)', paddingLeft: 8,
              fontFamily: 'Lora, serif', fontSize: '0.78rem',
              color: 'var(--ink-muted)', fontStyle: 'italic', lineHeight: 1.5,
            }}>
              {note.selected_text}
            </div>
          )}

          {editingId === note.id ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <textarea
                autoFocus
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    onUpdate(note.id, editText)
                    setEditingId(null)
                  }
                }}
                rows={3}
                style={{
                  width: '100%', fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem',
                  padding: '5px 7px', background: 'var(--panel-bg)',
                  border: '1px solid var(--border)', borderRadius: 4,
                  color: 'var(--ink)', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 5 }}>
                <button
                  onClick={() => { onUpdate(note.id, editText); setEditingId(null) }}
                  style={{
                    background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 3,
                    padding: '3px 10px', cursor: 'pointer', fontFamily: mono, fontSize: '0.65rem',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  style={{
                    background: 'transparent', border: '1px solid var(--border)', borderRadius: 3,
                    padding: '3px 8px', cursor: 'pointer', fontFamily: mono,
                    fontSize: '0.65rem', color: 'var(--ink-muted)',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p style={{
              margin: 0, fontFamily: 'DM Sans, sans-serif', fontSize: '0.82rem',
              lineHeight: 1.55, whiteSpace: 'pre-wrap', color: 'var(--ink)',
            }}>
              {note.note_text}
            </p>
          )}

          {editingId !== note.id && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontFamily: mono, fontSize: '0.6rem', color: 'var(--ink-muted)', flex: 1 }}>
                {new Date(note.created_at).toLocaleDateString()}
              </span>
              <button
                onClick={() => { setEditingId(note.id); setEditText(note.note_text) }}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontFamily: mono, fontSize: '0.62rem', color: 'var(--ink-muted)', padding: 0,
                }}
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(note.id)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontFamily: mono, fontSize: '0.62rem', color: 'var(--ink-muted)', padding: 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-muted)')}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      ))}
    </aside>
  )
}
