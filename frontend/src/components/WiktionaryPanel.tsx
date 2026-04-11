interface WiktionaryResult {
  word: string
  found: boolean
  definitions: { pos: string | null; text: string }[]
  part_of_speech: string | null
  gender: string | null
  etymology: string | null
  phonetic?: string | null
  forms?: string | null
  source?: string
  monolingual?: boolean
}

interface Props {
  result: WiktionaryResult | null
  loading: boolean
}

export default function WiktionaryPanel({ result, loading }: Props) {
  const mono = 'DM Mono, monospace'
  const label = {
    fontSize: '9px', letterSpacing: '0.12em', color: 'var(--ink-muted)',
    fontFamily: mono, textTransform: 'uppercase' as const, marginBottom: 5, display: 'block',
  }
  const badge = (accent = false): React.CSSProperties => ({
    fontFamily: mono, fontSize: '0.65rem', padding: '2px 7px', borderRadius: 3,
    ...(accent
      ? { color: 'var(--accent)', background: 'var(--accent-light)' }
      : { color: 'var(--ink-muted)', background: 'var(--paper-alt)', border: '1px solid var(--border)' }),
  })

  if (loading) return (
    <div style={{ color: 'var(--ink-muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>
      Looking up…
    </div>
  )
  if (!result) return null
  if (!result.found) return (
    <div style={{ color: 'var(--ink-muted)', fontSize: '0.8rem', fontStyle: 'italic', fontFamily: 'Lora, serif' }}>
      No entry found.
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Source */}
      {result.source && (
        <div style={{ fontFamily: mono, fontSize: '0.62rem', color: 'var(--ink-muted)', background: 'var(--paper-alt)', padding: '1px 6px', borderRadius: 3, border: '1px solid var(--border)', width: 'fit-content' }}>
          {result.source}
        </div>
      )}

      {/* IPA */}
      {result.phonetic && (
        <div style={{ fontFamily: mono, fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
          {result.phonetic}
        </div>
      )}

      {/* POS + gender */}
      {(result.part_of_speech || result.gender) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {result.part_of_speech && <span style={badge(true)}>{result.part_of_speech}</span>}
          {result.gender && <span style={badge(false)}>{result.gender}</span>}
        </div>
      )}

      {/* Inflected forms */}
      {result.forms && (
        <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', lineHeight: 1.5 }}>
          {result.forms}
        </div>
      )}

      {/* Definitions */}
      {result.definitions.length > 0 && (
        <div>
          <span style={label}>Definitions</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.definitions.map((d, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: '0.82rem', lineHeight: 1.55 }}>
                <span style={{ fontFamily: mono, fontSize: '0.72rem', color: 'var(--accent)', flexShrink: 0, marginTop: '1px', minWidth: 14 }}>
                  {i + 1}.
                </span>
                <span style={{ color: 'var(--ink)' }}>{d.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
