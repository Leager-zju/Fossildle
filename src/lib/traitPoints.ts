import referenceV1 from '../data/rarity-v1-s5.json' with { type: 'json' }
import referenceV2 from '../data/rarity-v2-s5.json' with { type: 'json' }
import type { GeneratorVersion } from './engine'

export type ProbabilityBasis = 'exact' | 'simulation' | 'upper-bound'

export interface TraitProbability {
  probability: number
  basis: ProbabilityBasis
  count: number
  samples: number
}

const references: Record<GeneratorVersion, { samples: number; traitFrequencies: Record<string, number> }> = {
  1: { samples: referenceV1.samples, traitFrequencies: referenceV1.traitFrequencies as Record<string, number> },
  2: { samples: referenceV2.samples, traitFrequencies: referenceV2.traitFrequencies as Record<string, number> },
}

// 按独立公平位模型计算，并扣除不满足结构定义的全空棋盘；
// 形状族层级使用预标定概率（30 万样本实测或理论值），保证分值稳定、不随校准漂移。
const exactV2: Partial<Record<string, number>> = {
  'mirror-x': 2 ** -32 - 2 ** -64,
  'mirror-y': 2 ** -32 - 2 ** -64,
  'double-mirror': 2 ** -48 - 2 ** -64,
  rotation: 2 ** -48 - 2 ** -64,
  interior: 2 ** -28 * (1 - 2 ** -36),
  'diagonal-main': 2 ** -28 - 2 ** -64,
  'diagonal-anti': 2 ** -28 - 2 ** -64,
  'half-turn': 2 ** -32 - 2 ** -64,
  eightfold: 2 ** -54 - 2 ** -64,
  counterpoint: 2 ** -32,
  'tiled-quarters': (2 ** 16 - 2) * 2 ** -64,
  'four-corners': 2 ** -4,
  frame: 2 ** -28,
  'central-gem': 2 ** -4,
  'cross-current': 2 ** -16,
  'cross-forward-5': 5.86e-1,
  'cross-forward-9': 2.86e-2,
  'cross-forward-13': 4.70e-4,
  'cross-x-5': 5.95e-1,
  'cross-x-9': 2.92e-2,
  'cross-x-13': 5.04e-4,
  'solid-2': 8.93e-1,
  'solid-4': 3.733e-4,
  'solid-5': 4.77e-7,
  'solid-6': 1.31e-10,
  'solid-7': 7.1e-15,
  'solid-8': 5.42e-20,
  'frame-4': 3.633e-4,
  'frame-5': 4.77e-7,
  'frame-6': 1.31e-10,
  'frame-7': 7.1e-15,
  'frame-8': 5.42e-20,
  'lines-3': 6.667e-6,
  'lines-4': 3.26e-8,
  'grid-2': 2.92e-6,
  'grid-3': 5.70e-9,
  'holes-3': 5.667e-4,
}

export function traitProbabilityDetail(id: string, version: GeneratorVersion): TraitProbability {
  const reference = references[version]
  const count = reference.traitFrequencies[id]
  const exact = version === 2 ? exactV2[id] : undefined
  // 预标定概率优先：形状族层级在首次校准前即可确定分值，且不随校准漂移。
  if (count === undefined && exact === undefined) throw new Error(`未知结构：${id}`)
  const observed = count ?? 0
  const probability = exact ?? (observed > 0 ? observed / reference.samples : -Math.expm1(Math.log(0.05) / reference.samples))
  const basis: ProbabilityBasis = exact !== undefined ? 'exact' : observed > 0 ? 'simulation' : 'upper-bound'
  return { probability, basis, count: observed, samples: reference.samples }
}

// 分值以当前生成器的命中概率标定：概率越低，分值越高。
export const POINT_BASIS_VERSION: GeneratorVersion = 2
export const POINT_MIN = 1
export const POINT_MAX = 40
const POINT_SLOPE = 2.25

// 对数刻度映射，保证严格单调：概率下降时原始分值不致降低，四舍五入后可能并列。
export function pointsForProbability(probability: number): number {
  if (!(probability > 0)) return POINT_MAX
  const raw = POINT_MIN - POINT_SLOPE * Math.log10(probability)
  return Math.min(POINT_MAX, Math.max(POINT_MIN, Math.round(raw)))
}

export function structureProbability(id: string): number {
  return traitProbabilityDetail(id, POINT_BASIS_VERSION).probability
}

export function structurePoints(id: string): number {
  return pointsForProbability(structureProbability(id))
}
