import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect } from 'react'

interface Props {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

const toolbarBtn = (active: boolean) => ({
  padding: '3px 8px',
  borderRadius: 4,
  border: '1px solid var(--border)',
  background: active ? 'var(--accent-light)' : 'transparent',
  color: active ? 'var(--accent)' : 'var(--ink-muted)',
  cursor: 'pointer',
  fontSize: '0.78rem',
  fontFamily: 'DM Sans, sans-serif',
})

export default function RichEditor({ content, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder || 'Paste or type your text here…' }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  useEffect(() => {
    if (editor && content === '') {
      editor.commands.clearContent()
    }
  }, [content])

  if (!editor) return null

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 4, padding: '8px 10px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--paper-alt)',
        flexWrap: 'wrap',
      }}>
        <button style={toolbarBtn(editor.isActive('bold'))}
          onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
          <strong>B</strong>
        </button>
        <button style={toolbarBtn(editor.isActive('italic'))}
          onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
          <em>I</em>
        </button>
        <div style={{ width: 1, background: 'var(--border)', margin: '2px 4px' }} />
        <button style={toolbarBtn(editor.isActive('heading', { level: 1 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">
          H1
        </button>
        <button style={toolbarBtn(editor.isActive('heading', { level: 2 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
          H2
        </button>
        <button style={toolbarBtn(editor.isActive('heading', { level: 3 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
          H3
        </button>
        <div style={{ width: 1, background: 'var(--border)', margin: '2px 4px' }} />
        <button style={toolbarBtn(editor.isActive('bulletList'))}
          onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
          • List
        </button>
        <button style={toolbarBtn(editor.isActive('blockquote'))}
          onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">
          " Quote
        </button>
        <div style={{ width: 1, background: 'var(--border)', margin: '2px 4px' }} />
        <button style={toolbarBtn(false)}
          onClick={() => editor.chain().focus().undo().run()} title="Undo">
          ↩ Undo
        </button>
      </div>

      {/* Editor area */}
      <style>{`
        .leggendo-editor { padding: 16px 18px; min-height: 280px; outline: none; }
        .leggendo-editor p { margin: 0 0 0.8em 0; line-height: 1.7; }
        .leggendo-editor p:last-child { margin-bottom: 0; }
        .leggendo-editor h1 { font-family: 'Lora', serif; font-size: 1.4rem; font-weight: 700; margin: 0.8em 0 0.4em; }
        .leggendo-editor h2 { font-family: 'Lora', serif; font-size: 1.2rem; font-weight: 600; margin: 0.7em 0 0.3em; }
        .leggendo-editor h3 { font-family: 'Lora', serif; font-size: 1.05rem; font-weight: 600; margin: 0.6em 0 0.3em; }
        .leggendo-editor blockquote { border-left: 3px solid var(--accent); margin: 0.8em 0; padding-left: 12px; color: var(--ink-muted); font-style: italic; }
        .leggendo-editor ul { padding-left: 20px; margin: 0.5em 0; }
        .leggendo-editor li { margin-bottom: 0.3em; }
        .leggendo-editor .is-editor-empty:first-child::before { content: attr(data-placeholder); color: var(--ink-muted); pointer-events: none; float: left; height: 0; font-style: italic; }
      `}</style>
      <EditorContent editor={editor} className="leggendo-editor" />
    </div>
  )
}
