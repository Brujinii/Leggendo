import { useState, useEffect } from 'react'
import { listArticles, createArticle, deleteArticle, getStats, updateArticle } from '../api'
import type { Article, Stats } from '../types'
import { useSettings } from '../context/SettingsContext'
import RichEditor from '../components/RichEditor'
import FolderTree from '../components/FolderTree'
import StreakCard from '../components/StreakCard'
import { ALL_LANG_CODES, ALL_LANG_LABELS } from '../lib/languages'
import TagInput from '../components/TagInput';

const LANGUAGES: Record<string, string> = {
  DE: 'German', EN: 'English', ES: 'Spanish',
  FR: 'French', IT: 'Italian', TR: 'Turkish',
  ZH: 'Chinese', KO: 'Korean', NL: 'Dutch', PL: 'Polish',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  // Format number with k, M, etc.
  const formatNumber = (num: number): string => {
    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1_000) {
      return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return num.toString();
  }

  return (
    <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px 20px' }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color, fontFamily: 'DM Mono, monospace' }}>
        {formatNumber(value)}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

interface Props {
  onOpenArticle: (id: number) => void
}

export default function HomePage({ onOpenArticle }: Props) {
  const { settings } = useSettings()
  const [articles, setArticles] = useState<Article[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [sort, setSort] = useState('last_read')
  const [filterLang, setFilterLang] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingArticle, setEditingArticle] = useState<Article | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newSubtitle, setNewSubtitle] = useState('')
  const [newText, setNewText] = useState('')
  const [newLang, setNewLang] = useState(settings.defaultSourceLang)
  const [newTarget, setNewTarget] = useState(settings.defaultTargetLang)
  const [newTags, setNewTags] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [folderSuggestions, setFolderSuggestions] = useState<string[]>([])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const load = async () => {
    const [arts, st] = await Promise.all([listArticles(sort), getStats(filterLang || undefined)])
    setArticles(arts)
    setStats(st)
    // Extract folder suggestions from the same fetch — no second network call needed
    const folders = new Set<string>()
    arts.forEach(article => {
      (article.tags || '').split(' ').forEach(tag => {
        if (tag.startsWith('@')) folders.add(tag)
      })
    })
    setFolderSuggestions(Array.from(folders).sort())
  }

  // Load articles, stats, and folder suggestions together whenever sort or filter changes
  useEffect(() => {
    load()
  }, [sort, filterLang])

  const handleAdd = async () => {
    if (!newTitle.trim() || !newText.trim()) return
    setSaving(true)
    try {
      await createArticle({ 
        title: newTitle.trim(), 
        subtitle: newSubtitle, 
        text: newText, 
        language: newLang, 
        target_language: newTarget, 
        tags: newTags.trim(), 
        source_url: newUrl 
      })
      setShowAdd(false)
      setNewTitle(''); setNewSubtitle(''); setNewText(''); setNewTags(''); setNewUrl('')
      await load()
    } catch (error) {
      console.error('Failed to create article:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleOpenEdit = (e: React.MouseEvent, article: Article) => {
    e.stopPropagation()
    setEditingArticle(article)
    setNewTitle(article.title)
    setNewSubtitle(article.subtitle || '')
    setNewLang(article.language)
    setNewTarget(article.target_language)
    setNewTags(article.tags || '')
    setNewUrl(article.source_url || '')
  }

  const handleSaveEdit = async () => {
    if (!editingArticle || !newTitle.trim()) return
    setSaving(true)
    try {
      await updateArticle(editingArticle.id, {
        title: newTitle.trim(),
        subtitle: newSubtitle,
        language: newLang,
        target_language: newTarget,
        tags: newTags.trim(),
        source_url: newUrl,
      })
      setEditingArticle(null)
      setNewTitle('')
      setNewSubtitle('')
      setNewTags('')
      setNewUrl('')
      await load()
    } catch (error) {
      console.error('Failed to update article:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (!confirm('Delete this article?')) return
    await deleteArticle(id)
    await load()
  }

  const filtered = filterLang ? articles.filter(a => a.language === filterLang) : articles
  // Track which language+category folders are collapsed
 
  const toggleFolder = (key: string) =>
    setCollapsed(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  // Get folder path from tags
  const getFolderPath = (tags: string): string[] => {
    const folderTags = (tags || '').split(' ').filter(t => t.startsWith('@'))
    if (folderTags.length === 0) return []
    // Take the first @ tag and split by backslash
    const folderPath = folderTags[0].slice(1).split('\\')
    return folderPath.filter(p => p.trim())
  }

  // Build paths map for a language
  const buildPathsMap = (articles: Article[]) => {
    const map = new Map<string, Article[]>()
    for (const article of articles) {
      const folderPath = getFolderPath(article.tags || '')
      const key = folderPath.join('/')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(article)
    }
    return map
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

  const btnPrimary = {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 20px',
    fontFamily: 'DM Sans, sans-serif',
    fontWeight: 500,
    fontSize: '0.875rem',
    cursor: 'pointer',
  }

  const btnSecondary = {
    background: 'transparent',
    color: 'var(--ink-muted)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '8px 20px',
    fontFamily: 'DM Sans, sans-serif',
    fontSize: '0.875rem',
    cursor: 'pointer',
  }

  return (
    <div className="max-w-5xl mx-auto px-8 py-10">

      {/* Streak Card */}
      <StreakCard />

      {/* Stats dashboard */}
      {stats && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontFamily: 'Lora, serif', fontSize: '1.1rem', fontWeight: 600 }}>Progress</h2>
            <select value={filterLang} onChange={e => setFilterLang(e.target.value)}
              style={{ ...inputStyle, width: 'auto', fontSize: '0.8rem', padding: '4px 8px' }}>
              <option value="">All languages</option>
              {ALL_LANG_CODES.map(c => <option key={c} value={c}>{ALL_LANG_LABELS[c]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            <StatCard label="Articles read" value={stats.articles} color="var(--accent)" />
            <StatCard label="Words read" value={stats.total_words_read} color="#34d399" />
            <StatCard label="Words learning" value={stats.words_learning} color="#60a5fa" />
            <StatCard label="Cards pending" value={stats.word_bank_pending} color="var(--ink-muted)" />
            <StatCard label="Cards exported" value={stats.word_bank_exported} color="#a78bfa" />
          </div>
        </div>
      )}

      {/* Article list header */}
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontFamily: 'Lora, serif', fontSize: '1.1rem', fontWeight: 600 }}>Library</h2>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', fontFamily: 'DM Mono, monospace' }}>SORT</span>
          {[
            { val: 'last_read', label: 'Recent' },
            { val: 'created', label: 'Added' },
            { val: 'length', label: 'Length' },
            { val: 'language', label: 'Language' },
          ].map(s => (
            <button key={s.val} onClick={() => setSort(s.val)} style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '0.7rem',
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              background: sort === s.val ? 'var(--accent-light)' : 'transparent',
              color: sort === s.val ? 'var(--accent)' : 'var(--ink-muted)',
              cursor: 'pointer',
            }}>{s.label}</button>
          ))}
          <button onClick={() => setShowAdd(true)} style={{ ...btnPrimary, padding: '6px 14px', fontSize: '0.8rem' }}>
            + Add text
          </button>
        </div>
      </div>

      {/* Article list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-muted)' }}>
          <div style={{ fontFamily: 'Lora, serif', fontStyle: 'italic', fontSize: '1.1rem', marginBottom: 8 }}>No articles yet</div>
          <div style={{ fontSize: '0.85rem' }}>Click "+ Add text" to paste your first article</div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(
            filtered.reduce<Record<string, Article[]>>((acc, a) => {
              const lang = a.language || 'Unknown'
              if (!acc[lang]) acc[lang] = []
              acc[lang].push(a)
              return acc
            }, {})
          ).map(([lang, langArticles]) => {
            const langKey = lang
            const langCollapsed = collapsed.has(langKey)
            const pathsMap = buildPathsMap(langArticles)
            
            return (
              <div key={lang}>
                {/* Language folder header */}
                <button onClick={() => toggleFolder(langKey)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  padding: '6px 0', marginBottom: langCollapsed ? 0 : 8,
                }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.7rem', color: 'var(--ink-muted)', width: 12 }}>
                    {langCollapsed ? '▶' : '▼'}
                  </span>
                  <span style={{ fontFamily: 'Lora, serif', fontWeight: 700, fontSize: '1rem' }}>
                    {LANGUAGES[lang] || lang}
                  </span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: 'var(--ink-muted)', marginLeft: 4 }}>
                    {langArticles.length} {langArticles.length === 1 ? 'article' : 'articles'}
                  </span>
                </button>

                {!langCollapsed && (
                  <div style={{ paddingLeft: 20 }}>
                    <FolderTree
                      lang={lang}
                      paths={pathsMap}
                      collapsed={collapsed}
                      onToggleFolder={toggleFolder}
                      onOpenArticle={onOpenArticle}
                      onEditArticle={handleOpenEdit}
                      onDeleteArticle={handleDelete}
                      formatDate={formatDate}
                      LANGUAGES={LANGUAGES}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add article modal */}
      {showAdd && (
        <div style={{
          position: 'fixed', inset: 0, background: '#00000066',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }} onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}>
          <div style={{
            background: 'var(--panel-bg)', borderRadius: '12px', padding: '32px',
            width: '90%', maxWidth: '640px', maxHeight: '90vh', overflow: 'auto',
            border: '1px solid var(--border)',
          }}>
            <h3 style={{ fontFamily: 'Lora, serif', fontSize: '1.2rem', fontWeight: 600, marginBottom: '20px' }}>
              Add new text
            </h3>

            <div className="flex flex-col gap-4">
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', display: 'block', marginBottom: 6, fontFamily: 'DM Mono, monospace' }}>
                  TITLE
                </label>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  placeholder="Article title..." style={inputStyle} />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', display: 'block', marginBottom: 6, fontFamily: 'DM Mono, monospace' }}>
                  SUBTITLE <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                </label>
                <input value={newSubtitle} onChange={e => setNewSubtitle(e.target.value)}
                  placeholder="Subtitle or description..." style={inputStyle} />
              </div>

              <div className="flex gap-3">
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', display: 'block', marginBottom: 6, fontFamily: 'DM Mono, monospace' }}>
                    TEXT LANGUAGE
                  </label>
                  <select value={newLang} onChange={e => setNewLang(e.target.value)} style={inputStyle}>
                    {ALL_LANG_CODES.map(c => <option key={c} value={c}>{ALL_LANG_LABELS[c]}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', display: 'block', marginBottom: 6, fontFamily: 'DM Mono, monospace' }}>
                    TRANSLATE TO
                  </label>
                  <select value={newTarget} onChange={e => setNewTarget(e.target.value)} style={inputStyle}>
                    {ALL_LANG_CODES.map(c => <option key={c} value={c}>{ALL_LANG_LABELS[c]}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', display: 'block', marginBottom: 6, fontFamily: 'DM Mono, monospace' }}>
                  TAGS <span style={{ fontWeight: 400, textTransform: 'none' }}>(space-separated · use @parent\child for nested folders)</span>
                </label>
                <TagInput
                  value={newTags}
                  onChange={setNewTags}
                  placeholder="@folder\subfolder tagname"
                  suggestions={folderSuggestions}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', display: 'block', marginBottom: 6, fontFamily: 'DM Mono, monospace' }}>
                  SOURCE URL <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional — link back to the original)</span>
                </label>
                <input value={newUrl} onChange={e => setNewUrl(e.target.value)}
                  placeholder="https://…" style={inputStyle} />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', display: 'block', marginBottom: 6, fontFamily: 'DM Mono, monospace' }}>
                  TEXT
                </label>
                <RichEditor
                  content={newText}
                  onChange={setNewText}
                  placeholder="Paste or type your article here. Use the toolbar for headings and paragraphs."
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowAdd(false)} style={btnSecondary}>Cancel</button>
                <button onClick={handleAdd} disabled={saving || !newTitle.trim() || !newText.trim()}
                  style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving…' : 'Save & Read'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit article modal */}
      {editingArticle && (
        <div style={{
          position: 'fixed', inset: 0, background: '#00000066',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }} onClick={e => { if (e.target === e.currentTarget) setEditingArticle(null) }}>
          <div style={{
            background: 'var(--panel-bg)', borderRadius: '12px', padding: '32px',
            width: '90%', maxWidth: '560px', maxHeight: '90vh', overflow: 'auto',
            border: '1px solid var(--border)',
          }}>
            <h3 style={{ fontFamily: 'Lora, serif', fontSize: '1.2rem', fontWeight: 600, marginBottom: '20px' }}>
              Edit article
            </h3>
            <div className="flex flex-col gap-4">
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', display: 'block', marginBottom: 6, fontFamily: 'DM Mono, monospace' }}>TITLE</label>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', display: 'block', marginBottom: 6, fontFamily: 'DM Mono, monospace' }}>
                  SUBTITLE <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                </label>
                <input value={newSubtitle} onChange={e => setNewSubtitle(e.target.value)}
                  placeholder="Subtitle or description..." style={inputStyle} />
              </div>
              <div className="flex gap-3">
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', display: 'block', marginBottom: 6, fontFamily: 'DM Mono, monospace' }}>TEXT LANGUAGE</label>
                  <select value={newLang} onChange={e => setNewLang(e.target.value)} style={inputStyle}>
                    {ALL_LANG_CODES.map(c => <option key={c} value={c}>{ALL_LANG_LABELS[c]}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', display: 'block', marginBottom: 6, fontFamily: 'DM Mono, monospace' }}>TRANSLATE TO</label>
                  <select value={newTarget} onChange={e => setNewTarget(e.target.value)} style={inputStyle}>
                    {ALL_LANG_CODES.map(c => <option key={c} value={c}>{ALL_LANG_LABELS[c]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', display: 'block', marginBottom: 6, fontFamily: 'DM Mono, monospace' }}>
                  TAGS <span style={{ fontWeight: 400, textTransform: 'none' }}>(use @parent\child for nested folders)</span>
                </label>
                <TagInput
                  value={newTags}
                  onChange={setNewTags}
                  placeholder="@news\politics italian"
                  suggestions={folderSuggestions}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', display: 'block', marginBottom: 6, fontFamily: 'DM Mono, monospace' }}>
                  SOURCE URL <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                </label>
                <input value={newUrl} onChange={e => setNewUrl(e.target.value)}
                  placeholder="https://…" style={inputStyle} />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setEditingArticle(null)} style={btnSecondary}>Cancel</button>
                <button onClick={handleSaveEdit} disabled={saving || !newTitle.trim()}
                  style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}