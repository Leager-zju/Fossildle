import { ArrowUpRight, Download, HardDrive, Upload } from 'lucide-react'
import { useRef } from 'react'
import { SCORING_VERSION, TRAITS } from '../lib/engine'

interface Props {
  onExport: () => void
  onImport: (file: File) => void
}
export function About({ onExport, onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  return <>
    <section className="page-intro"><div><div className="eyebrow"><span className="tiny-line" /> A SMALL NOTE FROM THE STATION</div><h1>关于偶然，<em>也关于诚实。</em></h1><p>这里是一个小小的像素博物馆，不是一场必须获胜的比赛。</p></div></section>
    <div className="about-layout"><section className="about-story"><span className="label-small">WHAT IS FOSSILDLE?</span><h2>每天留一点时间，<br />给没有用、但很美好的事。</h2><p>Fossildle 是一款每日像素化石收藏游戏。敲开一块岩石，得到一个 8×8 图案，发现它的对称、连通与空洞结构，再把它放进你的私人藏馆。</p><p>“化石”是我们的幻想设定，不对应真实物种或地质年代。你不需要懂考古，也不需要解出谜题，只要愿意停下来仔细看一眼。</p><div className="about-quote">稀有值得惊喜，<br />喜欢，本身就值得收藏。</div><span className="edition-label">FOSSILDLE / GENERATOR V2 / SCORING V{SCORING_VERSION}</span></section><section className="faq-list" aria-label="游戏规则">
      <details open><summary>每天什么时候可以发现新化石？</summary><p>统一在 UTC 00:00 开放下一份样本，北京时间为每天 08:00。日期和倒计时使用浏览器时钟。一天一枚，重复打开不会重新生成；错过一天不会扣除任何进度。</p></details>
      <details><summary>图案是完全随机的吗？</summary><p>新发现使用 v2：从浏览器安全随机源读取 64 个随机位，每格独立以 1/2 概率成为化石像素，或以 1/2 概率留白。没有像素数量限制、对称保底或结果重抽，全空和全满也会保留。当天结果先写入存档，刷新继续使用原图。历史 v1 标本仍保留其原有混合模型的解读。</p></details>
      <details><summary>扩展结构如何计分？</summary><p>图鉴全部 {TRAITS.length} 项均为计分结构，涵盖星群、晶体、石花、织纹、边界与疏密节律。每项分值由该结构在当前生成器中的命中概率标定，概率越低基础分越高；计分时同一形状族的层级互为上下位（例如十字星 5 格 → 9 格 → 13 格），被上位结构覆盖的下位结构不计分，其余结构各自独立相加，组合最多 12 分。被上位结构覆盖的命中项会收进该项下方的可展开分支，灰调弱化并采用更小字号，仍照常解锁图鉴，组合加分达到上限而未计分的条目则单独平铺显示。所有命中项逐项揭示，全部结束后才显示总分和开放分享。</p><p>后续新增结构也必须配置分值并参与同一计分流程，不再设置仅观察、不计分的条目。已有藏品会按原位图补充识别，首次发现取最早符合条件的藏品日期。图鉴稀有度参考当前生成器 v2；标本详情参考自身生成器及当前评分规则的百万样本分布。</p></details>
      <details><summary>结构和空洞如何判定？</summary><p>化石格子通过上下左右相邻（四邻接）连接。空白允许沿对角线连通（八邻接），无法到达棋盘边缘的空白区域才算空洞。对称均以整个 8×8 棋盘为准，不以图案的包围盒为准。点击观察手记中的得分条目，相关化石格保持原色，其余化石格置灰；再次点击可取消。若条目的证据由多组构成（多个连通块、多个空洞、左右/上下半场、四个象限、成对的对边），各组会使用不同颜色区分，便于看清数量差与分组。图鉴中点击已发现的卡片会弹出该结构的标准示例窗口，同样按此方案着色并附分组图例。空洞类突出包围空洞的边界，贯穿类突出完整行列，对称、连通和重心等全局结构由全部化石格参与。</p></details>
      <details><summary>“稀有”到底意味着什么？</summary><p>整体稀有度：先计算结构分（被上位结构覆盖的下位结构不计分，其余相加，组合加分最多 12 分），再对照标本所属生成器版本的一百万份固定模拟样本，估计同分或更高分的概率。结构稀有度：看这个结构本身出现的频率，与它是否计入总分无关；因此 +0 分的命中结构也有稀有度。</p><p>常见：大于 40%；特别：大于 12% 且不高于 40%；稀有：大于 2% 且不高于 12%；珍奇：大于 0.2% 且不高于 2%；典藏：不高于 0.2%。分数离散，因此实际等级占比不一定正好等于区间宽度。整体尾概率不是这张具体图案的出现概率，也不是玩家排名。结构也按这五档划分；v2 的单轴镜像、双轴对称、四向回转和不触边结构使用理论概率，其余使用模拟频率。百万样本中未观测到的结构按 95% 单侧概率上界暂定等级，不把零观测说成零概率。独立模型下，全局对称结构极其罕见；局部结构更常见，但没有得分保底。</p><p>结构分值与结构稀有度同源：每项基础分由该结构的命中概率标定，概率越低分值越高，约在 1 至 40 分之间。因此卡片上的分值本身就是稀有度的直观读数。</p></details>
      <details><summary>为什么没有登录和排行榜？</summary><p>这是可托管在 GitHub Pages 的纯静态版本。身份、化石和珍藏标记只保存在当前浏览器的 localStorage 中，没有账号服务器，也无法防止修改时钟、清理数据或编辑分享链接。因此暂不提供竞技排行榜或结果认证。</p></details>
      <details><summary>分享会泄露我的收藏吗？</summary><p>分享链接只携带所选化石的日期、位图和规则版本，不包含浏览器身份，也不会上传整座藏馆。接收者可以查看和导出图片，但不能修改你的本地记录。分享图案不经过服务器认证，不应作为稀有度排名凭证。</p></details>
      <details><summary>更新后，老化石会改变吗？</summary><p>原位图、日期、生成版本与珍藏标记不变，不会重新抽取。所有藏品、旧分享链接与导入备份统一按评分 v{SCORING_VERSION} 重新计分，因此分数和整体稀有度可能变化。概率参考已按两代生成器分别重新校准各一百万份样本，不会用旧评分分布解释新分数。旧链接与备份格式仍然兼容。</p></details>
    </section></div>
    <section className="backup-panel"><div className="backup-copy"><HardDrive size={26} strokeWidth={1.4} /><div><h2>给你的藏馆留一份备份。</h2><p>清除网站数据会丢失记录。导出 JSON 文件，可在另一台设备恢复。备份含本地身份，请不要公开。</p></div></div><div className="backup-actions"><button className="button button-outline" onClick={onExport}><Download size={16} /> 导出备份</button><button className="button button-dark" onClick={() => inputRef.current?.click()}><Upload size={16} /> 导入备份</button><input ref={inputRef} className="sr-only" type="file" accept="application/json,.json" aria-label="选择藏馆备份" onChange={event => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = '' }} /></div></section>
    <div className="about-bottom"><span>没有广告追踪，没有强制签到，也没有付费重抽。</span><a href="https://www.rngdle.com/" target="_blank" rel="noreferrer">灵感来自 RNGdle <ArrowUpRight size={13} /></a></div>
  </>
}
