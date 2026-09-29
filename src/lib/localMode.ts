import { createCollection, readCollection, saveCollection } from './collection'

export const LOCAL_BUILD_KEY = 'fossildle.local-build.v1'
const BUILD_FORMAT = /^\d{20}-[a-f0-9]{32}$/

export function isLocalHost(hostname: string): boolean {
  const parts = hostname.split('.').map(Number)
  const privateIPv4 = parts.length === 4 && parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255)
    && (parts[0] === 127 || parts[0] === 10 || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31))
  return hostname === 'localhost' || hostname === '[::1]' || privateIPv4
}

export function localBuildForHost(build: string | undefined, hostname: string): string {
  if (!build || !BUILD_FORMAT.test(build)) return ''
  return isLocalHost(hostname) ? build : ''
}

// local.py --unlock-all：解锁全部结构图鉴，仅在本机/私网地址生效，避免调试开关随构建产物公开。
export function unlockAllForHost(flag: string | undefined, hostname: string): boolean {
  return (flag === '1' || flag === 'true') && isLocalHost(hostname)
}

export const LOCAL_BUILD = localBuildForHost(import.meta.env.VITE_FOSSILDLE_LOCAL_BUILD, typeof window === 'undefined' ? '' : window.location.hostname)
export const UNLOCK_ALL = unlockAllForHost(import.meta.env.VITE_FOSSILDLE_UNLOCK_ALL, typeof window === 'undefined' ? '' : window.location.hostname)

export function assertCurrentLocalBuild(build = LOCAL_BUILD) {
  if (!build) return
  const saved = localStorage.getItem(LOCAL_BUILD_KEY)
  if (saved && BUILD_FORMAT.test(saved) && saved > build) throw new Error('本地版本已更新，请刷新此标签页后继续。')
}

export function initializeCollection(build = LOCAL_BUILD) {
  if (build) {
    assertCurrentLocalBuild(build)
    if (localStorage.getItem(LOCAL_BUILD_KEY) !== build) {
      const fresh = createCollection()
      saveCollection(fresh)
      localStorage.setItem(LOCAL_BUILD_KEY, build)
      return fresh
    }
  }
  const current = readCollection()
  saveCollection(current)
  return current
}
