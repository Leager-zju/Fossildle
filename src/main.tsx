import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <main className="fatal-error"><h1>观察站暂时遇到了一点问题。</h1><p>你的存档没有被清除。请刷新页面重试，不要清理浏览器数据。</p><button onClick={() => window.location.reload()}>重新打开观察站</button></main>
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(<StrictMode><AppBoundary><App /></AppBoundary></StrictMode>)
