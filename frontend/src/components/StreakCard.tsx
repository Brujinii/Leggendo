import { useState, useEffect } from 'react'

interface StreakData {
  current_streak: number
  longest_streak: number
  total_days_read: number
  daily_activity: Array<{ date: string; words_read: number; articles_read: number }>
}

export default function StreakCard() {
  const [data, setData] = useState<StreakData | null>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetch('/api/streaks')
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])
  
  if (loading) return <div style={{ textAlign: 'center', padding: '20px' }}>Loading streak data...</div>
  if (!data) return null
  
  // Generate last 7 days for heatmap
  const last7Days = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const activity = data.daily_activity.find(d => d.date === dateStr)
    last7Days.push({
      date: dateStr,
      day: date.toLocaleDateString(undefined, { weekday: 'short' }),
      read: !!activity,
      words: activity?.words_read || 0
    })
  }
  
  return (
    <div style={{ 
      background: 'var(--panel-bg)', 
      border: '1px solid var(--border)', 
      borderRadius: '12px', 
      padding: '20px',
      marginBottom: '24px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '0.7rem', fontFamily: 'DM Mono, monospace', color: 'var(--ink-muted)', letterSpacing: '0.1em' }}>
            🔥 STREAK
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, fontFamily: 'Lora, serif', color: 'var(--accent)' }}>
            {data.current_streak}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>
            days in a row
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.7rem', fontFamily: 'DM Mono, monospace', color: 'var(--ink-muted)' }}>
            🏆 LONGEST
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{data.longest_streak}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>
            📚 {data.total_days_read} total days
          </div>
        </div>
      </div>
      
      {/* Weekly heatmap */}
      <div style={{ marginTop: '16px' }}>
        <div style={{ fontSize: '0.65rem', fontFamily: 'DM Mono, monospace', color: 'var(--ink-muted)', marginBottom: '8px' }}>
          LAST 7 DAYS
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
          {last7Days.map(day => (
            <div key={day.date} style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ 
                width: '100%', 
                aspectRatio: '1',
                background: day.read ? 'var(--accent)' : 'var(--border)',
                borderRadius: '6px',
                marginBottom: '4px',
                opacity: day.read ? 1 : 0.3
              }} />
              <div style={{ fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: 'var(--ink-muted)' }}>
                {day.day}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}