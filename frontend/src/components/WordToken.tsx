import type { WordStatus } from '../types'

interface Props {
  word: string
  isSelected: boolean
  status?: WordStatus | null
  underlined?: boolean
  onClick: () => void
  onMouseDown?: () => void
  onMouseEnter?: () => void
}

export function stripPunctuation(word: string): string {
  return word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

export default function WordToken({ word, isSelected, status, underlined, onClick, onMouseDown, onMouseEnter }: Props) {
  const clean = stripPunctuation(word)
  if (!clean) return <span>{word}</span>

  const classes = [
    'word-token',
    isSelected ? 'selected' : '',
    !isSelected && status ? `status-${status}` : '',
  ].filter(Boolean).join(' ')

  return (
    <span
      className={classes}
      style={underlined ? {
        textDecoration: 'underline',
        textDecorationColor: isSelected ? 'white' : 'var(--accent)',
        textUnderlineOffset: '3px',
      } : undefined}
      onClick={onClick}
      onMouseDown={(e) => { e.preventDefault(); onMouseDown?.() }}
      onMouseEnter={onMouseEnter}
    >
      {word}
    </span>
  )
}
