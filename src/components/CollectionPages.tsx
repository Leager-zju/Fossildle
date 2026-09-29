import { useMemo, useState } from 'react'
import { ArrowRight, Bookmark, Check, Download, Grid2X2, Layers3, LockKeyhole, Search, Sparkles } from 'lucide-react'
import { specimenHash, type Collection, type Specimen } from '../lib/collection'
import { UNLOCK_ALL } from '../lib/localMode'
import { classifyTraitRarity, describeSpecimen, RARITIES } from '../lib/rarity'
import { GENERATOR_VERSION, TRAIT_GROUPS, TRAITS } from '../lib/engine'
import { traitCellGroups } from '../lib/traitCells'
import { TRAIT_EXAMPLES } from '../lib/traitExamples'
import { FossilArt, GROUP_FILLS } from './FossilArt'
import { Modal } from './Modal'

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
  const unlockedCount = UNLOCK_ALL ? TRAITS.length : unlocked.size
  return <>
    <section className="page-intro"><div><div className="eyebrow"><span className="tiny-line" /> YOUR PRIVATE MUSEUM</div><h1>把偶然，<em>好好收藏。</em></h1><p>这里没有普通的一天，只有尚未回看的发现。</p></div><button className="button button-outline" onClick={onExport}><Download size={16} /> 备份藏馆</button></section>
    <div className="collection-stats"><div><span>累计发现</span><strong>{String(items.length).padStart(2, '0')}<small>枚化石</small></strong></div><div><span>心动珍藏</span><strong>{String(items.filter(item => item.specimen.favorite).length).padStart(2, '0')}<small>枚偏爱</small></strong></div><div><span>结构图鉴</span><strong>{String(unlockedCount).padStart(2, '0')}<small>/ {TRAITS.length} 项</small></strong></div><div className="stat-note"><Layers3 size={27} strokeWidth={1.2} /><p>不必连续签到。<br />每一次回来，都算数。</p></div></div>
    <div className="cabinet-toolbar"><div className="segmented-control"><button className={!onlyFavorites ? 'active' : ''} onClick={() => setOnlyFavorites(false)}><Grid2X2 size={15} /> 全部发现</button><button className={onlyFavorites ? 'active' : ''} onClick={() => setOnlyFavorites(true)}><Bookmark size={15} /> 我的珍藏</button></div><div className="filter-tools"><label className="search-field"><Search size={15} /><input aria-label="搜索化石" value={query} onChange={event => setQuery(event.target.value)} placeholder="名称、日期、结构…" /></label><select aria-label="筛选稀有等级" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">全部等级</option>{RARITIES.map(rarity => <option key={rarity.id} value={rarity.id}>{rarity.name}</option>)}</select><select aria-label="藏馆排序" value={sort} onChange={event => setSort(event.target.value)}><option value="latest">最近发现</option><option value="rarity">结构分优先</option></select></div></div>
    {visible.length ? <div className="cabinet-grid">{visible.map(item => <article className="specimen-tile" key={item.specimen.date}><div className="tile-topline"><span>{item.specimen.date.replaceAll('-', '.')}</span><button className={`icon-button ${item.specimen.favorite ? 'is-saved' : ''}`} aria-label={item.specimen.favorite ? `取消珍藏${item.name}` : `珍藏${item.name}`} aria-pressed={item.specimen.favorite} onClick={() => onFavorite(item.specimen)}><Bookmark size={16} fill={item.specimen.favorite ? 'currentColor' : 'none'} /></button></div><a className="tile-link" href={specimenHash(item.specimen)}><div className="tile-art"><FossilArt board={item.board} miniature label={item.name} /></div><div className="tile-title"><h2>{item.name}</h2><ArrowRight size={16} /></div><div className="tile-footer"><span className={`rarity rarity-${item.rarity.id}`}>{item.rarity.name}</span><span>{item.metrics.count} 像素 · {item.traits.length} 个结构</span></div></a></article>)}</div> : <div className="empty-state"><div className="empty-icon"><Layers3 size={34} strokeWidth={1.2} /></div><h2>{items.length ? '还没有符合条件的化石' : '你的第一件藏品，还在岩石里。'}</h2><p>{items.length ? '试试其他筛选条件，或为喜欢的化石点亮书签。' : '从今天开始，让每一次小小的偶然有处可归。'}</p>{items.length ? <button className="button button-outline" onClick={() => { setQuery(''); setFilter('all'); setOnlyFavorites(false) }}>清除筛选</button> : <a className="button button-primary" href="#today">开启第一次发现 <ArrowRight size={16} /></a>}</div>}
    <p className="page-footnote">藏馆仅保存在当前浏览器。清除网站数据、使用无痕模式或更换设备都可能丢失记录，请定期导出备份。</p>
  </>
}

export function FieldGuide({ collection }: { collection: Collection }) {
  const [filter, setFilter] = useState('all')
  const [rarityFilter, setRarityFilter] = useState('all')
  const [group, setGroup] = useState('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('number')
  const [exampleId, setExampleId] = useState<string | null>(null)
  const search = query.trim()
  const clearFilters = () => { setFilter('all'); setRarityFilter('all'); setGroup('all'); setQuery(''); setSort('number') }
  const unlocked = useMemo(() => {
    const result = new Map<string, Specimen>()
    collection.specimens.forEach(specimen => describeSpecimen(specimen).traits.forEach(trait => {
      const first = result.get(trait.id)
      if (!first || specimen.date < first.date) result.set(trait.id, specimen)
    }))
    return result
  }, [collection])
  const unlockedCount = UNLOCK_ALL ? TRAITS.length : unlocked.size
  const traitRarities = useMemo(() => new Map(TRAITS.map(trait => [trait.id, classifyTraitRarity(trait.id)])), [])
  const example = useMemo(() => {
    const trait = exampleId ? TRAITS.find(item => item.id === exampleId) : undefined
    if (!trait) return null
    const board = TRAIT_EXAMPLES[trait.id]
    return { trait, board, rarity: traitRarities.get(trait.id)!, first: unlocked.get(trait.id), groups: traitCellGroups(board, trait.id) }
  }, [exampleId, traitRarities, unlocked])
  const visible = TRAITS.map((trait, index) => ({ trait, number: String(index + 1).padStart(2, '0'), first: unlocked.get(trait.id), revealed: UNLOCK_ALL || unlocked.has(trait.id), rarity: traitRarities.get(trait.id)! }))
    .filter(item => (filter === 'all' || (filter === 'unlocked' ? item.revealed : !item.revealed)) && (rarityFilter === 'all' || item.rarity.id === rarityFilter)
      && (group === 'all' || item.trait.group === group)
      && (!search || item.number.includes(search) || String(item.trait.points) === search || (item.revealed && (item.trait.name.includes(search) || item.trait.description.includes(search)))))
    .sort((a, b) => (sort === 'rarity' ? b.rarity.rank - a.rarity.rank : 0) || Number(a.number) - Number(b.number))
  const hasFilters = filter !== 'all' || rarityFilter !== 'all' || group !== 'all' || !!query || sort !== 'number'
  const emptyText = search || group !== 'all' || rarityFilter !== 'all' ? '没有符合条件的结构，试试其他筛选条件。' : filter === 'unlocked' ? '还没有发现结构，下一枚化石也许就藏着答案。' : '所有结构都已发现。'
  return <>
    <section className="page-intro"><div><div className="eyebrow"><span className="tiny-line" /> THE FIELD GUIDE</div><h1>细看一点，<em>多发现一点。</em></h1><p>每一种结构，都有名字。发现之后，才揭开它的秘密。</p></div><div className="guide-progress"><strong>{unlockedCount}<span>/ {TRAITS.length}</span></strong><span>图鉴已记录</span><div role="progressbar" aria-label="图鉴解锁进度" aria-valuenow={unlockedCount} aria-valuemin={0} aria-valuemax={TRAITS.length}><i style={{ width: `${unlockedCount / TRAITS.length * 100}%` }} /></div></div></section>
    <p className="guide-note">{TRAITS.length} 项结构全部参与计分，分为 {Object.keys(TRAIT_GROUPS).length} 类。每项分值由该结构在当前 v{GENERATOR_VERSION} 生成器中的命中概率标定：概率越低，基础分越高。同一形状族的层级互为上下位（存在至少该规模的强级一定蕴含弱级），被上位结构覆盖的下位结构不计分，其余结构各自独立相加，组合最多 12 分；旧藏品与分享页统一按新版规则重新解读。</p>
    <div className="guide-heading">
      <div className="segmented-control">{[{ id: 'all', name: '全部图鉴' }, { id: 'unlocked', name: '已经发现' }, { id: 'locked', name: '等待相遇' }].map(item => <button key={item.id} aria-pressed={filter === item.id} className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}>{item.name}</button>)}</div>
      <div className="filter-tools">
        <label className="search-field"><Search size={15} /><input aria-label="搜索结构图鉴" value={query} onChange={event => setQuery(event.target.value)} placeholder="分值、编号、已发现名称或条件…" /></label>
        <select aria-label="按结构类别筛选" value={group} onChange={event => setGroup(event.target.value)}><option value="all">全部类别</option>{Object.entries(TRAIT_GROUPS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
        <select aria-label="按结构稀有度筛选" value={rarityFilter} onChange={event => setRarityFilter(event.target.value)}><option value="all">全部稀有度</option>{RARITIES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select aria-label="图鉴排序" value={sort} onChange={event => setSort(event.target.value)}><option value="number">图鉴编号</option><option value="rarity">稀有度优先</option></select>
      </div>
    </div>
    <div className="guide-summary"><span aria-live="polite">显示 {visible.length} / {TRAITS.length} 项</span>{hasFilters && <button onClick={clearFilters}>清除筛选</button>}</div>
    <section className="guide-grid" aria-label="结构图鉴卡片">
      {visible.map(({ trait, number, first, revealed, rarity }) => <article className={`guide-card ${revealed ? 'unlocked' : 'locked'}`} key={trait.id} data-number={number} data-rarity={rarity.id} data-group={trait.group}>
        {revealed && <button type="button" className="guide-card-open" aria-label={`查看「${trait.name}」示例图案`} onClick={() => setExampleId(trait.id)} />}
        <div className="guide-card-top"><span className="guide-symbol" aria-hidden="true">{revealed ? <Sparkles size={16} strokeWidth={1.4} /> : <LockKeyhole size={15} strokeWidth={1.3} />}</span><h3>{revealed ? trait.name : '???'}</h3><span className="guide-points" title={`基础 ${trait.points} 分`}>{trait.points}</span></div>
        <div className="guide-meta"><span className={`rarity rarity-${rarity.id}`} title={rarity.note} aria-label={`结构稀有度：${rarity.name}。${rarity.note}`}>{rarity.name}</span></div>
        <p>{revealed ? trait.description : '尚未发现'}</p>
        {first && <div className="guide-card-footer"><a href={specimenHash(first)}><Check size={11} />首次发现 {first.date}</a></div>}
      </article>)}
    </section>
    {!visible.length && <p className="inline-empty" role="status">{emptyText}</p>}
    {example && <Modal title={`${example.trait.name} · 结构示例`} onClose={() => setExampleId(null)}>
      <div className="example-layout">
        <div className="example-art"><FossilArt board={example.board} activeGroups={example.groups} label={`${example.trait.name} 的示例图案`} /></div>
        <div className="example-copy">
          <div className="example-meta"><span className={`rarity rarity-${example.rarity.id}`} title={example.rarity.note} aria-label={`结构稀有度：${example.rarity.name}。${example.rarity.note}`}>{example.rarity.name}</span><span className="example-points">{example.trait.points} 分</span><span className="example-group">{TRAIT_GROUPS[example.trait.group]}</span></div>
          <p className="example-description">{example.trait.description}</p>
          {example.groups.length > 1 && <ul className="example-legend">{example.groups.map((group, index) => <li key={group.label || index}><i style={{ background: GROUP_FILLS[index % GROUP_FILLS.length] }} /><span className="legend-label">{group.label}</span><span className="legend-count">{group.cells.length} 格</span></li>)}</ul>}
          {example.first && <a className="example-link" href={specimenHash(example.first)}><Check size={11} />首次发现 {example.first.date}</a>}
        </div>
      </div>
    </Modal>}
  </>
}
