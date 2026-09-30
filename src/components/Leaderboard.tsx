import { useCallback, useEffect, useState } from 'react'
import { Cloud, Info, LoaderCircle, RefreshCw, Trophy } from 'lucide-react'
import { timeUntilReset } from '../lib/collection'
import { RARITIES } from '../lib/rarity'
import { avatarUrl, fetchBoard, rankingEnabled, type Board, type BoardEntry, type RankedDay } from '../lib/ranking'
import type { Account } from '../lib/account'

interface Props {
  account: Account | null
  date: string
  ranked: RankedDay | null
  onSignIn: () => void
  onSubmit: (date: string) => void
}

const rarityOf = (id: string) => RARITIES.find(rarity => rarity.id === id) ?? RARITIES[0]

function Avatar({ playerId, size = 34 }: { playerId: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  return <span className="rank-avatar" style={{ width: size, height: size }}>
    <span aria-hidden="true">{playerId.slice(0, 1).toUpperCase()}</span>
    {!failed && <img src={avatarUrl(playerId, size * 2)} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(true)} />}
  </span>
}

function Row({ item, mine = false }: { item: BoardEntry; mine?: boolean }) {
  const rarity = rarityOf(item.rarityId)
  return <li className="rank-row" data-me={mine} data-player={item.playerId}>
    <span className="rank-index">{String(item.rank).padStart(2, '0')}</span>
    <Avatar playerId={item.playerId} />
    <span className="rank-name">{item.playerId}<small>{rarity.name} · {item.submittedAt.slice(11, 16)} UTC</small></span>
    <span className="rank-score">{item.score}<small>分</small></span>
  </li>
}

export function Leaderboard({ account, date, ranked, onSignIn, onSubmit }: Props) {
  const [board, setBoard] = useState<Board | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => new Date())

  const load = useCallback(async () => {
    if (!rankingEnabled()) { setStatus('error'); setError('当前构建没有配置排行服务地址。'); return }
    setStatus('loading')
    setError('')
    try {
      setBoard(await fetchBoard(date, account?.token ?? null))
      setStatus('ready')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '榜单读取失败，请稍后再试。')
      setStatus('error')
    }
  }, [account?.token, date])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const submitted = ranked?.score !== undefined
  const pending = !!ranked && ranked.seed !== undefined && !submitted
  const inTop = !!board?.me && board.top.some(item => item.playerId === board.me!.playerId)

  return <>
    <section className="page-intro"><div><div className="eyebrow"><span className="tiny-line" /> DAILY RANKING</div><h1>每日排行。<em>比今天的手气。</em></h1><p>每人每天拿到的化石都不一样，比的只是这一天的运气。成绩由服务端按当日种子重算，谁也填不了假分数。</p></div><div className="guide-progress"><strong>{board?.players ?? 0}<span> 人</span></strong><span>今日参与者</span></div></section>

    <div className="rank-stats"><div><span>我的今日成绩</span><strong>{submitted ? ranked!.score : '—'}<small>分</small></strong></div><div><span>我的名次</span><strong>{submitted && board?.me ? `第 ${board.me.rank}` : '—'}</strong></div><div><span>距离重置</span><strong>{timeUntilReset(now)}</strong></div></div>

    {!rankingEnabled() ? <p className="inline-empty" role="status">排行服务尚未配置：构建时需要设置 <code>VITE_FOSSILDLE_API</code> 指向已部署的 Worker。</p>
      : !account ? <div className="rank-prompt"><Trophy size={22} strokeWidth={1.4} /><div><strong>连接 GitHub 账号即可上榜</strong><p>上榜会公开你的 GitHub 名字与头像；不登录也能照常游玩，只是不进榜。</p></div><button className="button button-primary" onClick={onSignIn}><Cloud size={16} /> 登录并连接</button></div>
        : pending ? <div className="rank-prompt"><LoaderCircle size={22} className="spin" strokeWidth={1.4} /><div><strong>今日已用排行种子开箱</strong><p>成绩还没提交成功，重试一次即可上榜。</p></div><button className="button button-outline" onClick={() => onSubmit(date)}>重新提交成绩</button></div>
          : !ranked ? <div className="rank-prompt"><Trophy size={22} strokeWidth={1.4} /><div><strong>今天还没领取排行种子</strong><p>现在去开箱，App 会先向服务端领取今天的种子，开箱后自动上榜。</p></div><a className="button button-primary" href="#today">去发现今日化石</a></div>
            : <div className="rank-prompt" data-me="true"><Trophy size={22} strokeWidth={1.4} /><div><strong>已上榜：{ranked.score} 分{board?.me ? `，第 ${board.me.rank} 名` : ''}</strong><p>成绩已锁定，不能重抽；明天 UTC 00:00 自动开始新的一天。</p></div></div>}

    <div className="section-label"><span>今日榜单</span><span>TOP {board?.top.length ?? 0} · {date} UTC<button className="icon-button" aria-label="刷新榜单" disabled={status === 'loading'} onClick={() => void load()}><RefreshCw size={14} /></button></span></div>
    {status === 'loading' && !board ? <p className="inline-empty" role="status">正在读取榜单……</p>
      : status === 'error' ? <div className="rank-error" role="alert"><Info size={16} /><p>{error}</p><button className="button button-outline button-small" onClick={() => void load()}>重试</button></div>
        : !board?.top.length ? <p className="inline-empty" role="status">今天还没有人上榜，做第一个吧。</p>
          : <>
            <ul className="rank-board" aria-label="今日排行榜">{board.top.map(item => <Row key={item.playerId} item={item} mine={item.playerId === board.me?.playerId} />)}</ul>
            {board.me && !inTop && <ul className="rank-board" aria-label="我的名次"><Row item={board.me} mine /></ul>}
          </>}

    <p className="page-footnote">运气榜：分数由化石图案决定，服务端用当日种子复现图案并重算分数，客户端无法提交或修改分数。同一账号一天只有一条成绩；明天 UTC 00:00（北京时间 08:00）自动重置。榜单只展示今日，历史数据保留 90 天后由定时任务清理。</p>
  </>
}
