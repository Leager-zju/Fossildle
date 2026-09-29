import { describe, expect, it } from 'vitest'
import { analyzeFossil, evaluateTraits, fromHex, generateFossil, type Board } from './engine'
import { traitCellGroups, traitCells } from './traitCells'

const ring = fromHex('00003c24243c0000')
const filled = (board: Board) => new Set(board.flatMap((cell, i) => cell ? [i] : []))

describe('条目相关格子', () => {
  it('空洞及独眼之环仅突出边界，不包含延伸枝条和空白', () => {
    const board = [...ring]
    ;[2, 5, 10, 13].forEach(i => { board[i] = true })
    expect(evaluateTraits(analyzeFossil(board)).map(trait => trait.id)).toContain('ring')
    expect(traitCells(board, 'ring')).toEqual(filled(ring))
    expect(traitCells(board, 'ring').has(27)).toBe(false)
  })
  it('多空洞突出全部边界，排除无关枝条', () => {
    const board = Array(64).fill(false) as Board
    for (const left of [1, 4]) {
      for (let y = 2; y <= 4; y++) {
        for (let x = left; x <= left + 2; x++) {
          if (y === 2 || y === 4 || x === left || x === left + 2) board[y * 8 + x] = true
        }
      }
    }
    const boundary = filled(board)
    board[9] = true
    board[1] = true
    expect(analyzeFossil(board).holes).toHaveLength(2)
    expect(traitCells(board, 'cavities')).toEqual(boundary)
    expect(traitCells(board, 'maze')).toEqual(boundary)
  })
  it('贯穿及十字取所有完整行列，无关化石不参与', () => {
    const board = fromHex('101010ff10101010')
    const cross = filled(board)
    board[0] = true
    board[63] = true
    expect(traitCells(board, 'span')).toEqual(cross)
    expect(traitCells(board, 'cross')).toEqual(cross)
  })
  it('全局对称、连通和重心由全部化石格共同参与', () => {
    for (const id of ['connected', 'mirror-x', 'mirror-y', 'double-mirror', 'rotation', 'interior', 'centered', 'hidden-heart']) {
      expect(traitCells(ring, id)).toEqual(filled(ring))
    }
    const islands = Array(64).fill(false) as Board
    ;[1, 6, 57].forEach(i => { islands[i] = true })
    expect(traitCells(islands, 'islands')).toEqual(filled(islands))
    const symmetric = Array(64).fill(false) as Board
    ;[1, 6, 57, 62].forEach(i => { symmetric[i] = true })
    expect(traitCells(symmetric, 'symmetric-islands')).toEqual(filled(symmetric))
  })
  it('未知和未命中条目不伪造相关格子', () => {
    expect(traitCells(ring, 'span').size).toBe(0)
    expect(traitCells(ring, 'unknown').size).toBe(0)
  })
  it('不修改原图，所有命中条目的相关格子都是实际化石', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const board = generateFossil()
      const copy = [...board]
      for (const trait of evaluateTraits(analyzeFossil(board))) {
        const cells = traitCells(board, trait.id)
        expect(cells.size).toBeGreaterThan(0)
        expect([...cells].every(i => i >= 0 && i < 64 && board[i])).toBe(true)
      }
      expect(board).toEqual(copy)
    }
  })
  it('多组证据按可区分的组返回', () => {
    const islands = Array(64).fill(false) as Board
    ;[0, 27, 63].forEach(i => { islands[i] = true })
    const islandGroups = traitCellGroups(islands, 'islands')
    expect(islandGroups).toHaveLength(3)
    expect(islandGroups.map(group => group.cells.length)).toEqual([1, 1, 1])
    expect(islandGroups.map(group => group.label)).toEqual(['第 1 个连通块', '第 2 个连通块', '第 3 个连通块'])

    const board = Array(64).fill(false) as Board
    for (const left of [1, 4]) {
      for (let y = 2; y <= 4; y++) {
        for (let x = left; x <= left + 2; x++) {
          if (y === 2 || y === 4 || x === left || x === left + 2) board[y * 8 + x] = true
        }
      }
    }
    expect(traitCellGroups(board, 'cavities')).toHaveLength(2)
    expect(traitCellGroups(ring, 'ring')).toHaveLength(1)

    const quadrants = Array(64).fill(false) as Board
    ;[0, 7, 56, 63].forEach(i => { quadrants[i] = true })
    expect(traitCellGroups(quadrants, 'even-quadrants')).toHaveLength(4)
    expect(traitCellGroups(quadrants, 'gentle-balance')).toHaveLength(2)
  })
  it('分组并集始终等于单一高亮集合', () => {
    for (let seed = 0; seed < 200; seed++) {
      const board = generateFossil()
      for (const trait of evaluateTraits(analyzeFossil(board))) {
        const groups = traitCellGroups(board, trait.id)
        expect(groups.length).toBeGreaterThan(0)
        expect(new Set(groups.flatMap(group => group.cells))).toEqual(new Set(traitCells(board, trait.id)))
      }
    }
  })
})
