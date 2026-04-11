import type { LookupResult, WordStatus, WordBankEntry, Article, Stats, LearningWord, Note } from './types'

const BASE = '/api'

export async function lookupWiktionary(word: string, lang: string, monolingual = false): Promise<any> {
  const p = new URLSearchParams({ word, lang, monolingual: String(monolingual) })
  const res = await fetch(`${BASE}/wiktionary?${p}`)
  if (!res.ok) return { found: false, definitions: [] }
  return res.json()
}

export async function lookupDictionary(word: string, lang: string, mode: string): Promise<any> {
  const p = new URLSearchParams({ word, lang, mode })
  const res = await fetch(`${BASE}/dictionary/lookup?${p}`)
  if (!res.ok) return { found: false, definitions: [] }
  return res.json()
}

export async function getArticleStats(articleId: number): Promise<{ unique: number; learning: number }> {
  const res = await fetch(`${BASE}/articles/${articleId}/stats`)
  if (!res.ok) return { unique: 0, learning: 0 }
  return res.json()
}

export async function lookupWord(word: string, sourceLang: string, targetLang: string): Promise<LookupResult> {
  const p = new URLSearchParams({ word, source_lang: sourceLang, target_lang: targetLang })
  const res = await fetch(`${BASE}/lookup?${p}`)
  if (!res.ok) throw new Error(`Lookup failed: ${res.status}`)
  return res.json()
}

export async function translateSentence(text: string, sourceLang: string, targetLang: string): Promise<string> {
  const p = new URLSearchParams({ text, source_lang: sourceLang, target_lang: targetLang })
  const res = await fetch(`${BASE}/translate-sentence?${p}`)
  if (!res.ok) throw new Error('Translation failed')
  return (await res.json()).translation
}

export async function createArticle(data: {
  title: string; subtitle?: string; text: string; language: string; target_language: string; tags: string; source_url?: string
}): Promise<Article> {
  const res = await fetch(`${BASE}/articles`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create article')
  return res.json()
}

export async function listArticles(sort = 'last_read'): Promise<Article[]> {
  const res = await fetch(`${BASE}/articles?sort=${sort}`)
  if (!res.ok) throw new Error('Failed to fetch articles')
  return res.json()
}

export async function getArticle(id: number): Promise<Article> {
  const res = await fetch(`${BASE}/articles/${id}`)
  if (!res.ok) throw new Error('Article not found')
  return res.json()
}

export async function updateArticleText(id: number, text: string): Promise<void> {
  await fetch(`${BASE}/articles/${id}/text`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}

export async function updateArticle(id: number, data: { tags?: string; title?: string; subtitle?: string; source_url?: string; language?: string; target_language?: string }): Promise<void> {
  await fetch(`${BASE}/articles/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
}

export async function deleteArticle(id: number): Promise<void> {
  await fetch(`${BASE}/articles/${id}`, { method: 'DELETE' })
}

export async function updateWordStatus(
  word: string, language: string, status: WordStatus,
  sentence_context?: string, article_id?: number
): Promise<void> {
  await fetch(`${BASE}/words/status`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word, language, status, sentence_context, article_id }),
  })
}

export async function getWordStatuses(language: string): Promise<Record<string, WordStatus>> {
  const res = await fetch(`${BASE}/words/status?language=${language}`)
  if (!res.ok) return {}
  return res.json()
}

export async function getLearningWords(language?: string): Promise<LearningWord[]> {
  const p = language ? `?language=${language}` : ''
  const res = await fetch(`${BASE}/words/learning${p}`)
  if (!res.ok) return []
  return res.json()
}

export async function deleteWord(id: number): Promise<void> {
  await fetch(`${BASE}/words/${id}`, { method: 'DELETE' })
}

export async function createNote(data: {
  article_id?: number; selected_text?: string; note_text: string
}): Promise<Note> {
  const res = await fetch(`${BASE}/notes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create note')
  return res.json()
}

export async function getNotes(article_id?: number): Promise<Note[]> {
  const p = article_id ? `?article_id=${article_id}` : ''
  const res = await fetch(`${BASE}/notes${p}`)
  if (!res.ok) return []
  return res.json()
}

export async function updateNote(id: number, note_text: string): Promise<void> {
  await fetch(`${BASE}/notes/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note_text }),
  })
}

export async function deleteNote(id: number): Promise<void> {
  await fetch(`${BASE}/notes/${id}`, { method: 'DELETE' })
}

export async function addToWordBank(entry: {
  article_id: number; selected_text: string; sentence_context: string
  sentence_translation?: string; hint?: string; notes?: string
}): Promise<WordBankEntry> {
  const res = await fetch(`${BASE}/wordbank`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry),
  })
  if (!res.ok) throw new Error('Failed to add to word bank')
  return res.json()
}

export async function getWordBank(articleId: number): Promise<WordBankEntry[]> {
  const res = await fetch(`${BASE}/wordbank/${articleId}`)
  if (!res.ok) return []
  return res.json()
}

export async function deleteWordBankEntry(id: number): Promise<void> {
  await fetch(`${BASE}/wordbank/entry/${id}`, { method: 'DELETE' })
}

export async function updateWordBankEntry(id: number, data: {
  sentence_translation?: string; hint?: string; notes?: string
}): Promise<void> {
  await fetch(`${BASE}/wordbank/entry/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
}

export async function getAllWordBank(params?: {
  language?: string; exported?: 'yes' | 'no' | 'all'
}): Promise<WordBankEntry[]> {
  const p = new URLSearchParams()
  if (params?.language) p.set('language', params.language)
  if (params?.exported) p.set('exported', params.exported)
  const res = await fetch(`${BASE}/wordbank?${p}`)
  if (!res.ok) return []
  return res.json()
}

export async function exportCSV(
  entryIds: number[],
  updates: Record<string, { sentence_translation?: string; hint?: string; notes?: string }>
): Promise<void> {
  const res = await fetch(`${BASE}/export/csv`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entry_ids: entryIds, updates }),
  })
  if (!res.ok) throw new Error('Export failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'leggendo_export.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export async function getStats(language?: string): Promise<Stats> {
  const p = language ? `?language=${language}` : ''
  const res = await fetch(`${BASE}/stats${p}`)
  if (!res.ok) throw new Error('Failed to fetch stats')
  return res.json()
}

export async function lemmatizeWord(word: string, lang: string): Promise<{
  word: string
  lemma: string
  morphology: string | null // Added this
  changed: boolean
  available: boolean
  reason: string | null
}> {
  const p = new URLSearchParams({ word, lang })
  const res = await fetch(`${BASE}/lemmatize?${p}`)
  
  if (!res.ok) {
    // Ensure the fallback also includes morphology: null
    return { 
      word, 
      lemma: word, 
      morphology: null, 
      changed: false, 
      available: false, 
      reason: 'API error' 
    }
  }
  
  return res.json()
}

export interface LemmaInfo {
  word: string
  lemma: string
  morphology: string | null // Added
  changed: boolean
  available: boolean
  reason: string | null
}