import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { analyzeFossil, calculateScore, evaluateTraits, generateFossil, randomSource, GENERATOR_VERSION, TRAITS } from '../src/lib/engine'

const samples = 1_000_000
const seed = 0xf0551d1e
const rng = randomSource(seed)
const histogram = new Map<number, number>()
const frequencies: Record<string, number> = Object.fromEntries(TRAITS.map(trait => [trait.id, 0]))
for (let i = 0; i < samples; i++) {
  const bytes = Uint8Array.from({ length: 8 }, () => Math.floor(rng() * 256))
  const board = generateFossil(bytes)
  const traits = evaluateTraits(analyzeFossil(board))
  const score = calculateScore(traits)
  histogram.set(score, (histogram.get(score) ?? 0) + 1)
  traits.forEach(trait => { frequencies[trait.id] = (frequencies[trait.id] ?? 0) + 1 })
}
const directory = fileURLToPath(new URL('../src/data/', import.meta.url))
mkdirSync(directory, { recursive: true })
const data = {
  generatorVersion: GENERATOR_VERSION,
  scoringVersion: 1,
  samples,
  seed,
  histogram: [...histogram].sort((a, b) => a[0] - b[0]).map(([score, count]) => ({ score, count })),
  traitFrequencies: frequencies,
}
writeFileSync(`${directory}rarity-v${GENERATOR_VERSION}.json`, `${JSON.stringify(data, null, 2)}\n`)
console.log(`Calibrated ${samples.toLocaleString()} samples; ${histogram.size} distinct scores.`)
console.log(JSON.stringify(frequencies))
