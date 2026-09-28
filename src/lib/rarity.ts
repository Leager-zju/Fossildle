import reference from '../data/rarity-v1.json'
import { analyzeFossil, calculateScore, evaluateTraits, fossilDescription, fossilName, fromHex } from './engine'
import type { Specimen } from './collection'

export const RARITIES = [
  { id: 'common', name: '常见', english: 'ORDINARY', color: '#6d7769' },
  { id: 'unusual', name: '特别', english: 'UNUSUAL', color: '#4b7973' },
  { id: 'rare', name: '稀有', english: 'RARE', color: '#9c723b' },
  { id: 'remarkable', name: '珍奇', english: 'REMARKABLE', color: '#97634e' },
  { id: 'archival', name: '典藏', english: 'ARCHIVAL', color: '#736087' },
] as const

export function classifyRarity(score: number) {
  const count = reference.histogram.reduce((total, bucket) => total + (bucket.score >= score ? bucket.count : 0), 0)
  const tail = (count + 1) / (reference.samples + 1)
  const rank = tail > 0.4 ? 0 : tail > 0.12 ? 1 : tail > 0.02 ? 2 : tail > 0.002 ? 3 : 4
  return { ...RARITIES[rank], rank, tail, samples: reference.samples, observed: count }
}

export function describeSpecimen(specimen: Specimen) {
  const board = fromHex(specimen.hex)
  const metrics = analyzeFossil(board)
  const traits = evaluateTraits(metrics)
  const score = calculateScore(traits)
  return { board, metrics, traits, score, rarity: classifyRarity(score), name: fossilName(board, metrics), description: fossilDescription(metrics) }
}

export function traitFrequency(id: string): number {
  return (reference.traitFrequencies as Record<string, number>)[id] / reference.samples || 0
}
