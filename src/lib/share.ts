import { describeSpecimen } from './rarity'
import { featuredTraits } from './engine'
import { specimenHash, type Specimen } from './collection'

export function shareUrl(specimen: Specimen): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = specimenHash(specimen)
  return url.href
}
export function shareText(specimen: Specimen): string {
  const data = describeSpecimen(specimen)
  const traits = featuredTraits(data.traits).map(t => t.name).join(' · ')
  return `我在 Fossildle 发现了「${data.name}」。\n${data.rarity.name}${traits ? ` · ${traits}` : ''}\n你的地层里藏着什么？\n${shareUrl(specimen)}`
}
export async function createShareImage(specimen: Specimen): Promise<Blob> {
  await document.fonts.ready
  const data = describeSpecimen(specimen)
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持图片导出，请复制分享链接。')
  ctx.fillStyle = '#f6f3eb'
  ctx.fillRect(0, 0, 1080, 1350)
  ctx.strokeStyle = '#d9d3c5'
  ctx.lineWidth = 2
  ctx.strokeRect(40, 40, 1000, 1270)
  ctx.fillStyle = '#30392e'
  ctx.font = '52px Georgia, serif'
  ctx.fillText('Fossildle', 85, 130)
  ctx.font = '19px monospace'
  ctx.fillStyle = '#8a8b7b'
  ctx.fillText('A LITTLE PIECE OF TIME.', 85, 168)
  ctx.textAlign = 'right'
  ctx.fillText(specimen.date.replaceAll('-', '.'), 995, 133)
  const originX = 252
  const originY = 285
  data.board.forEach((filled, i) => {
    const x = originX + (i % 8) * 72
    const y = originY + Math.floor(i / 8) * 72
    ctx.fillStyle = filled ? '#a35b3e' : '#eee9dd'
    ctx.fillRect(x, y, 64, 64)
    if (filled) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.fillRect(x + 4, y + 4, 56, 3)
    }
  })
  ctx.textAlign = 'center'
  ctx.fillStyle = '#30392e'
  ctx.font = '52px "Songti SC", "Noto Serif CJK SC", serif'
  ctx.fillText(data.name, 540, 958)
  ctx.fillStyle = data.rarity.color
  ctx.font = '23px system-ui, sans-serif'
  ctx.fillText(`${data.rarity.name} / ${data.rarity.english}`, 540, 1010)
  ctx.fillStyle = '#686d60'
  ctx.font = '24px system-ui, sans-serif'
  ctx.fillText(featuredTraits(data.traits).map(t => t.name).join('  ·  ') || '偶然本身，也值得被收藏。', 540, 1072)
  ctx.font = '20px system-ui, sans-serif'
  ctx.fillText('每天一枚像素化石，把一点偶然放进博物馆。', 540, 1190)
  ctx.font = '18px monospace'
  const site = `${window.location.host}${window.location.pathname}`
  ctx.fillText(site, 540, 1233, 880)
  ctx.font = '15px system-ui, sans-serif'
  ctx.fillStyle = '#929182'
  ctx.fillText('本地生成 · 稀有度基于模拟参考分布 · 非玩家排名', 540, 1270)
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片生成失败，请重试。')), 'image/png'))
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
