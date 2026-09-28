import type { CSSProperties } from 'react'
import { analyzeFossil, type Board, type Highlight } from '../lib/engine'

interface Props {
  board: Board
  highlight?: Highlight
  label?: string
  animated?: boolean
  miniature?: boolean
}
const COLORS = ['#a6583b', '#517870', '#a08b52', '#827398', '#52667c', '#b47a65']

export function FossilArt({ board, highlight = 'none', label = '8×8 像素化石', animated = false, miniature = false }: Props) {
  const metrics = analyzeFossil(board)
  const holes = new Set(metrics.holes.flat())
  const group = new Map<number, number>()
  metrics.components.forEach((component, index) => component.forEach(cell => group.set(cell, index)))
  return (
    <svg className={`fossil-art ${animated ? 'fossil-appearing' : ''} ${miniature ? 'miniature' : ''}`} viewBox="0 0 256 256" role="img" aria-label={label}>
      {Array.from({ length: 9 }, (_, i) => <g key={`grid-${i}`} stroke="currentColor" strokeWidth="0.55" opacity="0.11"><path d={`M ${16 + i * 28} 16 V 240 M 16 ${16 + i * 28} H 240`} /></g>)}
      {board.map((filled, i) => {
        const x = 18 + (i % 8) * 28
        const y = 18 + Math.floor(i / 8) * 28
        if (!filled) return holes.has(i) && highlight === 'holes' ? <rect key={i} x={x} y={y} width="24" height="24" rx="1" fill="#cfad5d" opacity="0.55" /> : <circle key={i} cx={x + 12} cy={y + 12} r="1" fill="currentColor" opacity="0.12" />
        const fill = highlight === 'components' ? COLORS[(group.get(i) ?? 0) % COLORS.length] : highlight === 'holes' ? '#817867' : '#a35b3e'
        return <g key={i} className="fossil-cell" style={{ '--cell-delay': `${i * 9}ms` } as CSSProperties}><rect x={x} y={y + 1.6} width="24" height="24" rx="1.4" fill="#5a4230" opacity="0.28" /><rect x={x} y={y} width="24" height="24" rx="1.4" fill={fill} /><path d={`M${x + 2} ${y + 2}h20`} stroke="#fff" opacity="0.2" /></g>
      })}
      {highlight === 'symmetry' && <g stroke="#517870" strokeWidth="1.5" strokeDasharray="4 4">
        {metrics.mirrorX && <path d="M128 6V250" />}
        {metrics.mirrorY && <path d="M6 128H250" />}
        {metrics.quarterTurn && <circle cx="128" cy="128" r="111" />}
      </g>}
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
