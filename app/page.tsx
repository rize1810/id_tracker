'use client'

import { useState, useEffect, useCallback } from 'react'

const GAMES = ['Weiss Schwarz', 'Palworld OCG', 'Shadowverse Evolve', 'Cardfight!! Vanguard']

type Registration = {
  id: string
  bushi_navi_id: string
  handle_name: string
  game: string
  created_at: string
}

type AlertState = { type: 'success' | 'error'; message: string } | null

function formatDateKey(dateStr: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(dateStr))  // Returns YYYY-MM-DD in Manila time
}

function formatDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

function formatTime(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  }).format(new Date(dateStr))
}

function groupByDate(regs: Registration[]): Record<string, Registration[]> {
  return regs.reduce<Record<string, Registration[]>>((acc, r) => {
    const key = formatDateKey(r.created_at)
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})
}

export default function Home() {
  const [bushiNaviId, setBushiNaviId] = useState('')
  const [handleName, setHandleName] = useState('')
  const [selectedGame, setSelectedGame] = useState('')
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [alert, setAlert] = useState<AlertState>(null)
  const [activeGame, setActiveGame] = useState(GAMES[0])
  const [activeDate, setActiveDate] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const fetchRegistrations = useCallback(async () => {
    try {
      const res = await fetch('/api/registrations')
      const data = await res.json()
      setRegistrations(Array.isArray(data) ? data : [])
    } catch {
      setRegistrations([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRegistrations()
    const interval = setInterval(fetchRegistrations, 30_000)
    const onVisible = () => { if (!document.hidden) fetchRegistrations() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fetchRegistrations])

  // Derived data
  const gameRegistrations = registrations.filter(r => r.game === activeGame)
  const dateGroups = groupByDate(gameRegistrations)
  const sortedDates = Object.keys(dateGroups).sort((a, b) => b.localeCompare(a))
  const effectiveDate = (activeDate && dateGroups[activeDate]) ? activeDate : (sortedDates[0] ?? null)

  const visibleRegistrations = effectiveDate
    ? [...(dateGroups[effectiveDate] ?? [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    : []

  const handleGameTabClick = (game: string) => {
    setActiveGame(game)
    setActiveDate(null)
  }

  const validate = (): string | null => {
    if (!bushiNaviId.trim()) return 'Bushi Navi ID is required.'
    if (!/^G\d{8}$/i.test(bushiNaviId.trim())) return 'Bushi Navi ID must be GXXXXXXXX (G + 8 digits).'
    if (!handleName.trim()) return 'Handle Name is required.'
    if (!selectedGame) return 'Please select a game.'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (err) { setAlert({ type: 'error', message: err }); return }

    setIsSubmitting(true)
    setAlert(null)

    try {
      const normalizedId = bushiNaviId.trim().toUpperCase()
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bushi_navi_id: normalizedId,
          handle_name: handleName.trim(),
          game: selectedGame,
        }),
      })
      const data = await res.json()

      if (res.status === 409) {
        setAlert({
          type: 'error',
          message: `"${normalizedId}" already registered for ${selectedGame} today.`,
        })
      } else if (res.ok) {
        setAlert({
          type: 'success',
          message: `${normalizedId} registered for ${selectedGame}!`,
        })
        setBushiNaviId('')
        setHandleName('')
        setSelectedGame('')
        setActiveGame(selectedGame)
        setActiveDate(null)
        await fetchRegistrations()
      } else {
        setAlert({ type: 'error', message: data.error ?? 'Registration failed.' })
      }
    } catch {
      setAlert({ type: 'error', message: 'Network error. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this registration?')) return
    try {
      await fetch(`/api/registrations/${id}`, { method: 'DELETE' })
      await fetchRegistrations()
    } catch {
      // silently fail — list will refresh on next poll
    }
  }

  const handleCopyList = async () => {
    if (!effectiveDate || visibleRegistrations.length === 0) return
    const lines = [
      `${activeGame} — ${formatDateLabel(effectiveDate)} (${visibleRegistrations.length} participant${visibleRegistrations.length !== 1 ? 's' : ''})`,
      '',
      ...visibleRegistrations.map((r, i) =>
        `${visibleRegistrations.length - i}. ${r.bushi_navi_id} — ${r.handle_name} (${formatTime(r.created_at)})`
      ),
    ]
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Bushi Expo Participants Tracker
          </h1>
          <p className="text-gray-500 text-sm">
            Register a participant by their Bushi Navi ID and game.
          </p>
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-4 py-1.5 text-xs font-medium">
            🌐 Shared log — visible to anyone using this app. A participant may register for multiple games.
          </div>
        </div>

        {/* ── Registration Form Card ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">
            New Registration
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Bushi Navi ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bushi Navi ID{' '}
                  <span className="text-xs font-normal text-gray-400">GXXXXXXXX</span>
                </label>
                <input
                  type="text"
                  value={bushiNaviId}
                  onChange={e => setBushiNaviId(e.target.value.toUpperCase())}
                  placeholder="E.G. G12345678"
                  maxLength={9}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C45532] focus:border-transparent transition"
                />
              </div>

              {/* Handle Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Handle Name{' '}
                  <span className="text-xs font-normal text-gray-400">in-game name</span>
                </label>
                <input
                  type="text"
                  value={handleName}
                  onChange={e => setHandleName(e.target.value)}
                  placeholder="e.g. DarkKnight"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C45532] focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Game Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Game</label>
              <select
                value={selectedGame}
                onChange={e => setSelectedGame(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C45532] focus:border-transparent transition"
              >
                <option value="">— Select a game —</option>
                {GAMES.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* Alert Banner */}
            {alert && (
              <div
                className={`rounded-lg border px-4 py-3 text-sm font-medium ${
                  alert.type === 'error'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}
              >
                {alert.type === 'error' ? '⚠️' : '✅'} {alert.message}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#C45532] hover:bg-[#a8462a] active:bg-[#8f3b23] text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving…' : 'Save Entry'}
            </button>
          </form>
        </div>

        {/* ── Data Display Card ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          {/* Summary */}
          <p className="text-sm text-gray-500 mb-4">
            {registrations.length} registration{registrations.length !== 1 ? 's' : ''} across all games
          </p>

          {/* Game Tabs */}
          <div className="flex flex-wrap border-b border-gray-200 mb-4 -mx-1">
            {GAMES.map(g => {
              const count = registrations.filter(r => r.game === g).length
              const isActive = g === activeGame
              return (
                <button
                  key={g}
                  onClick={() => handleGameTabClick(g)}
                  className={`mx-1 px-3 py-2 text-sm -mb-px border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-[#C45532] text-[#C45532] font-semibold'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {g}{' '}
                  <span className={`text-xs ${isActive ? 'text-[#C45532]' : 'text-gray-400'}`}>
                    ({count})
                  </span>
                </button>
              )
            })}
          </div>

          {/* Date Filter Pills */}
          {sortedDates.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {sortedDates.map(date => {
                const count = dateGroups[date].length
                const isActive = date === effectiveDate
                return (
                  <button
                    key={date}
                    onClick={() => setActiveDate(date)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#C45532] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    📅 {formatDateLabel(date)}{' '}
                    <span className={`text-xs ${isActive ? 'text-white/80' : 'text-gray-400'}`}>
                      ({count})
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Action Bar */}
          {effectiveDate && visibleRegistrations.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">
                {visibleRegistrations.length} participant{visibleRegistrations.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={handleCopyList}
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
              >
                {copied ? '✅ Copied!' : '📋 Copy List'}
              </button>
            </div>
          )}

          {/* Table */}
          {isLoading ? (
            <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>
          ) : visibleRegistrations.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              {sortedDates.length === 0
                ? `No registrations yet for ${activeGame}.`
                : 'Select a date above to view participants.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {['#', 'Bushi Navi ID', 'Handle Name', 'Time Logged', 'Actions'].map(col => (
                      <th
                        key={col}
                        className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider pb-2 pr-4 last:pr-0"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleRegistrations.map((r, i) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 pr-4 text-gray-400 font-mono text-xs w-8">
                        {visibleRegistrations.length - i}
                      </td>
                      <td className="py-3 pr-4 font-mono font-medium text-gray-900">
                        {r.bushi_navi_id}
                      </td>
                      <td className="py-3 pr-4 text-gray-700">{r.handle_name}</td>
                      <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                        {formatTime(r.created_at)}
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => handleDelete(r.id)}
                          title="Remove registration"
                          className="text-red-400 hover:text-red-600 transition-colors text-base"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
