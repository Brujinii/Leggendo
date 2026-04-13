// Shared tokenizer utilities used by ReaderPage.
// Handles plain-text and HTML tokenization, sentence detection, and phrase lookup.

export interface HtmlBlock {
  tag: string
  text: string
  innerHtml: string
}

export interface InlineFormat {
  bold: boolean
  italic: boolean
}

export interface TokenizeHtmlResult {
  tokens: string[]
  blockMap: string[]
  inlineMap: InlineFormat[]
  plainText: string
}

// ---------------------------------------------------------------------------
// Plain text tokenization
// ---------------------------------------------------------------------------

export function tokenizePlain(text: string): string[] {
  const result: string[] = []
  const parts = text.split(/(\s+)/)
  for (const part of parts) {
    if (!part.trim()) { result.push(part); continue }
    const subs = part.split(/(?<=['']\s*)/)
    result.push(...subs.filter(s => s.length > 0))
  }
  return result
}

// ---------------------------------------------------------------------------
// HTML block & inline tokenization
// ---------------------------------------------------------------------------

function parseHtmlBlocks(html: string): HtmlBlock[] {
  const blocks: HtmlBlock[] = []
  const blockRe = /<(h[1-6]|p|blockquote|li)[^>]*>([\s\S]*?)<\/\1>/gi
  let m: RegExpExecArray | null
  let lastIndex = 0
  while ((m = blockRe.exec(html)) !== null) {
    if (m.index > lastIndex) {
      const between = html.slice(lastIndex, m.index).replace(/<[^>]+>/g, '').trim()
      if (between) blocks.push({ tag: 'p', text: between, innerHtml: between })
    }
    const innerHtml = m[2]
    const text = innerHtml.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
    if (text) blocks.push({ tag: m[1].toLowerCase(), text, innerHtml })
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < html.length) {
    const rest = html.slice(lastIndex).replace(/<[^>]+>/g, '').trim()
    if (rest) blocks.push({ tag: 'p', text: rest, innerHtml: rest })
  }
  if (blocks.length === 0) {
    const text = html.replace(/<[^>]+>/g, ' ').trim()
    blocks.push({ tag: 'p', text, innerHtml: html })
  }
  return blocks
}

function tokenizeInlineHtml(innerHtml: string): { tokens: string[]; formats: InlineFormat[] } {
  const tokens: string[] = []
  const formats: InlineFormat[] = []
  const normalized = innerHtml
    .replace(/<strong[^>]*>/gi, '\x01B').replace(/<\/strong>/gi, '\x01b')
    .replace(/<em[^>]*>/gi, '\x01I').replace(/<\/em>/gi, '\x01i')
    .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')

  let bold = false, italic = false, current = ''
  for (let ci = 0; ci < normalized.length; ci++) {
    const ch = normalized[ci]
    if (ch === '\x01' && ci + 1 < normalized.length) {
      if (current) {
        for (const t of tokenizePlain(current)) { tokens.push(t); formats.push({ bold, italic }) }
        current = ''
      }
      const next = normalized[++ci]
      if (next === 'B') bold = true
      else if (next === 'b') bold = false
      else if (next === 'I') italic = true
      else if (next === 'i') italic = false
    } else {
      current += ch
    }
  }
  if (current) for (const t of tokenizePlain(current)) { tokens.push(t); formats.push({ bold, italic }) }
  return { tokens, formats }
}

export function tokenizeHtml(html: string): TokenizeHtmlResult {
  const blocks = parseHtmlBlocks(html)
  const tokens: string[] = []
  const blockMap: string[] = []
  const inlineMap: InlineFormat[] = []
  const plainParts: string[] = []

  for (const block of blocks) {
    const { tokens: bToks, formats } = tokenizeInlineHtml(block.innerHtml)
    for (let i = 0; i < bToks.length; i++) {
      tokens.push(bToks[i]); blockMap.push(block.tag); inlineMap.push(formats[i])
    }
    plainParts.push(block.text)
    tokens.push('\n'); blockMap.push(block.tag); inlineMap.push({ bold: false, italic: false })
  }
  return { tokens, blockMap, inlineMap, plainText: plainParts.join('\n') }
}

// ---------------------------------------------------------------------------
// Sentence & offset utilities
// ---------------------------------------------------------------------------

export function getSentenceForOffset(plainText: string, charOffset: number): string {
  const re = /[^.!?\n]+[.!?\n]*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(plainText)) !== null) {
    if (m.index <= charOffset && charOffset < m.index + m[0].length) {
      return m[0].trim()
    }
  }
  return plainText.trim()
}

export function getSentenceForWord(plainText: string, word: string): string {
  const re = /[^.!?\n]+[.!?\n]*/g
  let m: RegExpExecArray | null
  const lower = word.toLowerCase()
  while ((m = re.exec(plainText)) !== null) {
    if (m[0].toLowerCase().includes(lower)) {
      return m[0].trim()
    }
  }
  return plainText.trim()
}

export function charOffsetOfToken(tokens: string[], idx: number): number {
  return tokens.slice(0, idx).join('').length
}

// Strip leading/trailing non-letter/non-number characters, matching how
// selectedTextRef is built (via stripPunctuation) before being stored in notes.
function stripEdgePunctuation(s: string): string {
  return s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

export function findPhraseRange(tokens: string[], phrase: string): [number, number] | null {
  const needle = phrase.replace(/\s+/g, ' ').trim().toLowerCase()
  // Skip '\n' sentinel tokens inserted by tokenizeHtml between blocks —
  // they break cross-block phrase matching.
  const visible = tokens.map((t, i) => ({ t, i })).filter(({ t }) => t !== '\n')

  for (let vi = 0; vi < visible.length; vi++) {
    let candidate = ''
    for (let vj = vi; vj < visible.length; vj++) {
      candidate += visible[vj].t
      // Compare two ways:
      // 1. Raw join with spaces collapsed (matches multi-word drag selections)
      // 2. Edge-punctuation stripped (matches single-word click selections,
      //    where the stored text is stripPunctuation(token) e.g. "casa" not "casa,")
      const norm = candidate.replace(/\s+/g, ' ').trim().toLowerCase()
      const normStripped = stripEdgePunctuation(norm)
      if (norm === needle || normStripped === needle) return [visible[vi].i, visible[vj].i]
      if (norm.length > needle.length + 20) break
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Block style helper
// ---------------------------------------------------------------------------

export function blockStyle(tag: string): React.CSSProperties {
  if (tag === 'h1') return { fontFamily: 'Lora, serif', fontSize: '1.6em', fontWeight: 700, margin: '0.8em 0 0.4em', lineHeight: 1.3 }
  if (tag === 'h2') return { fontFamily: 'Lora, serif', fontSize: '1.35em', fontWeight: 600, margin: '0.7em 0 0.3em', lineHeight: 1.3 }
  if (tag === 'h3') return { fontFamily: 'Lora, serif', fontSize: '1.15em', fontWeight: 600, margin: '0.6em 0 0.3em', lineHeight: 1.3 }
  if (tag === 'blockquote') return { borderLeft: '3px solid var(--accent)', margin: '1em 0', paddingLeft: 16, color: 'var(--ink-muted)', fontStyle: 'italic' }
  if (tag === 'li') return { marginBottom: '0.3em' }
  return { margin: '0 0 1em 0' }
}
