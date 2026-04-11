import { useState, useEffect, useCallback, useRef } from 'react'
import type { LookupResult, WordStatus, WordBankEntry, Article, Note } from '../types'
import {
  lookupWord, translateSentence, getArticle,
  updateWordStatus, getWordStatuses,
  addToWordBank, getWordBank, deleteWordBankEntry, updateWordBankEntry,
  getAllWordBank, lookupWiktionary, updateArticleText, updateArticle, getArticleStats,
  createNote, getNotes, deleteNote, updateNote,
  lemmatizeWord,
} from '../api'
import { stripPunctuation } from '../components/WordToken'
import WordToken from '../components/WordToken'
import ExportOverlay from '../components/ExportOverlay'
import ReaderDictionaryPanel, { type LemmaInfo } from '../components/ReaderDictionaryPanel'
import WordBankPanel from '../components/WordBankPanel'
import NotesPanel from '../components/NotesPanel'
import RichEditor from '../components/RichEditor'
import { useSettings } from '../context/SettingsContext'
import {
  tokenizePlain, tokenizeHtml, getSentenceForOffset,
  charOffsetOfToken, findPhraseRange, blockStyle,
} from '../lib/tokenizer'
import type { InlineFormat } from '../lib/tokenizer'

interface Props {
  articleId: number
  onBack: () => void
}

// ---------------------------------------------------------------------------
// ReaderPage
// ---------------------------------------------------------------------------

export default function ReaderPage({ articleId, onBack }: Props) {
  const { settings } = useSettings()

  const [article, setArticle] = useState<Article | null>(null)
  const [plainTokens, setPlainTokens] = useState<string[]>([])
  const [plainText, setPlainText] = useState('')
  const [blockMap, setBlockMap] = useState<string[]>([])
  const [inlineMap, setInlineMap] = useState<InlineFormat[]>([])

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [dragEnd, setDragEnd] = useState<number | null>(null)

  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [wiktResult, setWiktResult] = useState<any>(null)
  const [wiktLoading, setWiktLoading] = useState(false)
  const [sentenceTranslation, setSentenceTranslation] = useState<string | null>(null)
  const [lemmaInfo, setLemmaInfo] = useState<LemmaInfo | null>(null)
  const [sentenceLoading, setSentenceLoading] = useState(false)

  const [wordStatuses, setWordStatuses] = useState<Record<string, WordStatus>>({})
  const [currentStatus, setCurrentStatus] = useState<WordStatus | null>(null)

  const [wordBankEntries, setWordBankEntries] = useState<WordBankEntry[]>([])
  const [bankLoading, setBankLoading] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [allExportedTexts, setAllExportedTexts] = useState<Set<string>>(new Set())

  const [notes, setNotes] = useState<Note[]>([])
  const [noteModal, setNoteModal] = useState<{ open: boolean; prefill: string }>({ open: false, prefill: '' })
  const [noteDraft, setNoteDraft] = useState('')
  const [underlinedRanges, setUnderlinedRanges] = useState<[number, number][]>([])

  const [articleStats, setArticleStats] = useState<any>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editSubtitle, setEditSubtitle] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [layout, setLayout] = useState<'centered' | 'wide' | 'full'>('centered')
  const [scrolled, setScrolled] = useState(false)

  const mainRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef<number | null>(null)
  const dragEndRef = useRef<number | null>(null)
  const plainTokensRef = useRef<string[]>([])
  const plainTextRef = useRef('')
  const articleRef = useRef<Article | null>(null)
  const selectedTextRef = useRef('')
  const selectedSentenceRef = useRef('')

  useEffect(() => { plainTokensRef.current = plainTokens }, [plainTokens])
  useEffect(() => { plainTextRef.current = plainText }, [plainText])
  useEffect(() => { articleRef.current = article }, [article])

  // ---------------------------------------------------------------------------
  // Word bank refreshing (after edits)
  // ---------------------------------------------------------------------------
  const refreshWordBank = useCallback(async () => {
  if (!article) return
  const entries = await getWordBank(article.id)
  setWordBankEntries(entries)
}, [article])

  // ---------------------------------------------------------------------------
  // Article loading
  // ---------------------------------------------------------------------------

  useEffect(() => {
    getArticle(articleId).then(a => {
      setArticle(a)
      if (a.text && a.text.startsWith('<')) {
        const { tokens, blockMap: bm, inlineMap: im, plainText: pt } = tokenizeHtml(a.text)
        setPlainTokens(tokens); setBlockMap(bm); setInlineMap(im); setPlainText(pt)
      } else if (a.text) {
        setPlainTokens(tokenizePlain(a.text))
        setBlockMap([]); setInlineMap([]); setPlainText(a.text)
      } else {
        setPlainTokens([]); setBlockMap([]); setInlineMap([]); setPlainText('')
      }
      getWordStatuses(a.language).then(setWordStatuses)
      getWordBank(articleId).then(setWordBankEntries)
      getAllWordBank({ exported: 'yes' }).then(all =>
        setAllExportedTexts(new Set(all.map(e => e.selected_text.toLowerCase())))
      )
      getArticleStats(articleId).then(setArticleStats)
      getNotes(articleId).then(n => {
        setNotes(n)
        if (a.text) {
          const toks = a.text.startsWith('<') ? tokenizeHtml(a.text).tokens : tokenizePlain(a.text)
          const ranges: [number, number][] = []
          for (const note of n) {
            if (note.selected_text) {
              const r = findPhraseRange(toks, note.selected_text)
              if (r) ranges.push(r)
            }
          }
          setUnderlinedRanges(ranges)
        }
      })
    })
  }, [articleId])

  // ---------------------------------------------------------------------------
  // Dictionary lookup
  // ---------------------------------------------------------------------------

  const getDictMode = (lang: string) =>
    settings.languageSettings?.[lang.toUpperCase()]?.mode || 'both'

const doLookup = useCallback(async (word: string, sentence: string) => {
    if (!articleRef.current) return
    const art = articleRef.current
    selectedTextRef.current = word
    selectedSentenceRef.current = sentence
    setLookupResult(null); setWiktResult(null); setSentenceTranslation(null)

    const mode = getDictMode(art.language)
    const showTrans = mode === 'translation' || mode === 'both'
    const showWikt = mode === 'wiktionary' || mode === 'both' || mode === 'monolingual'
    const mono = mode === 'monolingual'

    let lookupTerm = word
    if (!word.trim().includes(' ')) {
      const result = await lemmatizeWord(word, art.language)
      lookupTerm = result.lemma
      setLemmaInfo(result)
    } else {
      setLemmaInfo(null)
    }

    if (showTrans) {
      setLookupLoading(true)
      // Use the original 'word' (unlemmatized) for translation (DeepL)
      lookupWord(word, art.language, art.target_language)
        .then(setLookupResult).catch(console.error)
        .finally(() => setLookupLoading(false))
    }
    if (showWikt) {
      setWiktLoading(true)
      // Use the 'lookupTerm' (lemmatized) for dictionary lookup
      lookupWiktionary(lookupTerm, art.language, mono)
        .then(setWiktResult).catch(console.error)
        .finally(() => setWiktLoading(false))
    }
  }, [settings])

  // ---------------------------------------------------------------------------
  // Mouse / selection handlers
  // ---------------------------------------------------------------------------

  const handleWordClick = useCallback((tokenIdx: number) => {
    if (isDraggingRef.current) return
    const toks = plainTokensRef.current
    const word = stripPunctuation(toks[tokenIdx])
    if (!word) return
    setDragStart(null); setDragEnd(null)
    dragStartRef.current = null; dragEndRef.current = null
    setSelectedIndex(tokenIdx)
    const charOffset = charOffsetOfToken(toks, tokenIdx)
    const sentence = getSentenceForOffset(plainTextRef.current, charOffset)
    setCurrentStatus(wordStatuses[word.toLowerCase()] === 'learning' ? 'learning' : null)
    doLookup(word, sentence)
  }, [doLookup, wordStatuses])

  const handleMouseDown = useCallback((tokenIdx: number) => {
    isDraggingRef.current = false
    dragStartRef.current = tokenIdx; dragEndRef.current = tokenIdx
    setDragStart(tokenIdx); setDragEnd(tokenIdx); setSelectedIndex(null)
  }, [])

  const handleMouseEnter = useCallback((tokenIdx: number) => {
    if (dragStartRef.current === null) return
    if (tokenIdx !== dragStartRef.current) {
      isDraggingRef.current = true
      dragEndRef.current = tokenIdx; setDragEnd(tokenIdx)
    }
  }, [])

  useEffect(() => {
    const onMouseUp = () => {
      if (!isDraggingRef.current || dragStartRef.current === null) {
        isDraggingRef.current = false; dragStartRef.current = null; return
      }
      isDraggingRef.current = false
      const toks = plainTokensRef.current
      const rawLo = Math.min(dragStartRef.current, dragEndRef.current ?? dragStartRef.current)
      const rawHi = Math.max(dragStartRef.current, dragEndRef.current ?? dragStartRef.current)
      dragStartRef.current = null
      let lo = rawLo, hi = rawHi
      while (lo <= hi && !stripPunctuation(toks[lo] || '')) lo++
      while (hi >= lo && !stripPunctuation(toks[hi] || '')) hi--
      if (lo > hi) return
      const selectedText = toks.slice(lo, hi + 1).join('').replace(/\s+/g, ' ').trim()
      if (!selectedText) return
      const charOffset = charOffsetOfToken(toks, lo)
      const plain = plainTextRef.current
      const sentenceAtLo = getSentenceForOffset(plain, charOffset)
      const sentenceAtHi = getSentenceForOffset(plain, charOffsetOfToken(toks, hi))
      const sentence = sentenceAtLo === sentenceAtHi ? sentenceAtLo : selectedText
      setDragStart(lo); setDragEnd(hi); setCurrentStatus(null)
      doLookup(selectedText, sentence)
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [doLookup])

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  const handleToggleLearning = useCallback(async () => {
    if (!articleRef.current) return
    const word = stripPunctuation(selectedTextRef.current).toLowerCase()
    if (!word) return
    const current = wordStatuses[word]
    const next = current === 'learning' ? null : 'learning'
    if (next === null) {
      const updated = { ...wordStatuses }; delete updated[word]; setWordStatuses(updated)
    } else {
      setWordStatuses(prev => ({ ...prev, [word]: next }))
    }
    setCurrentStatus(next)
    await updateWordStatus(
      word, articleRef.current.language, next ?? 'unknown',
      next === 'learning' ? selectedSentenceRef.current : undefined,
      next === 'learning' ? articleRef.current.id : undefined,
    )
    getArticleStats(articleId).then(setArticleStats)
  }, [wordStatuses, articleId])

  const handleTranslateSentence = useCallback(async () => {
    if (!selectedSentenceRef.current || !articleRef.current) return
    setSentenceLoading(true)
    try {
      const t = await translateSentence(
        selectedSentenceRef.current,
        articleRef.current.language,
        articleRef.current.target_language,
      )
      setSentenceTranslation(t)
    } catch (e) { console.error(e) }
    finally { setSentenceLoading(false) }
  }, [])

  const handleAddToBank = useCallback(async () => {
    if (!articleRef.current || !selectedTextRef.current) return
    setBankLoading(true)
    try {
      const word = selectedTextRef.current
      const sentence = selectedSentenceRef.current

      // Attach any reader notes for words in this sentence as hints on the card
      const wordsInSentence = sentence.toLowerCase().split(/\s+/)
      const relevantNotes = notes.filter(note => {
        if (!note.selected_text) return false
        const noteWord = note.selected_text.toLowerCase()
        return wordsInSentence.includes(noteWord) || sentence.toLowerCase().includes(noteWord)
      })
      const combinedHint = relevantNotes.length > 0
        ? relevantNotes.map(n => `[${n.selected_text}]: ${n.note_text}`).join('\n\n')
        : ''

      const clozeContext = sentence.includes(word)
        ? sentence.replace(word, `{{c1::${word}}}`)
        : `{{c1::${word}}} — ${sentence}`

      let sentTrans: string | undefined
      try {
        sentTrans = await translateSentence(
          sentence, articleRef.current.language, articleRef.current.target_language,
        )
      } catch { /* ok */ }

      const entry = await addToWordBank({
        article_id: articleRef.current.id,
        selected_text: word,
        sentence_context: clozeContext,
        sentence_translation: sentTrans,
        hint: '',
        notes: combinedHint,
      })
      setWordBankEntries(prev => [...prev, {
        ...entry,
        sentence_context: clozeContext,
        sentence_translation: sentTrans ?? null,
        hint: '',
        notes: combinedHint,
        exported_at: null,
        created_at: new Date().toISOString(),
      }])
    } catch (e) { console.error(e) }
    finally { setBankLoading(false) }
  }, [notes])

  const handleOpenNote = useCallback(() => {
    const text = selectedTextRef.current.trim()
    setNoteDraft('')
    setTimeout(() => setNoteModal({ open: true, prefill: text }), 0)
  }, [])

  const handleSaveNote = async () => {
    if (!noteDraft.trim()) { setNoteModal({ open: false, prefill: '' }); return }
    const selectedText = noteModal.prefill.trim() || undefined
    const note = await createNote({
      article_id: article?.id,
      selected_text: selectedText,
      note_text: noteDraft.trim(),
    })
    setNotes(prev => [note, ...prev])
    if (selectedText) {
      const r = findPhraseRange(plainTokensRef.current, selectedText)
      if (r) setUnderlinedRanges(prev => [...prev, r])
    }
    setNoteModal({ open: false, prefill: '' })
    setNoteDraft('')

    await refreshWordBank()
  }

  const handleSaveEdit = async () => {
    if (!article) return
    setSavingEdit(true)
    await Promise.all([
      updateArticleText(article.id, editText),
      updateArticle(article.id, { title: editTitle, subtitle: editSubtitle, tags: editTags, source_url: editUrl }),
    ])
    setArticle(prev => prev ? { ...prev, text: editText, title: editTitle, subtitle: editSubtitle, tags: editTags, source_url: editUrl } : prev)
    if (editText && editText.startsWith('<')) {
      const { tokens, blockMap: bm, inlineMap: im, plainText: pt } = tokenizeHtml(editText)
      setPlainTokens(tokens); setBlockMap(bm); setInlineMap(im); setPlainText(pt)
    } else if (editText) {
      setPlainTokens(tokenizePlain(editText)); setBlockMap([]); setInlineMap([]); setPlainText(editText)
    }
    setIsEditing(false); setSavingEdit(false)
  }

  const handleCopyToClipboard = useCallback(() => {
    const text = selectedTextRef.current.trim()
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      const el = document.createElement('div')
      el.textContent = `Copied: "${text.slice(0, 50)}${text.length > 50 ? '…' : ''}"`
      el.style.cssText = `position:fixed;bottom:20px;right:20px;background:var(--accent);color:white;
        padding:8px 16px;border-radius:8px;font-family:'DM Mono',monospace;font-size:0.8rem;
        z-index:1000;opacity:0;transition:opacity 0.2s;pointer-events:none;`
      document.body.appendChild(el)
      setTimeout(() => { el.style.opacity = '1' }, 10)
      setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 200) }, 2000)
    }).catch(console.error)
  }, [])

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || isEditing) return
      if (e.key === 'c' || e.key === 'C') { e.preventDefault(); handleCopyToClipboard(); return }
      if (e.key === 'l' || e.key === 'L') handleToggleLearning()
      if (e.key === 'n' || e.key === 'N') handleOpenNote()
      if (e.key === 'a' || e.key === 'A') handleAddToBank()
      if (e.key === 't' || e.key === 'T') handleTranslateSentence()
      if (e.key === 'Escape') {
        setSelectedIndex(null); setDragStart(null); setDragEnd(null)
        setLookupResult(null); setWiktResult(null)
        selectedTextRef.current = ''
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isEditing, handleToggleLearning, handleOpenNote, handleAddToBank, handleTranslateSentence, handleCopyToClipboard])

  // ---------------------------------------------------------------------------
  // Scroll tracking
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const handler = () => setScrolled(el.scrollTop > 80)
    el.addEventListener('scroll', handler)
    return () => el.removeEventListener('scroll', handler)
  }, [article])

  // ---------------------------------------------------------------------------
  // Token rendering
  // ---------------------------------------------------------------------------

  const isInDragRange = (idx: number) => {
    if (dragStart === null || dragEnd === null) return false
    return idx >= Math.min(dragStart, dragEnd) && idx <= Math.max(dragStart, dragEnd)
  }

  const isInUnderlinedRange = (idx: number) =>
    underlinedRanges.some(([lo, hi]) => idx >= lo && idx <= hi)

  const getEffectiveStatus = (word: string): WordStatus | null =>
    wordStatuses[word.toLowerCase()] === 'learning' ? 'learning' : null

  const renderToken = (tok: string, globalIdx: number) => {
    const clean = stripPunctuation(tok)
    if (!clean) return <span key={globalIdx}>{tok}</span>
    const inDrag = isInDragRange(globalIdx)
    const isSelected = selectedIndex === globalIdx
    const fmt = inlineMap[globalIdx]
    const token = (
      <WordToken
        key={globalIdx} word={tok}
        isSelected={isSelected || inDrag}
        status={isSelected || inDrag ? null : getEffectiveStatus(clean)}
        underlined={isInUnderlinedRange(globalIdx)}
        onClick={() => handleWordClick(globalIdx)}
        onMouseDown={() => handleMouseDown(globalIdx)}
        onMouseEnter={() => handleMouseEnter(globalIdx)}
      />
    )
    if (!fmt) return token
    if (fmt.bold && fmt.italic) return <strong key={globalIdx} style={{ fontStyle: 'italic' }}>{token}</strong>
    if (fmt.bold) return <strong key={globalIdx}>{token}</strong>
    if (fmt.italic) return <em key={globalIdx}>{token}</em>
    return token
  }

  const renderTokens = (toks: string[], indexOffset = 0) => {
    if (blockMap.length === 0) return toks.map((tok, ti) => renderToken(tok, indexOffset + ti))
    const blocks: { tag: string; items: { tok: string; globalIdx: number }[] }[] = []
    let current: { tag: string; items: { tok: string; globalIdx: number }[] } | null = null
    for (let ti = 0; ti < toks.length; ti++) {
      const globalIdx = indexOffset + ti
      const tok = toks[ti]
      const tag = blockMap[globalIdx] || 'p'
      if (tok === '\n') {
        if (current && current.items.length > 0) blocks.push(current)
        current = null
      } else {
        if (!current) current = { tag, items: [] }
        current.items.push({ tok, globalIdx })
      }
    }
    if (current && current.items.length > 0) blocks.push(current)
    return blocks.map((block, gi) => {
      const Tag = block.tag as any
      return (
        <Tag key={gi} style={blockStyle(block.tag)}>
          {block.items.map(({ tok, globalIdx }) => renderToken(tok, globalIdx))}
        </Tag>
      )
    })
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!article) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '50vh', color: 'var(--ink-muted)', fontStyle: 'italic', fontFamily: 'Lora, serif',
    }}>
      Loading…
    </div>
  )

  const dictionaryMode = getDictMode(article.language)
  const mainMaxWidth = { centered: '620px', wide: '900px', full: '100%' }[layout]
  const mono = 'DM Mono, monospace'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 53px)' }}>

      {/* ── Reader toolbar ── */}
      <div style={{ background: 'var(--panel-bg)', borderBottom: '1px solid var(--border)', padding: '10px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'var(--ink-muted)', cursor: 'pointer', fontFamily: mono, fontSize: '0.75rem', padding: '4px 8px', borderRadius: 4 }}>
            ← Library
          </button>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span style={{ fontFamily: 'Lora, serif', fontWeight: 600, fontSize: '0.95rem' }}>{article.title}</span>
          {article.source_url && (
            <a href={article.source_url} target="_blank" rel="noopener noreferrer" style={{
              fontFamily: mono, fontSize: '0.68rem', color: 'var(--accent)',
              textDecoration: 'none', border: '1px solid var(--accent)',
              borderRadius: 4, padding: '2px 7px', flexShrink: 0,
            }}>↗ source</a>
          )}
          <span style={{ fontFamily: mono, fontSize: '0.7rem', color: 'var(--ink-muted)', marginLeft: 'auto' }}>
            {article.language} → {article.target_language} · {article.word_count.toLocaleString()} words
            {articleStats && (
              <span> · {articleStats.unique.toLocaleString()} unique
                {articleStats.learning > 0 && <span style={{ color: '#60a5fa' }}> · {articleStats.learning} learning</span>}
              </span>
            )}
          </span>

          {/* Layout switcher */}
          <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 5, overflow: 'hidden' }}>
            {(['centered', 'wide', 'full'] as const).map((l, i) => (
              <button key={l} onClick={() => setLayout(l)} title={l} style={{
                padding: '3px 8px', border: 'none', cursor: 'pointer',
                fontFamily: mono, fontSize: '0.65rem',
                background: layout === l ? 'var(--accent)' : 'transparent',
                color: layout === l ? 'white' : 'var(--ink-muted)',
                borderRight: i < 2 ? '1px solid var(--border)' : 'none',
              }}>
                {l === 'centered' ? '⬜' : l === 'wide' ? '▭' : '▬'}
              </button>
            ))}
          </div>

          {/* Edit toggle */}
          {!isEditing ? (
            <button onClick={() => {
              setEditText(article.text || ''); setEditTitle(article.title)
              setEditSubtitle(article.subtitle || ''); setEditTags(article.tags || '')
              setEditUrl(article.source_url || ''); setIsEditing(true)
            }} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontFamily: mono, fontSize: '0.7rem', color: 'var(--ink-muted)' }}>
              Edit text
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setIsEditing(false)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontFamily: mono, fontSize: '0.7rem', color: 'var(--ink-muted)' }}>Cancel</button>
              <button onClick={handleSaveEdit} disabled={savingEdit} style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontFamily: mono, fontSize: '0.7rem', opacity: savingEdit ? 0.6 : 1 }}>
                {savingEdit ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Main three-column layout ── */}
      <div style={{ display: 'flex', flex: 1 }}>
        <NotesPanel
          notes={notes}
          onDelete={async (id) => {
            const note = notes.find(n => n.id === id)
            await deleteNote(id)
            setNotes(prev => prev.filter(n => n.id !== id))
            if (note?.selected_text) {
              const remaining = notes.filter(n => n.id !== id && n.selected_text)
              const ranges: [number, number][] = []
              for (const n of remaining) {
                const r = findPhraseRange(plainTokensRef.current, n.selected_text!)
                if (r) ranges.push(r)
              }
              setUnderlinedRanges(ranges)
            }
          }}
          onUpdate={async (id, text) => {
            await updateNote(id, text)
            setNotes(prev => prev.map(n => n.id === id ? { ...n, note_text: text } : n))
            await refreshWordBank()
          }}
        />

        <main ref={mainRef} style={{ flex: 1, padding: '40px 48px', maxWidth: mainMaxWidth, margin: '0 auto', overflowY: 'auto', width: '100%' }}>
          {!isEditing && (
            <div style={{ marginBottom: scrolled ? 16 : 32, transition: 'margin-bottom 0.3s' }}>
              <h1 style={{ fontFamily: 'Lora, serif', fontWeight: 700, fontSize: scrolled ? '1.3rem' : '2rem', lineHeight: 1.25, color: 'var(--ink)', margin: 0, transition: 'font-size 0.3s' }}>
                {article.title}
              </h1>
              {article.subtitle && (
                <p style={{ fontFamily: 'Lora, serif', fontSize: scrolled ? '0.85rem' : '1.1rem', color: 'var(--ink-muted)', fontStyle: 'italic', margin: scrolled ? '4px 0 0' : '8px 0 0', transition: 'font-size 0.3s, margin 0.3s' }}>
                  {article.subtitle}
                </p>
              )}
            </div>
          )}

          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Title', value: editTitle, onChange: setEditTitle, placeholder: '' },
                  { label: 'Subtitle', value: editSubtitle, onChange: setEditSubtitle, placeholder: 'optional' },
                  { label: 'Tags', value: editTags, onChange: setEditTags, placeholder: '@folder tag1' },
                  { label: 'Source URL', value: editUrl, onChange: setEditUrl, placeholder: 'https://…' },
                ].map(({ label, value, onChange, placeholder }) => (
                  <div key={label}>
                    <label style={{ fontSize: '0.7rem', fontFamily: mono, color: 'var(--ink-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>{label}</label>
                    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                      style={{ width: '100%', fontFamily: 'Lora, serif', fontSize: '0.95rem', padding: '7px 10px', background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', fontFamily: mono, color: 'var(--ink-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Text</label>
                <RichEditor content={editText} onChange={setEditText} />
              </div>
            </div>
          ) : (
            <div style={{ fontFamily: 'Lora, serif', fontSize: 'var(--reader-font-size, 1.15rem)', lineHeight: 2, color: 'var(--ink)', userSelect: 'none' }}>
              {renderTokens(plainTokens)}
            </div>
          )}

          <WordBankPanel
            entries={wordBankEntries}
            onDelete={async (id) => { await deleteWordBankEntry(id); setWordBankEntries(prev => prev.filter(e => e.id !== id)) }}
            onUpdateNotes={async (id, notes) => { await updateWordBankEntry(id, { notes }); setWordBankEntries(prev => prev.map(e => e.id === id ? { ...e, notes } : e)) }}
            onExport={() => setShowExport(true)}
          />
        </main>

        <ReaderDictionaryPanel
          result={lookupResult}
          loading={lookupLoading}
          wiktResult={wiktResult}
          wiktLoading={wiktLoading}
          isLearning={currentStatus === 'learning'}
          onToggleLearning={handleToggleLearning}
          onTranslateSentence={handleTranslateSentence}
          sentenceTranslation={sentenceTranslation}
          sentenceLoading={sentenceLoading}
          onAddToBank={handleAddToBank}
          bankLoading={bankLoading}
          dictionaryMode={dictionaryMode}
          onAddNote={handleOpenNote}
          article={article}
          lemmaInfo={lemmaInfo}
        />
      </div>

      {/* ── Export overlay ── */}
      {showExport && (
        <ExportOverlay
          entries={wordBankEntries}
          allExportedTexts={allExportedTexts}
          onClose={() => setShowExport(false)}
          onExported={(ids) => {
            const now = new Date().toISOString()
            setWordBankEntries(prev => prev.map(e => ids.includes(e.id) ? { ...e, exported_at: now } : e))
            setShowExport(false)
          }}
        />
      )}

      {/* ── Note modal ── */}
      {noteModal.open && (
        <div
          style={{ position: 'fixed', inset: 0, background: '#000000aa', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setNoteModal({ open: false, prefill: '' })}
        >
          <div
            style={{ background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, width: 480, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 14 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontFamily: 'Lora, serif', fontWeight: 600, fontSize: '1rem' }}>
              {noteModal.prefill ? 'Add note' : 'Freeform note'}
            </div>
            {noteModal.prefill && (
              <blockquote style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 12, margin: 0, fontFamily: 'Lora, serif', fontSize: '0.9rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>
                {noteModal.prefill}
              </blockquote>
            )}
            <textarea
              autoFocus value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveNote() }}
              placeholder="Your note…" rows={4}
              style={{ width: '100%', fontFamily: 'DM Sans, sans-serif', fontSize: '0.9rem', padding: '8px 10px', background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--ink)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setNoteModal({ open: false, prefill: '' })} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, padding: '6px 16px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', color: 'var(--ink-muted)' }}>Cancel</button>
              <button onClick={handleSaveNote} style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 5, padding: '6px 16px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', fontWeight: 500 }}>Save note</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
