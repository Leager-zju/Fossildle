import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowLeft, ArrowRight, Bookmark, Check, ChevronDown, Clock3, Eye, Fingerprint, Layers3, Pickaxe, RotateCcw, ScanLine, Share2, Sparkles } from 'lucide-react'
import { FossilArt, RockArt } from './FossilArt'
import { describeSpecimen } from '../lib/rarity'
import { featuredTraits, type Highlight } from '../lib/engine'
import { timeUntilReset, utcDate, type Collection, type Specimen } from '../lib/collection'

interface Props {
  collection: Collection
  specimen?: Specimen
  date: string
  isShared?: boolean
  isArchive?: boolean
  busy: boolean
  disabled: boolean
  onDiscover: () => void
  onFavorite: (specimen: Specimen) => void
  onShare: (specimen: Specimen) => void
}

function ResetClock() {
  const [remaining, setRemaining] = useState(() => timeUntilReset())
  useEffect(() => {
    const id = window.setInterval(() => setRemaining(timeUntilReset()), 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="countdown"><Clock3 size={13} /> 下份样本 <strong>{remaining}</strong></span>
}

export function Discovery({ collection, specimen, date, isShared, isArchive, busy, disabled, onDiscover, onFavorite, onShare }: Props) {
  const [highlight, setHighlight] = useState<Highlight>('none')
  const [showAll, setShowAll] = useState(false)
  const [replay, setReplay] = useState(0)
  const data = useMemo(() => specimen ? describeSpecimen(specimen) : null, [specimen])
  const priorTraits = useMemo(() => new Set(collection.specimens.filter(item => item.date < (specimen?.date ?? date)).flatMap(item => describeSpecimen(item).traits.map(trait => trait.id))), [collection, specimen, date])
  const index = specimen ? collection.specimens.findIndex(item => item.date === specimen.date && item.hex === specimen.hex) + 1 : collection.specimens.length + 1
  const number = String(index || 1).padStart(3, '0')
  const traits = data ? (showAll ? data.traits : featuredTraits(data.traits)) : []
  const owned = !!specimen && collection.specimens.some(item => item.date === specimen.date && item.hex === specimen.hex)
  const specimenDate = specimen?.date ?? date
  const selectHighlight = (next: Highlight) => setHighlight(current => current === next ? 'none' : next)
  return <>
    {(isShared || isArchive) && <a className="back-link" href="#today"><ArrowLeft size={15} /> 返回今日地层 <span>{owned ? '来自你的藏馆' : '只读分享 · 不会加入你的收藏'}</span></a>}
    <section className="page-intro">
      <div>
        <div className="eyebrow"><span className="tiny-line" /> {isShared ? 'A DISCOVERY, SHARED' : 'THE DAILY EXCAVATION'}</div>
        <h1>{isShared ? <>一枚化石，<em>一个故事。</em></> : <>时间藏起的，<em>今天发现。</em></>}</h1>
        <p>{isShared ? '来自另一位观察者的小小发现。偶然，也值得被分享。' : '每天一枚像素化石，把一点偶然放进你的私人博物馆。'}</p>
      </div>
      <div className="intro-note"><span className="edition-label">FIELD NOTES / VOL. 01</span><span className="edition-date">{specimenDate.replaceAll('-', ' . ')}</span><span className="edition-caption">不必追赶时间，只需保留一小片。</span></div>
    </section>

    <div className="discovery-layout">
      <section className={`excavation-card ${busy ? 'is-excavating' : ''}`} aria-label="化石观察台">
        <div className="card-topline"><span><ScanLine size={15} /> {specimen ? '标本观察台' : '今日地层'}</span><span className={`status-label ${specimen ? 'found' : ''}`}><i />{busy ? '正在清理岩层' : specimen ? '发现已记录' : '等待你的发现'}</span></div>
        <div className="specimen-stage">
          <span className="vertical-caption">FOSSILDLE · FIELD COLLECTION</span>
          <span className="stage-coordinate">{specimen ? 'SPECIMEN' : 'UNOPENED'}<br />{specimen ? `NO. ${owned ? number : '—'}` : 'NO. ' + number}</span>
          <div className="stage-orbit orbit-one" /><div className="stage-orbit orbit-two" />
          {data ? <div className="main-fossil"><FossilArt key={`${specimen?.hex}-${replay}`} board={data.board} highlight={highlight} animated label={`${data.name}，${data.metrics.count} 个化石像素`} /></div> : <RockArt cracking={busy} />}
          <div className="stage-scale"><i /><span>8 × 8 PIXEL FIELD</span><i /></div>
          {!data && <span className="sample-stamp">SEALED<br /><small>待开启</small></span>}
          {data && <button className="replay-button icon-button" aria-label="重播显形动画，不重新生成" title="重播显形动画" onClick={() => setReplay(value => value + 1)}><RotateCcw size={16} /></button>}
        </div>
        {data && specimen ? <div className="specimen-caption"><div><span className="eyebrow">SPECIMEN {owned ? number : 'SHARED'}</span><h2>{data.name}<span className={`rarity rarity-${data.rarity.id}`}>{data.rarity.name}</span></h2><p>{data.description}</p></div><div className="specimen-actions">{owned && <button className={`icon-button save-button ${specimen.favorite ? 'is-saved' : ''}`} onClick={() => onFavorite(specimen)} aria-label={specimen.favorite ? '取消珍藏' : '加入珍藏'} aria-pressed={specimen.favorite}><Bookmark size={19} fill={specimen.favorite ? 'currentColor' : 'none'} /></button>}<button className="button button-dark button-small" onClick={() => onShare(specimen)}><Share2 size={15} /> 分享发现</button></div></div> : <div className="excavate-action"><div><h2>{busy ? '轻轻敲开，时间正在显形。' : '石头里，会藏着什么？'}</h2><p>不必猜测，不必准备。今天的偶然正在等你。</p></div><button className="button button-primary" disabled={busy || disabled} onClick={onDiscover}><Pickaxe size={18} className={busy ? 'pickaxe-working' : ''} />{busy ? '正在发现…' : '发现今日化石'}{!busy && <ArrowRight size={17} />}</button><span className="action-footnote"><span className="small-dot" /> 每日一次 · 免费探索 · 无需注册</span></div>}
        <div className="card-bottomline"><span><Fingerprint size={13} /> {data ? '每个结构，都有迹可循' : '尚未开启的可能性'}</span>{specimen?.date === utcDate() || !specimen ? <ResetClock /> : <span>发现于 {specimen.date}</span>}</div>
      </section>

      <aside className="field-notes">
        <div className="section-label"><span>观察手记</span><span>FIELD NOTES <ArrowDownRight size={14} /></span></div>
        {data ? <>
          <div className="notes-intro"><span className="label-small">{owned ? '你的发现' : '分享标本'}</span><h2>偶然之中，<br />也有<span>自己的秩序。</span></h2><p>选择一种观察方式，看看这些像素之间藏着怎样的联系。</p></div>
          <div className="structure-tabs" aria-label="结构高亮方式">{([{ id: 'none', label: '标本' }, { id: 'components', label: '连通' }, { id: 'holes', label: '空洞' }, { id: 'symmetry', label: '对称' }] as const).map(tab => <button key={tab.id} aria-pressed={highlight === tab.id} className={highlight === tab.id ? 'active' : ''} onClick={() => setHighlight(tab.id)}>{tab.label}</button>)}</div>
          <div className="metric-grid"><div><strong>{data.metrics.count}<small>/ 64</small></strong><span>化石像素</span></div><div><strong>{data.metrics.components.length}</strong><span>连通块</span></div><div><strong>{data.metrics.holes.length}</strong><span>封闭空洞</span></div></div>
          <div className="traits-list">{traits.length ? traits.map(trait => <button key={trait.id} className={`trait-row ${highlight !== 'none' && highlight === trait.highlight ? 'selected' : ''}`} onClick={() => selectHighlight(trait.highlight)} title={trait.description}><span className="trait-mark"><Sparkles size={16} /></span><span><strong>{trait.name}{owned && !priorTraits.has(trait.id) && <small>新图鉴</small>}</strong><span>{trait.description}</span></span></button>) : <div className="quiet-note"><Eye size={18} /><p>没有特别的结构标签，<br />但它仍是今天唯一的一枚。</p></div>}</div>
          {data.traits.length > featuredTraits(data.traits).length && <button className="text-button show-traits" onClick={() => setShowAll(value => !value)}>{showAll ? '收起结构' : `查看全部 ${data.traits.length} 个结构`}<ChevronDown size={14} className={showAll ? 'rotate' : ''} /></button>}
          <details className="rarity-explanation"><summary><span className={`rarity-dot rarity-${data.rarity.id}`} />{data.rarity.name} · 结构分 {data.score}<span>如何判定？</span></summary><p>在 {data.rarity.samples.toLocaleString('zh-CN')} 份模拟样本中，同分或更高分的估计概率约为 {(data.rarity.tail * 100).toFixed(data.rarity.tail < 0.01 ? 2 : 1)}%。它不是具体图案的概率，也不是玩家排名。同组仅取最高分，组合加分封顶 12 分。</p></details>
        </> : <>
          <div className="notes-intro"><span className="label-small">欢迎来到像素地层观察站</span><h2>一小块石头，<br />一整片<span>未知。</span></h2><p>有些像枝叶，有些像群岛。<br />每一枚化石，都是偶然留下的笔迹。</p></div>
          <div className="process-list"><div><span>01</span><div><h3>敲开一块岩石</h3><p>每天一份样本，轻轻开启。</p></div><Pickaxe size={18} /></div><div><span>02</span><div><h3>发现隐藏的结构</h3><p>镜像、空洞，或连成一体的遗痕。</p></div><ScanLine size={18} /></div><div><span>03</span><div><h3>放进你的博物馆</h3><p>收藏、分享，让每次偶然留下来。</p></div><Bookmark size={18} /></div></div>
          <div className="museum-note"><span className="note-icon"><Layers3 size={22} strokeWidth={1.4} /></span><div><span>观察员小贴士</span><p>稀有值得惊喜，<br />喜欢，本身就值得收藏。</p></div></div>
        </>}
        <div className="local-note"><Check size={13} /><span>记录仅存于当前浏览器，记得在「关于」备份。</span></div>
      </aside>
    </div>

    <section className="discovery-bottom"><div className="daily-thought"><span className="asterisk"><Sparkles size={30} strokeWidth={1.2} /></span><div><span className="label-small">SLOW DOWN. LOOK CLOSER.</span><p>“不是所有珍贵，都需要一个高分。”</p></div></div><a href="#cabinet" className="collection-shortcut"><div className="mini-stack"><span /><span /><span><Layers3 size={19} /></span></div><div><span>你的私人藏馆</span><strong>{collection.specimens.length} <small>枚发现，等待回看</small></strong></div><ArrowRight size={19} /></a></section>
  </>
}
