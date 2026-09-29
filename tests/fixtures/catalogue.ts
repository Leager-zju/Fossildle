import { CATALOGUE_TRAITS } from '../../src/lib/catalogueTraits'
import type { Board } from '../../src/lib/engine'
import { TRAIT_EXAMPLES, cellsBoard, stamp } from '../../src/lib/traitExamples'

export { cellsBoard, stamp }
export type { Board }

// 测试沿用与图鉴示例一致的标准位图，避免两处示例漂移。
export const catalogueExamples: Record<string, Board> = Object.fromEntries(CATALOGUE_TRAITS.map(trait => [trait.id, TRAIT_EXAMPLES[trait.id]]))
export const allCatalogueBoards: Board[] = Object.values(catalogueExamples)
