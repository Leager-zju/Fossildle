import { ArrowUpRight, Download, HardDrive, Upload } from 'lucide-react'
import { useRef } from 'react'

interface Props {
  onExport: () => void
  onImport: (file: File) => void
}
export function About({ onExport, onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  return <>
    <section className="page-intro"><div><div className="eyebrow"><span className="tiny-line" /> A SMALL NOTE FROM THE STATION</div><h1>关于偶然，<em>也关于诚实。</em></h1><p>这里是一个小小的像素博物馆，不是一场必须获胜的比赛。</p></div></section>
    <div className="about-layout"><section className="about-story"><span className="label-small">WHAT IS FOSSILDLE?</span><h2>每天留一点时间，<br />给没有用、但很美好的事。</h2><p>Fossildle 是一款每日像素化石收藏游戏。敲开一块岩石，得到一个 8×8 图案，发现它的对称、连通与空洞结构，再把它放进你的私人藏馆。</p><p>“化石”是我们的幻想设定，不对应真实物种或地质年代。你不需要懂考古，也不需要解出谜题，只要愿意停下来仔细看一眼。</p><div className="about-quote">稀有值得惊喜，<br />喜欢，本身就值得收藏。</div><span className="edition-label">FOSSILDLE / GENERATOR V1 / SCORING V1</span></section><section className="faq-list" aria-label="游戏规则">
      <details open><summary>每天什么时候可以发现新化石？</summary><p>统一在 UTC 00:00 开放下一份样本，北京时间为每天 08:00。日期和倒计时使用浏览器时钟。一天一枚，重复打开不会重新生成；错过一天不会扣除任何进度。</p></details>
      <details><summary>图案是完全随机的吗？</summary><p>不是所有 8×8 位图都等概率。生成器混合散点（45%）、生长（30%）、对称（20%）和空腔（5%）四种方式，输出包含 12～36 个化石格子的图案。结构成就只根据最终图案判断，不根据生成方式直接发放。</p></details>
      <details><summary>结构和空洞如何判定？</summary><p>化石格子通过上下左右相邻（四邻接）连接。空白允许沿对角线连通（八邻接），无法到达棋盘边缘的空白区域才算空洞。对称均以整个 8×8 棋盘为准，不以图案的包围盒为准。点击观察台的连通、空洞、对称标签可以查看高亮。</p></details>
      <details><summary>“稀有”到底意味着什么？</summary><p>首先计算结构分：同组只取最高分，跨组相加，组合加分最多 12 分。再对照生成器 v1 的一百万份固定模拟样本，估计得到同分或更高分的概率。</p><p>常见：大于 40%；特别：大于 12% 且不高于 40%；稀有：大于 2% 且不高于 12%；珍奇：大于 0.2% 且不高于 2%；典藏：不高于 0.2%。分数离散，因此实际等级占比不一定正好等于区间宽度。此概率不是这张具体图案的出现概率，也不是玩家排名。</p></details>
      <details><summary>为什么没有登录和排行榜？</summary><p>这是可托管在 GitHub Pages 的纯静态版本。身份、化石和珍藏标记只保存在当前浏览器的 localStorage 中，没有账号服务器，也无法防止修改时钟、清理数据或编辑分享链接。因此暂不提供竞技排行榜或结果认证。</p></details>
      <details><summary>分享会泄露我的收藏吗？</summary><p>分享链接只携带所选化石的日期、位图和规则版本，不包含浏览器身份，也不会上传整座藏馆。接收者可以查看和导出图片，但不能修改你的本地记录。分享图案不经过服务器认证，不应作为稀有度排名凭证。</p></details>
      <details><summary>更新后，老化石会改变吗？</summary><p>当前版本将位图和生成版本一起保存，并固定使用 v1 评分与模拟分布。后续新增生成器时，应保留旧版解读规则。相同图案可能再次出现，我们不会因此偷偷重抽。</p></details>
    </section></div>
    <section className="backup-panel"><div className="backup-copy"><HardDrive size={26} strokeWidth={1.4} /><div><h2>给你的藏馆留一份备份。</h2><p>清除网站数据会丢失记录。导出 JSON 文件，可在另一台设备恢复。备份含本地身份，请不要公开。</p></div></div><div className="backup-actions"><button className="button button-outline" onClick={onExport}><Download size={16} /> 导出备份</button><button className="button button-dark" onClick={() => inputRef.current?.click()}><Upload size={16} /> 导入备份</button><input ref={inputRef} className="sr-only" type="file" accept="application/json,.json" aria-label="选择藏馆备份" onChange={event => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = '' }} /></div></section>
    <div className="about-bottom"><span>没有广告追踪，没有强制签到，也没有付费重抽。</span><a href="https://www.rngdle.com/" target="_blank" rel="noreferrer">灵感来自 RNGdle <ArrowUpRight size={13} /></a></div>
  </>
}
