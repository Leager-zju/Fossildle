import type { CSSProperties } from 'react'
import type { Board } from '../lib/engine'
import type { TraitCellGroup } from '../lib/traitCells'
import { ROW_FLIP_MS } from '../lib/useRevealSequence'

interface Props {
  board: Board
  activeGroups?: readonly TraitCellGroup[]
  label?: string
  revealedRows?: number
  miniature?: boolean
}

// 证据分组时用于区分不同组；单组仍使用统一的原色。
export const GROUP_FILLS = ['#a35b3e', '#4b7973', '#9c723b', '#736087', '#97634e', '#6d7769']

export function FossilArt({ board, activeGroups, label = '8×8 像素化石', revealedRows = 8, miniature = false }: Props) {
  const groupOf = new Map<number, number>()
  activeGroups?.forEach((group, index) => group.cells.forEach(cell => groupOf.set(cell, index)))
  const grouped = activeGroups !== undefined && activeGroups.length > 1

  return (
    <svg className={`fossil-art ${miniature ? 'miniature' : ''}`} viewBox="0 0 256 256" role="img" aria-label={revealedRows < 8 ? `化石正在逐行翻开，已完成 ${revealedRows}/8 行` : label} data-revealed-rows={revealedRows} style={{ '--row-flip-duration': `${ROW_FLIP_MS}ms` } as CSSProperties}>
      {Array.from({ length: 9 }, (_, i) => <g key={`grid-${i}`} stroke="currentColor" strokeWidth="0.55" opacity="0.11"><path d={`M ${16 + i * 28} 16 V 240 M 16 ${16 + i * 28} H 240`} /></g>)}
      {Array.from({ length: 8 }, (_, row) => {
        const state = row < revealedRows ? 'revealed' : row === revealedRows ? 'flipping' : 'covered'
        return <g key={row} className={`fossil-row row-${state}`} data-row={row} data-state={state}>
          {state !== 'covered' && <g className="row-front">
            <rect x="17" y={17 + row * 28} width="222" height="26" fill="#f5f1e6" opacity="0.65" />
            {board.slice(row * 8, row * 8 + 8).map((filled, column) => {
              const i = row * 8 + column
              const x = 18 + column * 28
              const y = 18 + row * 28
              if (!filled) return <circle key={i} cx={x + 12} cy={y + 12} r="1" fill="currentColor" opacity="0.12" />
              const group = groupOf.get(i)
              const dimmed = revealedRows === 8 && activeGroups !== undefined && group === undefined
              const fill = dimmed ? '#b2b2aa' : grouped && group !== undefined ? GROUP_FILLS[group % GROUP_FILLS.length] : '#a35b3e'
              return <g key={i} className="fossil-cell" data-cell={i} data-dimmed={dimmed} data-group={group ?? -1}><rect className="cell-shadow" x={x} y={y + 1.6} width="24" height="24" rx="1.4" fill={dimmed ? '#777770' : '#5a4230'} opacity="0.28" /><rect className="cell-fill" x={x} y={y} width="24" height="24" rx="1.4" fill={fill} /><path d={`M${x + 2} ${y + 2}h20`} stroke="#fff" opacity="0.2" /></g>
            })}
          </g>}
          {state !== 'revealed' && <g className="row-back"><rect x="18" y={18 + row * 28} width="220" height="24" rx="2" fill="#c9bfa8" /><path d={`M24 ${25 + row * 28}H232 M29 ${35 + row * 28}H227`} stroke="#b2a68c" strokeWidth="1" opacity="0.65" /></g>}
        </g>
      })}
      {!miniature && <g fill="currentColor" opacity="0.35" fontSize="7" fontFamily="monospace"><text x="6" y="11">A</text><text x="244" y="251">H</text><path d="M7 23V7h16M233 7h16v16M7 233v16h16M233 249h16v-16" fill="none" stroke="currentColor" strokeWidth="1" /></g>}
    </svg>
  )
}

export function RockArt({ cracking = false }: { cracking?: boolean }) {
  return <svg viewBox="0 0 400 320" className={`rock-art ${cracking ? 'cracking' : ''}`} role="img" aria-label="等待开启的沉积岩样本">
    <ellipse cx="204" cy="267" rx="131" ry="14" fill="#504633" opacity="0.08" />
    <g className="rock-body">
      <path d="M67 210 55 139 93 80 168 53 252 62 313 100 343 174 317 233 235 259 132 251Z" fill="#b7ad96" />
      <path d="M55 139 93 80 168 53 252 62 202 111 128 128 91 179Z" fill="#d8cfb9" />
      <path d="M202 111 252 62 313 100 343 174 282 170 246 141Z" fill="#c4baa2" />
      <path d="M67 210 91 179 128 128 202 111 246 141 282 170 317 233 235 259 132 251Z" fill="#c8bea7" />
      <path d="M67 210 132 222 235 229 317 209 317 233 235 259 132 251Z" fill="#a79b82" />
      <path d="M72 194 137 204 210 201 294 187M84 177 146 185 207 181 282 170M100 156 169 166 227 155M112 230 167 237 251 236M123 107 155 93 200 94" fill="none" stroke="#94886e" opacity="0.4" strokeWidth="2" />
      <path d="M166 62 184 97 174 134 199 158 187 194 206 224" className="rock-crack" fill="none" stroke="#7b6d54" strokeWidth="2" />
      <path d="M174 134 149 147 138 173M199 158 229 153 245 171" className="rock-crack" fill="none" stroke="#7b6d54" strokeWidth="1.5" />
      {Array.from({ length: 32 }, (_, i) => <circle key={i} cx={100 + (i * 47) % 185} cy={107 + (i * 29) % 111} r={i % 3 === 0 ? 1.7 : 1} fill={i % 2 ? '#f4edda' : '#84785f'} opacity="0.4" />)}
      <path d="m259 102 12 2 7 9-8 4-13-5ZM97 200l9 2 2 8-10-2Z" fill="#e4dbc5" opacity="0.65" />
    </g>
    <g fill="#a79b82"><path d="m44 240 13-3 7 8-16 4ZM329 254l13-8 12 6-6 9ZM87 266l7-4 8 4-5 5Z" /></g>
  </svg>
}
