import type { LookupResult, Article } from '../types'
import WiktionaryPanel from './WiktionaryPanel'
import SpeechButton from './SpeechButton'

export interface LemmaInfo {
  word: string
  lemma: string
  morphology: string | null 
  changed: boolean
  available: boolean
  reason: string | null
}

interface Props {
  result: LookupResult | null
  loading: boolean
  wiktResult: any
  wiktLoading: boolean
  isLearning: boolean
  onToggleLearning: () => void
  onTranslateSentence: () => void
  sentenceTranslation: string | null
  sentenceLoading: boolean
  onAddToBank: () => void
  bankLoading: boolean
  dictionaryMode: string
  onAddNote: () => void
  article: Article | null
  lemmaInfo: LemmaInfo | null
}

export default function ReaderDictionaryPanel({
  result, loading, wiktResult, wiktLoading,
  isLearning, onToggleLearning,
  onTranslateSentence, sentenceTranslation, sentenceLoading,
  onAddToBank, bankLoading,
  dictionaryMode, onAddNote, article,
  lemmaInfo,
}: Props) {
  const mono = 'DM Mono, monospace'

  const lbl: React.CSSProperties = {
    fontSize: '10px',
    letterSpacing: '0.12em',
    color: 'var(--ink-muted)',
    fontFamily: mono,
    textTransform: 'uppercase',
  }

  const showTrans = dictionaryMode === 'translation' || dictionaryMode === 'both'
  const showWikt = dictionaryMode === 'wiktionary' || dictionaryMode === 'both' || dictionaryMode === 'monolingual'

  const hasContent = !!(result || wiktResult || loading || wiktLoading)

  const inflectedWord = lemmaInfo?.word || result?.word || ''
  const lemma = lemmaInfo?.lemma || ''

  return (
    <aside style={{
      width: 'var(--sidebar-w)',
      background: 'var(--panel-bg)',
      borderLeft: '1px solid var(--border)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      position: 'sticky',
      top: '53px',
      height: 'calc(100vh - 53px)',
      overflowY: 'auto',
      flexShrink: 0,
    }}>

      <div style={{ flex: 1 }}>

        {/* 1. Learning Button */}
        {hasContent && (
          <button onClick={onToggleLearning} style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 6,
            border: `1px solid ${isLearning ? '#60a5fa' : 'var(--border)'}`,
            background: isLearning ? '#60a5fa22' : 'var(--paper)',
            color: isLearning ? '#60a5fa' : 'var(--ink-muted)',
            fontSize: '0.75rem',
            fontFamily: mono,
            cursor: 'pointer',
            transition: 'all 0.15s',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            marginBottom: 20,
          }}>
            {isLearning ? '★ Learning' : '☆ Mark as learning'}
            <kbd style={{ opacity: 0.5, fontSize: '0.65rem' }}>L</kbd>
          </button>
        )}

        {/* 2. Inflected Word (same size as old lemma) */}
        {hasContent && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{
                margin: 0,
                fontFamily: 'Lora, serif',
                fontSize: '1.4rem',
                fontWeight: 600,
                color: 'var(--ink)',
              }}>
                {inflectedWord}
              </h2>
              <SpeechButton
                text={inflectedWord}
                language={article?.language}
                size="small"
              />
            </div>

            {/* Morphology / tags */}
            {lemmaInfo?.morphology && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {lemmaInfo.morphology.split(' • ').map((tag, i) => (
                  <span key={i} style={{
                    fontSize: '0.65rem',
                    fontFamily: mono,
                    color: 'var(--accent)',
                    background: 'var(--accent-faint)',
                    padding: '2px 6px',
                    borderRadius: 4,
                    border: '1px solid var(--accent-light)',
                    fontWeight: 500
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. Translation */}
        {showTrans && (
          <div style={{ marginTop: 18 }}>
            <div style={{ ...lbl, marginBottom: 10 }}>Translation</div>
            {loading ? (
              <div style={{ color: 'var(--ink-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>Looking up…</div>
            ) : !result ? (
              <p style={{ color: 'var(--ink-muted)', fontFamily: 'Lora, serif', fontStyle: 'italic', fontSize: '0.9rem' }}>Select a word.</p>
            ) : (
              <div style={{ background: 'var(--accent-light)', borderRadius: 6, padding: '10px 14px' }}>
                <div style={{ fontFamily: 'Lora, serif', fontSize: '1.1rem', color: 'var(--ink)', lineHeight: 1.4 }}>
                  {result.translation}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        {hasContent && (
          <div style={{ borderTop: '1px solid var(--border)', margin: '24px 0 10px' }} />
        )}

        {/* Dictionary Title */}
        {showWikt && (
          <div style={{ marginBottom: 10 }}>
            <div style={lbl}>Dictionary</div>
          </div>
        )}

        {/* Lemma */}
        {showWikt && hasContent && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{
                margin: 0,
                fontFamily: 'Lora, serif',
                fontSize: '1.3rem',
                fontWeight: 600,
                color: 'var(--ink-muted)',
              }}>
                {lemma}
              </h2>
              <SpeechButton
                text={lemma}
                language={article?.language}
                size="small"
              />
            </div>
          </div>
        )}

        {/* Dictionary Entry */}
        {showWikt && (
          <WiktionaryPanel result={wiktResult} loading={wiktLoading} />
        )}

        {/* Sentence Translation (original style restored) */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18, marginTop: 28 }}>
          <div style={{ ...lbl, marginBottom: 10 }}>Sentence <kbd>T</kbd></div>
          <button onClick={onTranslateSentence} disabled={sentenceLoading} style={{
            background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 5,
            padding: '8px 16px', fontSize: '0.8rem', cursor: 'pointer',
            opacity: sentenceLoading ? 0.6 : 1, fontFamily: 'DM Sans, sans-serif',
          }}>
            {sentenceLoading ? 'Translating…' : 'Translate sentence'}
          </button>
          {sentenceTranslation && (
            <p style={{
              marginTop: 12, fontSize: '0.85rem', fontFamily: 'Lora, serif',
              lineHeight: 1.6, color: 'var(--ink-muted)', fontStyle: 'italic',
              background: 'var(--paper-dark)', padding: '10px', borderRadius: 6
            }}>
              {sentenceTranslation}
            </p>
          )}
        </div>

        {/* Word Bank (original style restored) */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18, marginTop: 28 }}>
          <div style={{ ...lbl, marginBottom: 10 }}>Word bank <kbd>A</kbd></div>
          <button onClick={onAddToBank} disabled={bankLoading} style={{
              background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)',
              borderRadius: 5, padding: '6px 14px', fontSize: '0.8rem', cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif', opacity: bankLoading ? 0.6 : 1,
          }}>
              {bankLoading ? 'Adding…' : '+ Add to word bank'}
          </button>
        </div>

        {/* Notes (original style restored) */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18, marginTop: 28 }}>
          <div style={{ ...lbl, marginBottom: 10 }}>Note <kbd>N</kbd></div>
          <button onClick={onAddNote} style={{
              background: 'transparent', color: 'var(--ink-muted)', border: '1px solid var(--border)',
              borderRadius: 5, padding: '6px 14px', fontSize: '0.8rem', cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
          }}>
              + Add note
          </button>
        </div>

      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <div style={lbl}>Leggendo v0.1</div>
      </div>

    </aside>
  )
}
