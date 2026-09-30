import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, BookOpen, Check, Cloud, Copy, Download, ExternalLink, Info, Layers3, LoaderCircle, Pickaxe, RotateCcw, Share2, ShieldCheck, Trophy, X } from 'lucide-react'
import { Discovery } from './components/Discovery'
import { Cabinet, FieldGuide } from './components/CollectionPages'
import { About } from './components/About'
import { AccountModal } from './components/Account'
import { Leaderboard } from './components/Leaderboard'
import { Modal } from './components/Modal'
import { FossilArt } from './components/FossilArt'
import { deleteRemote, readAccount, readRemote, saveAccount, serializeCollection, signIn, writeRemote, type Account } from './lib/account'
import { createCollection, discover, mergeCollections, parseCollection, parseSpecimenHash, readCollection, sameSpecimen, saveCollection, STORAGE_KEY, utcDate, type Collection, type Specimen } from './lib/collection'
import { GENERATOR_VERSION, generateSeededFossil, revealEntryCount, TRAITS, type Board } from './lib/engine'
import { rankingEnabled, rankingFor, rememberDay, requestSeed, submitScore, type RankedDay } from './lib/ranking'
import { describeSpecimen } from './lib/rarity'
import { createShareImage, downloadBlob, shareText, shareUrl } from './lib/share'
import { assertCurrentLocalBuild, initializeCollection, LOCAL_BUILD, LOCAL_BUILD_KEY, UNLOCK_ALL } from './lib/localMode'
import { revealKey, startRevealSequence } from './lib/useRevealSequence'

function loadInitial(): { collection: Collection; error: string | null } {
  try { return { collection: LOCAL_BUILD ? createCollection() : readCollection(), error: null } }
  catch { return { collection: createCollection(), error: '本地存储不可用或记录损坏。为保护原记录，发现已暂停。请允许浏览器存储，或在「关于」导入有效备份。' } }
}
function LogoMark() {
  return <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M8 2h16v5H8zM3 7h5v17H3zM24 7h5v17h-5zM8 24h16v5H8zM12 11h8v5h-3v5h-5z" /></svg>
}

export default function App() {
  const [initial] = useState(loadInitial)
  const [collection, setCollection] = useState(initial.collection)
  const [storageError, setStorageError] = useState(initial.error)
  const [route, setRoute] = useState(() => window.location.hash || '#today')
  const [date, setDate] = useState(utcDate)
  const [busy, setBusy] = useState(false)
  const discoverLock = useRef(false)
  const revealToastPending = useRef<Specimen | null>(null)
  const [toast, setToast] = useState('')
  const [shareSpecimen, setShareSpecimen] = useState<Specimen | null>(null)
  const [shareBusy, setShareBusy] = useState(false)
  const [pendingImport, setPendingImport] = useState<Collection | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [pendingReset, setPendingReset] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)
  const [account, setAccount] = useState<Account | null>(readAccount)
  const [accountOpen, setAccountOpen] = useState(false)
  const [accountBusy, setAccountBusy] = useState(false)
  const [accountError, setAccountError] = useState('')
  const [accountNotice, setAccountNotice] = useState('')
  const [ranked, setRanked] = useState<RankedDay | null>(() => rankingFor(utcDate()))
  const mainRef = useRef<HTMLElement>(null)
  const todaySpecimen = collection.specimens.find(specimen => specimen.date === date)
  const sharedRecord = useMemo(() => parseSpecimenHash(route), [route])
  const ownedShared = sharedRecord && collection.specimens.find(item => sameSpecimen(item, sharedRecord))
  const totalUnlocked = useMemo(() => UNLOCK_ALL ? TRAITS.length : new Set(collection.specimens.flatMap(item => describeSpecimen(item).traits.map(trait => trait.id))).size, [collection])

  useEffect(() => {
    const change = () => { setRoute(window.location.hash || '#today'); window.scrollTo(0, 0); mainRef.current?.focus() }
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== LOCAL_BUILD_KEY && event.key !== null) return
      try { assertCurrentLocalBuild(); setCollection(readCollection()); setStorageError(null) }
      catch { setStorageError('存档无法同步或本地版本已更新，请刷新页面；必要时在「关于」恢复备份。') }
    }
    window.addEventListener('hashchange', change)
    window.addEventListener('storage', sync)
    const interval = window.setInterval(() => setDate(utcDate()), 1000)
    return () => { window.removeEventListener('hashchange', change); window.removeEventListener('storage', sync); window.clearInterval(interval) }
  }, [])
  useEffect(() => { setRanked(rankingFor(date)) }, [date])
  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(''), 4500)
    return () => window.clearTimeout(id)
  }, [toast])
  useEffect(() => {
    const label = route === '#cabinet' ? '我的藏馆' : route === '#fieldguide' ? '结构图鉴' : route === '#about' ? '关于观察站' : sharedRecord ? describeSpecimen(sharedRecord).name : '每日像素化石'
    document.title = `Fossildle · ${label}`
  }, [route, sharedRecord])

  const withStorageLock = useCallback(async <T,>(action: () => T): Promise<T> => {
    if (navigator.locks) return navigator.locks.request(STORAGE_KEY, action)
    return action()
  }, [])

  const [initializing, setInitializing] = useState(true)
  useEffect(() => {
    let active = true
    void withStorageLock(() => initializeCollection()).then(current => {
      if (active) { setCollection(current); setStorageError(null) }
    }).catch(() => {
      if (active) setStorageError('本地存储不可用或记录损坏，或本地版本已更新。发现已暂停，请刷新页面或在「关于」恢复备份。')
    }).finally(() => { if (active) setInitializing(false) })
    return () => { active = false }
  }, [withStorageLock])

  const updateCollection = useCallback(async (updater: (current: Collection) => Collection) => {
    return withStorageLock(() => {
      assertCurrentLocalBuild()
      const next = updater(readCollection())
      saveCollection(next)
      setCollection(next)
      setStorageError(null)
      return next
    })
  }, [withStorageLock])

  // 云同步（可选）：本地存档始终是完整的可用副本，账号只用来把副本送到用户的私有 Gist。
  const accountRef = useRef<Account | null>(account)
  accountRef.current = account
  const pushedRef = useRef('')
  // syncedKey 表示该账号已完成一次成功的合并；在此之前绝不推送，避免本地覆盖云端记录。
  const syncedKeyRef = useRef('')
  const pullStartedRef = useRef('')

  const applyAccount = useCallback((next: Account | null) => { saveAccount(next); setAccount(next) }, [])

  const handleSignIn = async (token: string) => {
    if (accountBusy) return
    setAccountBusy(true)
    setAccountError('')
    setAccountNotice('')
    try {
      const result = await signIn(token, readCollection())
      await withStorageLock(() => { saveCollection(result.collection); setCollection(result.collection) })
      applyAccount(result.account)
      pushedRef.current = serializeCollection(result.collection)
      syncedKeyRef.current = `${result.account.login}:${result.account.gistId}`
      pullStartedRef.current = syncedKeyRef.current
      setAccountNotice(result.added || result.overwritten
        ? `已连接并合并：本地补入 ${result.added} 枚，云端记录替换了 ${result.overwritten} 枚同日期图纸。`
        : '已连接云端，当前藏馆已写入你的私有 Gist。')
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : '登录失败，请稍后重试。')
    } finally { setAccountBusy(false) }
  }
  const syncNow = useCallback(async (silent = false) => {
    const current = accountRef.current
    if (!current) return
    if (!silent) { setAccountBusy(true); setAccountError(''); setAccountNotice('') }
    try {
      const remote = await readRemote(current.token, current.gistId)
      const merged = mergeCollections(readCollection(), remote)
      const payload = serializeCollection(merged.collection)
      if (payload !== serializeCollection(remote)) await writeRemote(current.token, current.gistId, merged.collection)
      await withStorageLock(() => { saveCollection(merged.collection); setCollection(merged.collection) })
      pushedRef.current = payload
      syncedKeyRef.current = `${current.login}:${current.gistId}`
      applyAccount({ ...current, savedAt: new Date().toISOString() })
      if (!silent) setAccountNotice(merged.added || merged.overwritten
        ? `同步完成：本地补入 ${merged.added} 枚，云端记录替换了 ${merged.overwritten} 枚同日期图纸。`
        : `同步完成，云端共 ${remote.specimens.length} 枚化石。`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '同步失败，请稍后重试。'
      setAccountError(message)
      if (silent) setToast(`云端同步失败：${message}`)
    } finally { if (!silent) setAccountBusy(false) }
  }, [applyAccount, withStorageLock])
  const handleSignOut = () => {
    applyAccount(null)
    pushedRef.current = ''
    syncedKeyRef.current = ''
    pullStartedRef.current = ''
    setAccountError('')
    setAccountNotice('已断开连接，本机令牌已清除；云端 Gist 仍保留在你的 GitHub 账号里。')
  }
  const handleDeleteRemote = async () => {
    const current = accountRef.current
    if (!current || accountBusy) return
    setAccountBusy(true)
    setAccountError('')
    setAccountNotice('')
    try {
      await deleteRemote(current.token, current.gistId)
      applyAccount(null)
      pushedRef.current = ''
      syncedKeyRef.current = ''
      pullStartedRef.current = ''
      setAccountNotice('云端存档已删除，本机令牌也已清除；本地藏馆不受影响。')
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : '删除失败，请稍后重试。')
    } finally { setAccountBusy(false) }
  }
  useEffect(() => {
    if (!account || initializing) return
    if (syncedKeyRef.current !== `${account.login}:${account.gistId}`) return
    const payload = serializeCollection(collection)
    if (payload === pushedRef.current) return
    const active = account
    const timer = window.setTimeout(() => {
      void writeRemote(active.token, active.gistId, collection).then(() => {
        pushedRef.current = payload
        applyAccount({ ...active, savedAt: new Date().toISOString() })
      }).catch(() => setAccountError('自动同步失败，本地记录已保存；可在账号面板手动重试。'))
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [account, collection, initializing, applyAccount])
  useEffect(() => {
    if (!account || initializing) return
    const key = `${account.login}:${account.gistId}`
    if (pullStartedRef.current === key) return
    pullStartedRef.current = key
    void syncNow(true)
  }, [account, initializing, syncNow])

  // 每日排行：登录且开启参与时，先向服务端领取当日种子，用同一枚化石参与榜单。
  const seededBoard = async (discoveryDate: string): Promise<Board | null> => {
    const current = accountRef.current
    if (!current || current.rankOptIn === false || !rankingEnabled() || rankingFor(discoveryDate)) return null
    try {
      const seed = await requestSeed(current.token)
      if (seed.generatorVersion !== GENERATOR_VERSION || seed.date !== discoveryDate) {
        setToast('已跨到新的一天或客户端版本较旧，本次不计入排行；刷新页面可继续参与。')
        return null
      }
      setRanked(rememberDay(seed.date, { seed: seed.seed }))
      return generateSeededFossil(seed.seed)
    } catch (error) {
      setToast(`未能领取排行种子：${error instanceof Error ? error.message : '请稍后再试'}；本次仍可正常发现，只是不计入排行榜。`)
      return null
    }
  }
  const submitRanking = useCallback(async (targetDate: string) => {
    const current = accountRef.current
    const day = rankingFor(targetDate)
    if (!current || !day || day.seed === undefined || day.score !== undefined) return
    try {
      const result = await submitScore(current.token, targetDate)
      setRanked(rememberDay(result.date, { seed: day.seed, score: result.score, rarityId: result.rarityId, rank: result.rank, players: result.players, submittedAt: result.submittedAt }))
      setToast(result.rank === 1 ? `已上榜：${result.score} 分，目前第 1 名！` : `已上榜：${result.score} 分，当前第 ${result.rank} 名。`)
    } catch (error) {
      setToast(`排行提交失败：${error instanceof Error ? error.message : '可在每日排行页重试。'}`)
    }
  }, [])
  const handleDiscover = async () => {
    if (discoverLock.current || storageError || initializing) return
    discoverLock.current = true
    setBusy(true)
    try {
      const discoveryDate = utcDate()
      setDate(discoveryDate)
      const board = await seededBoard(discoveryDate)
      const next = await updateCollection(current => discover(current, discoveryDate, board ?? undefined).collection)
      const specimen = next.specimens.find(item => item.date === discoveryDate)!
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      await new Promise(resolve => window.setTimeout(resolve, reduced ? 80 : 1500))
      revealToastPending.current = specimen
      startRevealSequence(revealKey(specimen), revealEntryCount(describeSpecimen(specimen).traits))
    } catch {
      setStorageError('无法保存这次发现。请检查浏览器存储权限或可用空间；原有存档不会被覆盖。')
    } finally { setBusy(false); discoverLock.current = false }
  }
  const handleRevealComplete = useCallback((specimen: Specimen) => {
    if (revealToastPending.current && sameSpecimen(revealToastPending.current, specimen)) {
      revealToastPending.current = null
      setToast('今日发现已收入藏馆。仔细看看，它藏着哪些结构？')
    }
    if (specimen.date === utcDate() && rankingFor(specimen.date)?.seed !== undefined) void submitRanking(specimen.date)
  }, [submitRanking])
  const handleFavorite = async (specimen: Specimen) => {
    try {
      await updateCollection(current => ({ ...current, specimens: current.specimens.map(item => sameSpecimen(item, specimen) ? { ...item, favorite: !item.favorite } : item) }))
    } catch { setToast('珍藏标记保存失败，请检查浏览器存储。') }
  }
  const handleExport = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) { setToast('还没有可导出的本地记录。'); return }
      downloadBlob(new Blob([raw], { type: 'application/json' }), `fossildle-backup-${utcDate()}.json`)
      setToast('备份已导出，请妥善保存，不要公开本地身份数据。')
    } catch { setToast('无法访问本地记录，请检查浏览器设置。') }
  }
  const handleImportFile = async (file: File) => {
    try {
      if (file.size > 8_000_000) throw new Error('备份文件过大，请选择 8 MB 以内的 JSON 文件。')
      const imported = parseCollection(await file.text())
      setPendingImport(imported)
    } catch (error) { setToast(error instanceof SyntaxError ? '无法解析备份，请选择有效的 JSON 文件。' : error instanceof Error ? error.message : '备份读取失败。') }
  }
  const confirmImport = async () => {
    if (!pendingImport || importBusy) return
    setImportBusy(true)
    try {
      await withStorageLock(() => { assertCurrentLocalBuild(); saveCollection(pendingImport); setCollection(pendingImport); setStorageError(null) })
      setPendingImport(null)
      setToast('藏馆已恢复。新发现将沿用备份中的本地身份。')
    } catch { setToast('恢复失败，当前浏览器无法写入存档。') }
    finally { setImportBusy(false) }
  }
  const confirmReset = async () => {
    if (resetBusy) return
    setResetBusy(true)
    try {
      const fresh = createCollection()
      await withStorageLock(() => { assertCurrentLocalBuild(); saveCollection(fresh); setCollection(fresh); setStorageError(null) })
      setPendingReset(false)
      setToast('存档已重置，可以重新开始发现。')
    } catch { setToast('重置失败，当前浏览器无法写入存档。') }
    finally { setResetBusy(false) }
  }
  const copyLink = async () => {
    if (!shareSpecimen) return
    try { await navigator.clipboard.writeText(shareText(shareSpecimen)); setToast('分享文案与链接已复制。') }
    catch { setToast('自动复制不可用，请长按或选中下方链接手动复制。') }
  }
  const exportImage = async () => {
    if (!shareSpecimen || shareBusy) return
    setShareBusy(true)
    try { downloadBlob(await createShareImage(shareSpecimen), `fossildle-${shareSpecimen.date}.png`); setToast('分享图片已生成。') }
    catch (error) { setToast(error instanceof Error ? error.message : '图片导出失败，请使用分享链接。') }
    finally { setShareBusy(false) }
  }
  const systemShare = async () => {
    if (!shareSpecimen || shareBusy) return
    if (!navigator.share) { await copyLink(); return }
    setShareBusy(true)
    try { await navigator.share({ title: `Fossildle · ${describeSpecimen(shareSpecimen).name}`, text: '每天一枚像素化石，把一点偶然放进博物馆。', url: shareUrl(shareSpecimen) }) }
    catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) setToast('系统分享不可用，请复制链接或保存图片。') }
    finally { setShareBusy(false) }
  }
  const shareData = shareSpecimen ? describeSpecimen(shareSpecimen) : null
  const navigation = [
    { href: '#today', name: '今日发现', Icon: Pickaxe },
    { href: '#cabinet', name: '我的藏馆', Icon: Layers3 },
    { href: '#fieldguide', name: '结构图鉴', Icon: BookOpen },
    { href: '#leaderboard', name: '每日排行', Icon: Trophy },
  ]
  const isDiscovery = route === '#today' || !!sharedRecord

  return <div className="app-shell">
    <a href="#main-content" className="skip-link" onClick={event => { event.preventDefault(); mainRef.current?.focus() }}>跳至主要内容</a>
    <header className="site-header"><div className="header-inner"><a href="#today" className="brand" aria-label="Fossildle 首页"><span className="brand-symbol"><LogoMark /></span><span>Fossildle<small>像素地层观察站</small></span></a><nav className="main-nav" aria-label="主导航">{navigation.map(({ href, name, Icon }) => <a key={href} href={href} className={(route === href || (href === '#today' && sharedRecord)) ? 'active' : ''} aria-current={route === href ? 'page' : undefined}><Icon size={15} /><span>{name}</span>{href === '#cabinet' && collection.specimens.length > 0 && <small>{collection.specimens.length}</small>}</a>)}</nav><div className="header-right"><span className={`daily-status ${todaySpecimen ? 'complete' : ''}`}><span />{todaySpecimen ? '今日已发现' : '今天，新的可能'}</span><button type="button" className={`icon-button ${account ? 'active' : ''}`} aria-label={account ? `云端同步：@${account.login}` : '登录并同步藏馆'} onClick={() => { setAccountError(''); setAccountNotice(''); setAccountOpen(true) }}><Cloud size={19} strokeWidth={1.5} /></button><a href="#about" className={`icon-button ${route === '#about' ? 'active' : ''}`} aria-label="关于与游戏规则"><Info size={19} strokeWidth={1.5} /></a></div></div></header>

    <main id="main-content" ref={mainRef} tabIndex={-1}>
      {LOCAL_BUILD && <div className="local-build-note"><Pickaxe size={14} /><span>本地调试 · 重新构建或重启开发服务后重置收藏，可重新抽取；本轮刷新保留结果，不影响线上存档。</span></div>}
      {storageError && <div className="storage-warning" role="alert"><Info size={18} /><p>{storageError}</p><a href="#about">备份与恢复 <ArrowRight size={14} /></a></div>}
      {isDiscovery ? <Discovery key={sharedRecord ? route : date} collection={collection} specimen={busy && !sharedRecord ? undefined : ownedShared || sharedRecord || todaySpecimen} date={date} isShared={!!sharedRecord && !ownedShared} isArchive={!!ownedShared} busy={busy} disabled={!!storageError || initializing} onDiscover={() => void handleDiscover()} onShare={setShareSpecimen} onRevealComplete={handleRevealComplete} /> : route === '#cabinet' ? <Cabinet collection={collection} onFavorite={specimen => void handleFavorite(specimen)} onExport={handleExport} /> : route === '#fieldguide' ? <FieldGuide collection={collection} /> : route === '#leaderboard' ? <Leaderboard account={account} date={date} ranked={ranked} onSignIn={() => { setAccountError(''); setAccountNotice(''); setAccountOpen(true) }} onSubmit={targetDate => void submitRanking(targetDate)} /> : route === '#about' ? <About onExport={handleExport} onImport={file => void handleImportFile(file)} onReset={() => setPendingReset(true)} /> : <section className="empty-state"><BookOpen size={36} /><h1>这页手记，还没有被发现。</h1><p>链接可能不完整，或来自尚不支持的规则版本。</p><a className="button button-primary" href="#today">返回今日地层 <ArrowRight size={16} /></a></section>}
    </main>

    <footer className="site-footer"><div className="footer-brand"><LogoMark /><span>Fossildle<small>A LITTLE PIECE OF TIME.</small></span></div><p>慢一点，看看偶然留下了什么。</p><div><span><ShieldCheck size={13} /> 本地保存</span><a href="#fieldguide">图鉴 {totalUnlocked}/{TRAITS.length}</a><a href="#about">规则与备份 <ArrowRight size={12} /></a></div></footer>
    {toast && <div className="toast" role="status"><Check size={16} /><span>{toast}</span><button className="icon-button" aria-label="关闭提示" onClick={() => setToast('')}><X size={15} /></button></div>}
    {shareSpecimen && shareData && <Modal title="让这次偶然，被更多人看见。" onClose={() => setShareSpecimen(null)}><div className="share-preview"><div className="share-preview-header"><span>Fossildle</span><small>{shareSpecimen.date}</small></div><FossilArt board={shareData.board} miniature label={shareData.name} /><h3>{shareData.name}</h3><span className={`rarity rarity-${shareData.rarity.id}`}>{shareData.rarity.name}</span><p>{shareData.description}</p></div><div className="share-controls"><button className="button button-primary" disabled={shareBusy} onClick={() => void exportImage()}>{shareBusy ? <LoaderCircle size={16} className="spin" /> : <Download size={16} />} 保存图片</button><button className="button button-outline" onClick={() => void copyLink()}><Copy size={16} /> 复制链接</button><button className="icon-button share-native" disabled={shareBusy} onClick={() => void systemShare()} aria-label="系统分享"><Share2 size={18} /></button></div><label className="share-link-label">只读链接<input readOnly value={shareUrl(shareSpecimen)} aria-label="只读分享链接" onFocus={event => event.target.select()} /></label><p className="modal-note">只分享这枚化石，不包含你的身份或整座藏馆。结果由本地生成，未经服务器认证。<a href={shareUrl(shareSpecimen)} target="_blank" rel="noreferrer">预览分享页 <ExternalLink size={12} /></a></p></Modal>}
    {accountOpen && <AccountModal account={account} busy={accountBusy} error={accountError} notice={accountNotice} onSignIn={token => void handleSignIn(token)} onSync={() => void syncNow()} onSignOut={handleSignOut} onDeleteRemote={() => void handleDeleteRemote()} onToggleRank={value => { const current = accountRef.current; if (current) applyAccount({ ...current, rankOptIn: value }) }} onClose={() => setAccountOpen(false)} />}
    {pendingReset && <Modal title="重置这座藏馆？" onClose={() => { if (!resetBusy) setPendingReset(false) }}><div className="import-summary"><RotateCcw size={30} /><strong>将清空 {collection.specimens.length} 枚化石</strong><p>重置会删除当前浏览器中的全部发现与珍藏标记，并生成新的本地身份，无法撤销。需要保留记录时请先导出备份。</p>{account && <b className="account-warn">已连接云端同步：重置后的空存档会推送到云端 Gist，云端记录一并清空。</b>}</div><div className="import-actions"><button className="button button-outline" onClick={handleExport}>先导出备份</button><button className="button button-primary" disabled={resetBusy} onClick={() => void confirmReset()}>{resetBusy ? '正在重置…' : '确认清空并重置'}</button></div></Modal>}
    {pendingImport && <Modal title="恢复这份藏馆备份？" onClose={() => { if (!importBusy) setPendingImport(null) }}><div className="import-summary"><Download size={30} /><strong>{pendingImport.specimens.length} 枚化石</strong><p>恢复会替换当前浏览器中的 {collection.specimens.length} 枚化石和本地身份，不会自动合并。建议先导出现有藏馆。</p></div><div className="import-actions"><button className="button button-outline" onClick={handleExport}>先备份当前藏馆</button><button className="button button-primary" disabled={importBusy} onClick={() => void confirmImport()}>{importBusy ? '正在恢复…' : '确认替换并恢复'}</button></div></Modal>}
  </div>
}
