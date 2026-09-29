import { describe, expect, it } from 'vitest'
import { analyzeFossil, TRAITS } from './engine'
import { traitCellGroups } from './traitCells'
import { TRAIT_EXAMPLES } from './traitExamples'

describe('结构示例位图', () => {
  it('每项结构都有一张命中的标准示例，且证据分组可用', () => {
    expect(Object.keys(TRAIT_EXAMPLES).sort()).toEqual(TRAITS.map(trait => trait.id).sort())
    for (const trait of TRAITS) {
      const board = TRAIT_EXAMPLES[trait.id]
      expect(board).toHaveLength(64)
      expect(trait.matches(analyzeFossil(board))).toBe(true)
      const groups = traitCellGroups(board, trait.id)
      expect(groups.length).toBeGreaterThan(0)
      expect(groups.every(group => group.cells.every(cell => board[cell]))).toBe(true)
    }
  })
})
