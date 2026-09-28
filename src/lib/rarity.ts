import referenceV1 from '../data/rarity-v1.json'
import referenceV2 from '../data/rarity-v2.json'
import { analyzeFossil, calculateScore, evaluateTraits, fossilDescription, fossilName, fromHex, GENERATOR_VERSION, type GeneratorVersion } from './engine'
import type { Specimen } from './collection'

export const RARITIES = [
  { id: 'common', name: '常见', english: 'ORDINARY', color: '#6d7769' },
  { id: 'unusual', name: '特别', english: 'UNUSUAL', color: '#4b7973' },
  { id: 'rare', name: '稀有', english: 'RARE', color: '#9c723b' },
  { id: 'remarkable', name: '珍奇', english: 'REMARKABLE', color: '#97634e' },
  { id: 'archival', name: '典藏', english: 'ARCHIVAL', color: '#736087' },
] as const

const references = { 1: referenceV1, 2: referenceV2 }

function rarityForProbability(probability: number) {
  const rank = probability > 0.4 ? 0 : probability > 0.12 ? 1 : probability > 0.02 ? 2 : probability > 0.002 ? 3 : 4
  return { ...RARITIES[rank], rank }
}

export function classifyRarity(score: number, version: GeneratorVersion = GENERATOR_VERSION) {
  const reference = references[version]
  const count = reference.histogram.reduce((total, bucket) => total + (bucket.score >= score ? bucket.count : 0), 0)
  const tail = (count + 1) / (reference.samples + 1)
  return { ...rarityForProbability(tail), tail, samples: reference.samples, observed: count }
}

// 按独立公平位模型计算，并扣除不满足结构定义的全空棋盘。
const exactV2: Partial<Record<string, number>> = {
  'mirror-x': 2 ** -32 - 2 ** -64,
  'mirror-y': 2 ** -32 - 2 ** -64,
  'double-mirror': 2 ** -48 - 2 ** -64,
  rotation: 2 ** -48 - 2 ** -64,
  interior: 2 ** -28 * (1 - 2 ** -36),
}

export function classifyTraitRarity(id: string, version: GeneratorVersion = GENERATOR_VERSION) {
  const reference = references[version]
  const count = (reference.traitFrequencies as Record<string, number>)[id]
  if (count === undefined) throw new Error(`未知结构：${id}`)
  const exact = version === 2 ? exactV2[id] : undefined
  const probability = exact ?? (count > 0 ? count / reference.samples : -Math.expm1(Math.log(0.05) / reference.samples))
  const basis = exact !== undefined ? 'exact' : count > 0 ? 'simulation' : 'upper-bound'
  const percentage = probability < 0.000001 ? `${(probability * 100).toExponential(2)}%` : `${(probability * 100).toFixed(3)}%`
  const note = basis === 'exact' ? `独立 50% 像素模型的理论概率约 ${percentage}`
    : basis === 'simulation' ? `v${version} 的 ${reference.samples.toLocaleString('zh-CN')} 次模拟中命中 ${count.toLocaleString('zh-CN')} 次，估计频率 ${percentage}`
      : `v${version} 的 ${reference.samples.toLocaleString('zh-CN')} 次模拟未观测到；按 95% 单侧概率上界暂定等级，并非概率为零`
  return { ...rarityForProbability(probability), probability, basis, note }
}

export function describeSpecimen(specimen: Specimen) {
  const board = fromHex(specimen.hex)
  const metrics = analyzeFossil(board)
  const traits = evaluateTraits(metrics)
  const score = calculateScore(traits)
  return { board, metrics, traits, score, rarity: classifyRarity(score, specimen.version), name: fossilName(board, metrics), description: fossilDescription(metrics) }
}

export function traitFrequency(id: string, version: GeneratorVersion = GENERATOR_VERSION): number {
  const reference = references[version]
  return (reference.traitFrequencies as Record<string, number>)[id] / reference.samples || 0
}
