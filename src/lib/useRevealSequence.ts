import { useEffect, useState } from 'react'

export const ROW_FLIP_MS = 520
export const ROW_STEP_MS = 650
export const SCORE_STEP_MS = 700
export const SCORE_SETTLE_MS = 350

interface RevealState {
  key: string
  rows: number
  scores: number
  complete: boolean
}

export function useRevealSequence(key: string, enabled: boolean, scoreCount: number) {
  const [state, setState] = useState<RevealState>({ key, rows: 0, scores: 0, complete: false })
  useEffect(() => {
    if (!enabled) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let timer: number | undefined
    let rows = 0
    let scores = 0
    let complete = false
    const publish = () => setState({ key, rows, scores, complete })
    const schedule = () => {
      if (!complete) timer = window.setTimeout(advance, rows < 8 ? ROW_STEP_MS : scores < scoreCount ? SCORE_STEP_MS : SCORE_SETTLE_MS)
    }
    const advance = () => {
      if (rows < 8) rows++
      else if (scores < scoreCount) scores++
      else complete = true
      if (rows === 8 && scoreCount === 0) complete = true
      publish()
      schedule()
    }
    const applyPreference = () => {
      window.clearTimeout(timer)
      if (preference.matches) {
        rows = 8
        scores = scoreCount
        complete = true
        publish()
      } else schedule()
    }
    publish()
    applyPreference()
    preference.addEventListener('change', applyPreference)
    return () => {
      window.clearTimeout(timer)
      preference.removeEventListener('change', applyPreference)
    }
  }, [key, enabled, scoreCount])
  const current = enabled && state.key === key ? state : { rows: 0, scores: 0, complete: false }
  return { rows: current.rows, scores: current.scores, complete: enabled && current.complete }
}
