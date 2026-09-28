import { useMemo, useState } from 'react'
import { ArrowRight, Bookmark, Check, Download, Grid2X2, Layers3, LockKeyhole, Search, Sparkles } from 'lucide-react'
import { MILESTONES, specimenHash, type Collection, type Specimen } from '../lib/collection'
import { describeSpecimen, RARITIES, traitFrequency } from '../lib/rarity'
import { TRAITS } from '../lib/engine'
import { FossilArt } from './FossilArt'

interface Props {
  collection: Collection
  onFavorite: (specimen: Specimen) => void
  onExport: () => void
}

export function Cabinet({ collection, onFavorite, onExport }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('latest')
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const items = useMemo(() => collection.specimens.map(specimen => ({ specimen, ...describeSpecimen(specimen) })), [collection])
  const visible = items.filter(item => (!onlyFavorites || item.specimen.favorite) && (filter === 'all' || item.rarity.id === filter) && (item.name.includes(query) || item.specimen.date.includes(query) || item.traits.some(trait => trait.name.includes(query)))).sort((a, b) => sort === 'rarity' ? b.score - a.score || b.specimen.date.localeCompare(a.specimen.date) : b.specimen.date.localeCompare(a.specimen.date))
  const unlocked = new Set(items.flatMap(item => item.traits.map(trait => trait.id)))
  return <>
    <section className="page-intro"><div><div className="eyebrow"><span className="tiny-line" /> YOUR PRIVATE MUSEUM</div><h1>把偶然，<em>好好收藏。</em></h1><p>这里没有普通的一天，只有尚未回看的发现。</p></div><button className="button button-outline" onClick={onExport}><Download size={16} /> 备份藏馆</button></section>
    <div className="collection-stats"><div><span>累计发现</span><strong>{String(items.length).padStart(2, '0')}<small>枚化石</small></strong></div><div><span>心动珍藏</span><strong>{String(items.filter(item => item.specimen.favorite).length).padStart(2, '0')}<small>枚偏爱</small></strong></div><div><span>结构图鉴</span><strong>{String(unlocked.size).padStart(2, '0')}<small>/ 16 项</small></strong></div><div className="stat-note"><Layers3 size={27} strokeWidth={1.2} /><p>不必连续签到。<br />每一次回来，都算数。</p></div></div>
    <div className="cabinet-toolbar"><div className="segmented-control"><button className={!onlyFavorites ? 'active' : ''} onClick={() => setOnlyFavorites(false)}><Grid2X2 size={15} /> 全部发现</button><button className={onlyFavorites ? 'active' : ''} onClick={() => setOnlyFavorites(true)}><Bookmark size={15} /> 我的珍藏</button></div><div className="filter-tools"><label className="search-field"><Search size={15} /><input aria-label="搜索化石" value={query} onChange={event => setQuery(event.target.value)} placeholder="名称、日期、结构…" /></label><select aria-label="筛选稀有等级" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">全部等级</option>{RARITIES.map(rarity => <option key={rarity.id} value={rarity.id}>{rarity.name}</option>)}</select><select aria-label="藏馆排序" value={sort} onChange={event => setSort(event.target.value)}><option value="latest">最近发现</option><option value="rarity">结构分优先</option></select></div></div>
    {visible.length ? <div className="cabinet-grid">{visible.map(item => <article className="specimen-tile" key={item.specimen.date}><div className="tile-topline"><span>{item.specimen.date.replaceAll('-', '.')}</span><button className={`icon-button ${item.specimen.favorite ? 'is-saved' : ''}`} aria-label={item.specimen.favorite ? `取消珍藏${item.name}` : `珍藏${item.name}`} aria-pressed={item.specimen.favorite} onClick={() => onFavorite(item.specimen)}><Bookmark size={16} fill={item.specimen.favorite ? 'currentColor' : 'none'} /></button></div><a className="tile-link" href={specimenHash(item.specimen)}><div className="tile-art"><FossilArt board={item.board} miniature label={item.name} /></div><div className="tile-title"><h2>{item.name}</h2><ArrowRight size={16} /></div><div className="tile-footer"><span className={`rarity rarity-${item.rarity.id}`}>{item.rarity.name}</span><span>{item.metrics.count} 像素 · {item.traits.length} 个结构</span></div></a></article>)}</div> : <div className="empty-state"><div className="empty-icon"><Layers3 size={34} strokeWidth={1.2} /></div><h2>{items.length ? '还没有符合条件的化石' : '你的第一件藏品，还在岩石里。'}</h2><p>{items.length ? '试试其他筛选条件，或为喜欢的化石点亮书签。' : '从今天开始，让每一次小小的偶然有处可归。'}</p>{items.length ? <button className="button button-outline" onClick={() => { setQuery(''); setFilter('all'); setOnlyFavorites(false) }}>清除筛选</button> : <a className="button button-primary" href="#today">开启第一次发现 <ArrowRight size={16} /></a>}</div>}
    <p className="page-footnote">藏馆仅保存在当前浏览器。清除网站数据、使用无痕模式或更换设备都可能丢失记录，请定期导出备份。</p>
  </>
}

export function FieldGuide({ collection }: { collection: Collection }) {
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const unlocked = useMemo(() => {
    const result = new Map<string, Specimen>()
    collection.specimens.forEach(specimen => describeSpecimen(specimen).traits.forEach(trait => { if (!result.has(trait.id)) result.set(trait.id, specimen) }))
    return result
  }, [collection])
  const unlockedCount = unlocked.size + MILESTONES.filter(item => collection.specimens.length >= item.days).length
  const show = (unlocked: boolean) => filter === 'all' || (filter === 'unlocked' ? unlocked : !unlocked)
  return <>
    <section className="page-intro"><div><div className="eyebrow"><span className="tiny-line" /> THE FIELD GUIDE</div><h1>细看一点，<em>多发现一点。</em></h1><p>每一种结构，都有名字。每一个名字，都在等一次相遇。</p></div><div className="guide-progress"><strong>{unlockedCount}<span>/ 20</span></strong><span>图鉴已记录</span><div><i style={{ width: `${unlockedCount / 20 * 100}%` }} /></div></div></section>
    <div className="guide-heading"><div className="segmented-control">{[{ id: 'all', name: '全部图鉴' }, { id: 'unlocked', name: '已经发现' }, { id: 'locked', name: '等待相遇' }].map(item => <button key={item.id} className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}>{item.name}</button>)}</div><span>累计探索，不要求连续签到</span></div>
    {[{ name: '基础结构', english: 'THE SHAPES OF CHANCE', combo: false }, { name: '组合发现', english: 'WHEN PATTERNS MEET', combo: true }].map(section => <section className="guide-section" key={section.name}><div className="subsection-title"><h2>{section.name}</h2><span>{section.english}</span></div><div className="guide-grid">{TRAITS.filter(trait => (trait.group === 'combo') === section.combo && show(unlocked.has(trait.id))).map((trait, index) => { const first = unlocked.get(trait.id); return <article className={`guide-card ${first ? 'unlocked' : ''}`} key={trait.id}><div className="guide-card-top"><span className="guide-symbol">{first ? <Sparkles size={23} strokeWidth={1.3} /> : <LockKeyhole size={22} strokeWidth={1.2} />}</span><span>{first ? '已发现' : '待发现'} / {String(index + 1).padStart(2, '0')}</span></div><h3>{trait.name}</h3><p>{trait.description}</p><button className="text-button" onClick={() => setExpanded(expanded === trait.id ? null : trait.id)} aria-expanded={expanded === trait.id}>判定与频率 <ArrowRight size={13} /></button>{expanded === trait.id && <div className="trait-detail">{trait.group === 'combo' ? '组合加分' : '组内计分'}：{trait.points} 分。模拟出现频率约 {(traitFrequency(trait.id) * 100).toFixed(2)}%，并非保证多久出现一次。</div>}<div className="guide-card-footer">{first ? <a href={specimenHash(first)}><Check size={12} /> 首次发现 {first.date} <ArrowRight size={12} /></a> : <span>它或许就在下一块石头里。</span>}</div></article> })}</div>{!TRAITS.some(trait => (trait.group === 'combo') === section.combo && show(unlocked.has(trait.id))) && <p className="inline-empty">这个分类暂时没有符合条件的记录。</p>}</section>)}
    <section className="guide-section"><div className="subsection-title"><h2>观察者足迹</h2><span>A LITTLE AT A TIME</span></div><div className="milestone-grid">{MILESTONES.filter(item => show(collection.specimens.length >= item.days)).map(item => { const achieved = collection.specimens.length >= item.days; return <article className={`milestone ${achieved ? 'achieved' : ''}`} key={item.id}><span className="milestone-number">{String(item.days).padStart(2, '0')}<small>DAYS</small></span><div><h3>{item.name}{achieved && <Check size={14} />}</h3><p>{item.description}</p><div className="milestone-track"><span style={{ width: `${Math.min(100, collection.specimens.length / item.days * 100)}%` }} /></div></div></article> })}</div></section>
    <p className="page-footnote">结构定义公开透明。化石像素使用四邻接，空白使用八邻接；同组只取最高分，组合奖励最多 12 分。</p>
  </>
}
