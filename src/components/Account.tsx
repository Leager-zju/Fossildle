import { useState } from 'react'
import { Cloud, ExternalLink, LoaderCircle, LogOut, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { TOKEN_CREATE_URL, type Account } from '../lib/account'
import { rankingEnabled } from '../lib/ranking'
import { Modal } from './Modal'

interface Props {
  account: Account | null
  busy: boolean
  error: string
  notice: string
  onSignIn: (token: string) => void
  onSync: () => void
  onSignOut: () => void
  onDeleteRemote: () => void
  onToggleRank: (value: boolean) => void
  onClose: () => void
}

function formatSyncTime(value: string): string {
  const parsed = new Date(value)
  if (!value || !Number.isFinite(parsed.getTime())) return '尚未完成首次同步'
  return `${parsed.toISOString().slice(0, 10).replaceAll('-', '.')} ${parsed.toISOString().slice(11, 16)} UTC`
}

export function AccountModal({ account, busy, error, notice, onSignIn, onSync, onSignOut, onDeleteRemote, onToggleRank, onClose }: Props) {
  const [token, setToken] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  return <Modal title={account ? '云端同步中。' : '把藏馆接到你的 GitHub 账号。'} onClose={onClose}>
    {account ? <>
      <div className="account-status"><Cloud size={20} strokeWidth={1.4} /><div><strong>@{account.login}</strong><small>上次同步 {formatSyncTime(account.savedAt)}</small></div></div>
      <p className="account-copy">藏馆保存在你自己 GitHub 账号的一个<b>私有 Gist</b>（{account.gistId.slice(0, 7)}…）。登录后本地改动会自动推送，其他设备打开时自动合并。Fossildle 没有服务器，令牌只留在本机浏览器。</p>
      {rankingEnabled() && <label className="account-toggle"><input type="checkbox" checked={account.rankOptIn} onChange={event => onToggleRank(event.target.checked)} /><span>参与「每日排行」：今天开箱会先向服务端领取种子并自动上榜，榜单会公开你的 GitHub 名字与头像。</span></label>}
      <div className="import-actions"><button className="button button-primary" disabled={busy} onClick={onSync}>{busy ? <LoaderCircle size={16} className="spin" /> : <RefreshCw size={16} />} 立即同步</button><button className="button button-outline" disabled={busy} onClick={onSignOut}><LogOut size={16} /> 断开连接</button></div>
      <button className={`button button-reset account-danger ${confirmDelete ? 'is-confirming' : ''}`} disabled={busy} onClick={() => { if (confirmDelete) onDeleteRemote(); else setConfirmDelete(true) }}><Trash2 size={16} /> {confirmDelete ? '确认删除云端存档并断开' : '删除云端存档并断开'}</button>
    </> : <>
      <div className="import-summary"><Cloud size={30} /><strong>可选：跨设备同步藏馆</strong><p>用 GitHub 访问令牌登录后，藏馆会存进你自己账号的私有 Gist。没有令牌也不影响游玩：本地存档始终是完整可用的。</p></div>
      <label className="share-link-label account-token-label">GitHub 访问令牌（勾选 gist 权限）<input value={token} onChange={event => setToken(event.target.value)} aria-label="GitHub 访问令牌" placeholder="ghp_… 或 github_pat_…" autoComplete="off" spellCheck={false} /></label>
      <div className="import-actions"><a className="button button-outline" href={TOKEN_CREATE_URL} target="_blank" rel="noreferrer">去 GitHub 生成令牌 <ExternalLink size={13} /></a><button className="button button-primary" disabled={busy || !token.trim()} onClick={() => onSignIn(token)}>{busy ? <LoaderCircle size={16} className="spin" /> : <Cloud size={16} />} 登录并同步</button></div>
    </>}
    {notice && <p className="account-notice" role="status">{notice}</p>}
    {error && <p className="account-error" role="alert">{error}</p>}
    <p className="modal-note"><ShieldCheck size={12} /> 令牌只保存在本机浏览器，仅用于访问 api.github.com，不会上传到任何第三方；断开连接或删除云端存档都会立即清除本机令牌。私有 Gist 里的数据你可以随时在 GitHub 上自行删除。</p>
  </Modal>
}
