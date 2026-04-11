export interface Article {
  id: number
  title: string
  subtitle?: string
  language: string
  target_language: string
  word_count: number
  tags: string
  source_url?: string
  created_at: string
  last_read_at: string | null
  text?: string
}

export interface Definition {
  part_of_speech: string | null
  definition: string
  example?: string
}

export interface LookupResult {
  word: string
  translation: string | null
  definitions: Definition[]
  phonetic: string | null
  examples: string[]
}

export type WordStatus = 'unknown' | 'learning' | 'known'

export interface WordBankEntry {
  id: number
  article_id: number
  selected_text: string
  sentence_context: string
  sentence_translation: string | null
  hint: string
  notes: string
  exported_at: string | null
  created_at: string
  // joined fields from global view
  article_title?: string
  language?: string
  target_language?: string
  tags?: string
}

export interface Stats {
  articles: number
  words_learning: number
  word_bank_pending: number
  word_bank_exported: number
  total_words_read: number
}

export interface ArticleStats {
  unique: number
  learning: number
}

export interface LearningWord {
  id: number
  word: string
  language: string
  sentence_context: string | null
  article_id: number | null
  article_title: string | null
  updated_at: string
}

export interface Note {
  id: number
  article_id: number | null
  article_title: string | null
  selected_text: string | null
  note_text: string
  created_at: string
}



export interface LanguageDictionarySettings {
  mode: DictionaryMode
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'sepia'
  defaultSourceLang: string
  defaultTargetLang: string
  fontSize: 'sm' | 'md' | 'lg'
  uiFontSize: 'sm' | 'md' | 'lg'
  readerLayout: 'narrow' | 'medium' | 'full'
  ankiNoteType: string
  ankiDeckPrefix: string
  languageSettings: Record<string, LanguageDictionarySettings>
}
