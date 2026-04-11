// frontend/src/components/SpeechButton.tsx

import { useState } from 'react'

interface SpeechButtonProps {
  text: string
  language?: string
  size?: 'small' | 'medium'
}

export default function SpeechButton({ text, language = 'it-IT', size = 'medium' }: SpeechButtonProps) {
  const [speaking, setSpeaking] = useState(false)
  
  const speak = () => {
    if (!window.speechSynthesis) {
      alert('Text-to-speech not supported in your browser')
      return
    }
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel()
    
    const utterance = new SpeechSynthesisUtterance(text)
    
    // Map language codes to browser speech codes
    const langMap: Record<string, string> = {
      'IT': 'it-IT',
      'EN': 'en-US',
      'ES': 'es-ES',
      'FR': 'fr-FR',
      'DE': 'de-DE',
      'PT': 'pt-PT',
      'RU': 'ru-RU',
      'JA': 'ja-JP',
      'ZH': 'zh-CN',
      'KO': 'ko-KR',
      'TR': 'tr-TR',
      'NL': 'nl-NL',
      'PL': 'pl-PL',
      'SV': 'sv-SE',
      'DA': 'da-DK',
      'NB': 'nb-NO',
      'FI': 'fi-FI',
      'CS': 'cs-CZ',
      'RO': 'ro-RO',
      'EL': 'el-GR',
      'BG': 'bg-BG',
      'UK': 'uk-UA',
      'HU': 'hu-HU',
      'LT': 'lt-LT',
      'LV': 'lv-LV',
      'ET': 'et-EE',
    }
    
    // Convert language code to speech code
    const langCode = language.toUpperCase()
    utterance.lang = langMap[langCode] || 'it-IT'
    utterance.rate = 0.9  // Slightly slower for language learning
    utterance.pitch = 1.0
    
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => {
      console.error('Speech synthesis error')
      setSpeaking(false)
    }
    
    window.speechSynthesis.speak(utterance)
  }
  
  const stop = () => {
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }
  
  const sizeStyle = size === 'small' 
    ? { padding: '2px 6px', fontSize: '0.7rem' }
    : { padding: '4px 10px', fontSize: '0.8rem' }
  
  return (
    <button
      onClick={speaking ? stop : speak}
      style={{
        background: speaking ? 'var(--ink-muted)' : 'var(--accent)',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontFamily: 'DM Sans, sans-serif',
        transition: 'all 0.15s',
        ...sizeStyle
      }}
      title={speaking ? 'Stop' : 'Listen to pronunciation'}
    >
      {speaking ? '⏹️' : '🔊'}
    </button>
  )
}