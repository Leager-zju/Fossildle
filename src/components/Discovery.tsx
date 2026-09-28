import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowLeft, ArrowRight, Clock3, Fingerprint, Layers3, Pickaxe, RotateCcw, ScanLine, Share2, Sparkles } from 'lucide-react'
import { FossilArt, RockArt } from './FossilArt'
import { classifyTraitRarity, describeSpecimen } from '../lib/rarity'
import { scoreBreakdown } from '../lib/engine'
import { traitCells } from '../lib/traitCells'
import { sameSpecimen, timeUntilReset, type Collection, type Specimen } from '../lib/collection'
import { useRevealSequence } from '../lib/useRevealSequence'

interface Props {
  collection: Collection
  specimen?: Specimen
  date: string
  isShared?: boolean
  isArchive?: boolean
  busy: boolean
  disabled: boolean
  onDiscover: () => void
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

export function Discovery({ collection, specimen, date, isShared, isArchive, busy, disabled, onDiscover, onShare }: Props) {
  const [selection, setSelection] = useState<{ key: string; traitId: string } | null>(null)
  const [replay, setReplay] = useState(0)
  const data = useMemo(() => specimen ? describeSpecimen(specimen) : null, [specimen])
  const breakdown = useMemo(() => scoreBreakdown(data?.traits ?? []).map(item => ({ ...item, rarity: classifyTraitRarity(item.trait.id, specimen?.version) })).sort((a, b) => a.awarded - b.awarded || a.trait.points - b.trait.points), [data, specimen?.version])
  const sequenceKey = `${specimen?.version}:${specimen?.date}:${specimen?.hex}:${replay}`
  const reveal = useRevealSequence(sequenceKey, !!data, breakdown.length)
  const visibleScores = breakdown.slice(0, reveal.scores).reverse()
  const priorTraits = useMemo(() => new Set(collection.specimens.filter(item => item.date < (specimen?.date ?? date)).flatMap(item => describeSpecimen(item).traits.map(trait => trait.id))), [collection, specimen, date])
  const index = specimen ? collection.specimens.findIndex(item => sameSpecimen(item, specimen)) + 1 : collection.specimens.length + 1
  const number = String(index || 1).padStart(3, '0')
  const owned = !!specimen && collection.specimens.some(item => sameSpecimen(item, specimen))
  const specimenDate = specimen?.date ?? date
  const selectedTrait = selection?.key === sequenceKey && visibleScores.some(item => item.trait.id === selection.traitId) ? selection.traitId : null
  const activeCells = useMemo(() => data && selectedTrait ? traitCells(data.board, selectedTrait) : undefined, [data, selectedTrait])
  const selectTrait = (traitId: string) => setSelection(current => current?.key === sequenceKey && current.traitId === traitId ? null : { key: sequenceKey, traitId })
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
          {data ? <div className="main-fossil"><FossilArt key={sequenceKey} board={data.board} activeCells={activeCells} revealedRows={reveal.rows} label={`${data.name}，${data.metrics.count} 个化石像素${selectedTrait ? '，已突出所选结构相关格子' : ''}`} /></div> : <RockArt cracking={busy} />}
          <div className="stage-scale"><i /><span>{data && reveal.rows < 8 ? `REVEALING ROW ${reveal.rows + 1} / 8` : '8 × 8 PIXEL FIELD'}</span><i /></div>
          {!data && <span className="sample-stamp">SEALED<br /><small>待开启</small></span>}
          {data && <button className="replay-button icon-button" aria-label="重播显形与计分，不重新生成" title="重播显形与计分" onClick={() => { setSelection(null); setReplay(value => value + 1) }}><RotateCcw size={16} /></button>}
        </div>
        {!data && <div className="excavate-action"><div><h2>{busy ? '轻轻敲开，时间正在显形。' : '石头里，会藏着什么？'}</h2><p>不必猜测，不必准备。今天的偶然正在等你。</p></div><button className="button button-primary" disabled={busy || disabled} onClick={onDiscover}><Pickaxe size={18} className={busy ? 'pickaxe-working' : ''} />{busy ? '正在发现…' : '发现今日化石'}{!busy && <ArrowRight size={17} />}</button><span className="action-footnote"><span className="small-dot" /> 每日一次 · 免费探索 · 无需注册</span></div>}
        <div className="card-bottomline"><span className="bottomline-note"><Fingerprint size={13} /> <span>{data ? '每个结构，都有迹可循' : '尚未开启的可能性'}</span></span><ResetClock />{specimen && <button className="button button-dark button-small bottomline-share" disabled={!reveal.complete} onClick={() => onShare(specimen)}><Share2 size={15} /> 分享发现</button>}</div>
      </section>

      <aside className="field-notes" aria-label="观察手记" data-phase={!data ? 'waiting' : reveal.complete ? 'complete' : reveal.rows < 8 ? 'rows' : 'scores'}>
        <div className="section-label"><span>观察手记</span><span>FIELD NOTES <ArrowDownRight size={14} /></span></div>
        {data && reveal.rows === 8 && <>
          {reveal.complete && <div className="score-total" role="status"><span>最终结构分</span><div className="score-result"><span className={`rarity overall-rarity rarity-${data.rarity.id}`}>{data.rarity.name}</span><strong data-testid="structure-score">{data.score}<small>分</small></strong></div></div>}
          {visibleScores.map(({ trait, awarded, rarity }) => <button key={`${sequenceKey}-${trait.id}`} data-trait={trait.id} data-awarded={awarded} aria-pressed={selectedTrait === trait.id} className={`trait-row score-entry ${selectedTrait === trait.id ? 'selected' : ''}`} onClick={() => selectTrait(trait.id)} title={trait.description}><span className="trait-mark"><Sparkles size={16} /></span><span className="trait-copy"><strong><span className="trait-name">{trait.name}</span><span className={`rarity trait-rarity rarity-${rarity.id}`} title={rarity.note} aria-label={`结构稀有度：${rarity.name}。${rarity.note}`}>{rarity.name}</span>{owned && !priorTraits.has(trait.id) && <small className="new-trait">新图鉴</small>}</strong><span>{trait.description}</span></span><span className={`trait-points ${awarded ? '' : 'not-counted'}`}>+{awarded}<small>分</small></span></button>)}
        </>}
      </aside>
    </div>

    <section className="discovery-bottom"><div className="daily-thought"><span className="asterisk"><Sparkles size={30} strokeWidth={1.2} /></span><div><span className="label-small">SLOW DOWN. LOOK CLOSER.</span><p>“不是所有珍贵，都需要一个高分。”</p></div></div><a href="#cabinet" className="collection-shortcut"><div className="mini-stack"><span /><span /><span><Layers3 size={19} /></span></div><div><span>你的私人藏馆</span><strong>{collection.specimens.length} <small>枚发现，等待回看</small></strong></div><ArrowRight size={19} /></a></section>
  </>
}
