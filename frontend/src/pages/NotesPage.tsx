import { useState, useEffect } from 'react'
import { getNotes, updateNote, deleteNote } from '../api'
import type { Note } from '../types'

export default function NotesPage({ onNavigateToArticle }: { onNavigateToArticle?: (id: number) => void }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const mono = 'DM Mono, monospace'

  useEffect(() => {
    getNotes().then(n => { setNotes(n); setLoading(false) })
  }, [])

  const handleSaveEdit = async (id: number) => {
    await updateNote(id, editText)
    setNotes(prev => prev.map(n => n.id === id ? { ...n, note_text: editText } : n))
    setEditingId(null)
  }

  const handleDelete = async (id: number) => {
    await deleteNote(id)
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  const filtered = notes.filter(n =>
    !search ||
    n.note_text.toLowerCase().includes(search.toLowerCase()) ||
    (n.selected_text || '').toLowerCase().includes(search.toLowerCase()) ||
    (n.article_title || '').toLowerCase().includes(search.toLowerCase())
  )

  const inputStyle: React.CSSProperties = {
    background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 6,
    padding: '6px 10px', color: 'var(--ink)', fontFamily: 'DM Sans, sans-serif',
    fontSize: '0.85rem', outline: 'none',
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Lora, serif', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Notes</h1>
        <span style={{ fontFamily: mono, fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
          {filtered.length} {filtered.length === 1 ? 'note' : 'notes'}
        </span>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search notes…"
        style={{ ...inputStyle, width: '100%', marginBottom: 24, boxSizing: 'border-box' }}
      />

      {loading ? (
        <p style={{ color: 'var(--ink-muted)', fontStyle: 'italic', fontFamily: 'Lora, serif' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>📝</div>
          <p style={{ fontFamily: 'Lora, serif', fontStyle: 'italic' }}>
            {notes.length === 0
              ? 'No notes yet. Select text in the reader and press N to add a note.'
              : 'No notes match your search.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filtered.map(note => (
            <div key={note.id} style={{
              background: 'var(--panel-bg)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '18px 20px',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              {/* Highlighted text anchor */}
              {note.selected_text && (
                <blockquote style={{
                  borderLeft: '3px solid var(--accent)', paddingLeft: 12,
                  margin: 0, fontFamily: 'Lora, serif', fontSize: '0.9rem',
                  color: 'var(--ink-muted)', fontStyle: 'italic', lineHeight: 1.6,
                }}>
                  {note.selected_text}
                </blockquote>
              )}

              {/* Note text */}
              {editingId === note.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea
                    autoFocus
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveEdit(note.id) }}
                    rows={4}
                    style={{
                      ...inputStyle, width: '100%', resize: 'vertical',
                      lineHeight: 1.6, boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleSaveEdit(note.id)} style={{
                      background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 5,
                      padding: '5px 14px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem',
                    }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{
                      background: 'transparent', border: '1px solid var(--border)', borderRadius: 5,
                      padding: '5px 14px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                      fontSize: '0.8rem', color: 'var(--ink-muted)',
                    }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <p style={{ margin: 0, fontFamily: 'DM Sans, sans-serif', fontSize: '0.9rem', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                  {note.note_text}
                </p>
              )}

              {/* Footer: article + actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                {note.article_title && (
                  <span
                    onClick={() => note.article_id && onNavigateToArticle?.(note.article_id)}
                    style={{
                      fontFamily: mono, fontSize: '0.68rem', color: 'var(--accent)',
                      cursor: onNavigateToArticle ? 'pointer' : 'default',
                      flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {note.article_title}
                  </span>
                )}
                <span style={{ fontFamily: mono, fontSize: '0.65rem', color: 'var(--ink-muted)', flexShrink: 0 }}>
                  {new Date(note.created_at).toLocaleDateString()}
                </span>
                {editingId !== note.id && (
                  <>
                    <button onClick={() => { setEditingId(note.id); setEditText(note.note_text) }} style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      fontFamily: mono, fontSize: '0.68rem', color: 'var(--ink-muted)', padding: '2px 6px',
                    }}>Edit</button>
                    <button onClick={() => handleDelete(note.id)} style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      fontFamily: mono, fontSize: '0.68rem', color: 'var(--ink-muted)', padding: '2px 6px',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-muted)')}
                    >Delete</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
