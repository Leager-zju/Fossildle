import { useCallback, useSyncExternalStore } from 'react'
import type { Specimen } from './collection'

export const ROW_FLIP_MS = 520
export const ROW_STEP_MS = 650
export const SCORE_STEP_MS = 700
export const SCORE_SETTLE_MS = 350
export const SCORE_REVEAL_BUDGET_MS = 11200

export function scoreStepMs(scoreCount: number) {
  return Math.min(SCORE_STEP_MS, Math.max(1, Math.floor(SCORE_REVEAL_BUDGET_MS / Math.max(1, scoreCount))))
}

interface RevealProgress {
  rows: number
  scores: number
  complete: boolean
  revision: number
}

interface RevealSession {
  startedAt: number
  scoreCount: number
  snapshot: RevealProgress
  listeners: Set<() => void>
  sync?: () => void
  stop?: () => void
}

const initialProgress: RevealProgress = { rows: 0, scores: 0, complete: false, revision: 0 }
const sessions = new Map<string, RevealSession>()

export function revealKey(specimen: Pick<Specimen, 'version' | 'date' | 'hex'>) {
  return `${specimen.version}:${specimen.date}:${specimen.hex}`
}

function progressOf(session: RevealSession, elapsed: number): RevealProgress {
  const rowsEnd = 8 * ROW_STEP_MS
  const revision = session.snapshot.revision
  if (elapsed < rowsEnd) return { rows: Math.floor(elapsed / ROW_STEP_MS), scores: 0, complete: false, revision }
  if (session.scoreCount === 0) return { rows: 8, scores: 0, complete: true, revision }
  const step = scoreStepMs(session.scoreCount)
  const scores = Math.min(session.scoreCount, Math.floor((elapsed - rowsEnd) / step))
  const complete = elapsed >= rowsEnd + session.scoreCount * step + SCORE_SETTLE_MS
  return { rows: 8, scores, complete, revision }
}

function runSession(session: RevealSession) {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  let timer: number | undefined
  let elapsed = 0
  const stop = () => {
    window.clearTimeout(timer)
    preference.removeEventListener('change', sync)
    window.removeEventListener('pageshow', sync)
    document.removeEventListener('visibilitychange', sync)
  }
  const sync = () => {
    window.clearTimeout(timer)
    if (session.snapshot.complete) { stop(); return }
    elapsed = Math.max(elapsed, Date.now() - session.startedAt)
    const next = preference.matches ? { rows: 8, scores: session.scoreCount, complete: true, revision: session.snapshot.revision }
      : progressOf(session, elapsed)
    const previous = session.snapshot
    if (next.rows !== previous.rows || next.scores !== previous.scores || next.complete !== previous.complete) {
      session.snapshot = next
      session.listeners.forEach(listener => listener())
    }
    if (next.complete) { stop(); return }
    const deadline = next.rows < 8 ? (next.rows + 1) * ROW_STEP_MS
      : next.scores < session.scoreCount ? 8 * ROW_STEP_MS + (next.scores + 1) * scoreStepMs(session.scoreCount)
        : 8 * ROW_STEP_MS + session.scoreCount * scoreStepMs(session.scoreCount) + SCORE_SETTLE_MS
    timer = window.setTimeout(sync, Math.max(1, deadline - elapsed))
  }
  session.sync = sync
  session.stop = stop
  preference.addEventListener('change', sync)
  window.addEventListener('pageshow', sync)
  document.addEventListener('visibilitychange', sync)
  sync()
}

export function startRevealSequence(key: string, scoreCount: number) {
  const existing = sessions.get(key)
  if (existing) { existing.sync?.(); return }
  const session: RevealSession = { startedAt: Date.now(), scoreCount, snapshot: initialProgress, listeners: new Set() }
  sessions.set(key, session)
  runSession(session)
}

function restartRevealSequence(key: string, scoreCount: number) {
  const session = sessions.get(key)
  if (!session) { startRevealSequence(key, scoreCount); return }
  session.stop?.()
  session.startedAt = Date.now()
  session.scoreCount = scoreCount
  session.snapshot = { ...initialProgress, revision: session.snapshot.revision + 1 }
  runSession(session)
  session.listeners.forEach(listener => listener())
}

export function useRevealSequence(key: string, enabled: boolean, scoreCount: number) {
  const subscribe = useCallback((listener: () => void) => {
    if (!enabled) return () => {}
    startRevealSequence(key, scoreCount)
    const session = sessions.get(key)!
    session.listeners.add(listener)
    return () => { session.listeners.delete(listener) }
  }, [key, enabled, scoreCount])
  const getSnapshot = useCallback(() => enabled ? sessions.get(key)?.snapshot ?? initialProgress : initialProgress, [key, enabled])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => initialProgress)
  const restart = useCallback(() => { if (enabled) restartRevealSequence(key, scoreCount) }, [key, enabled, scoreCount])
  return { ...snapshot, restart }
}
