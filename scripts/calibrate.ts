import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { analyzeFossil, calculateScore, evaluateTraits, generateFossil, generateLegacyFossil, randomSource, SCORING_RULES, SCORING_VERSION, TRAITS } from '../src/lib/engine'

const samples = 1_000_000
const seed = 0xf0551d1e
const directory = fileURLToPath(new URL('../src/data/', import.meta.url))
mkdirSync(directory, { recursive: true })

for (const generatorVersion of [1, 2]) {
  const rng = randomSource(seed)
  const histogram = new Map<number, number>()
  const frequencies: Record<string, number> = Object.fromEntries(TRAITS.map(trait => [trait.id, 0]))
  for (let i = 0; i < samples; i++) {
    const board = generatorVersion === 1 ? generateLegacyFossil(Math.floor(rng() * 2 ** 32))
      : generateFossil(Uint8Array.from({ length: 8 }, () => Math.floor(rng() * 256)))
    const traits = evaluateTraits(analyzeFossil(board))
    const score = calculateScore(traits)
    histogram.set(score, (histogram.get(score) ?? 0) + 1)
    traits.forEach(trait => { frequencies[trait.id]++ })
    if ((i + 1) % 100_000 === 0) console.log(`Generator v${generatorVersion} / scoring v${SCORING_VERSION}: ${i + 1}/${samples}`)
  }
  const data = {
    generatorVersion,
    scoringVersion: SCORING_VERSION,
    scoringRules: SCORING_RULES,
    samples,
    seed,
    histogram: [...histogram].sort((a, b) => a[0] - b[0]).map(([score, count]) => ({ score, count })),
    traitFrequencies: frequencies,
  }
  writeFileSync(`${directory}rarity-v${generatorVersion}-s${SCORING_VERSION}.json`, `${JSON.stringify(data, null, 2)}\n`)
  console.log(`Calibrated ${samples.toLocaleString()} samples; ${histogram.size} distinct scores.`)
}
