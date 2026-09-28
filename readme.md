# Fossildle

每天发现一枚像素化石，把一点偶然放进你的私人博物馆。

- [开始游戏](https://leager-zju.github.io/Fossildle/)
- [GitHub 仓库](https://github.com/Leager-zju/Fossildle)

Fossildle 是一个以随机图案、结构发现和收藏为核心的轻量网页游戏，灵感来自 [RNGdle](https://www.rngdle.com/)。项目使用 React、TypeScript、Vite 和 SVG，完全静态，可部署到 GitHub Pages，无需后端或账号。

## 玩法与功能

1. 点击「发现今日化石」，敲开岩石。
2. 8×8 图案从上到下逐行揭晓。
3. 命中的结构按实际得分从低到高依次出现，新条目放在顶部；全部揭示结束后显示最终结构分和整体稀有度。
4. 点击结构条目，相关化石格保留原色，无关格置灰；再次点击取消选择。
5. 在藏馆中回看、筛选、珍藏化石，或分享只读链接和 PNG 图片。

图鉴包含 16 项结构，不区分基础与组合分区。未发现条目隐藏名称和条件，解锁后可查看其首次发现记录。

## 生成与计分规则

- **当前生成器为 v2**：使用浏览器安全随机源的 64 个随机位，每个像素独立以 1/2 概率成为化石，以 1/2 概率留白。
- 不限制化石像素数量，不做对称保底，也不因图案普通、全空或全满而重新抽取。
- 每天一枚，以 UTC 日期为准，UTC 00:00 更新，即北京时间 08:00。当天结果先保存再播放动画，刷新或重播不会重新抽取。
- 化石连通使用四邻接；空白区域使用八邻接。无法连到棋盘边缘的空白区域才算空洞。
- 结构分按组取最高分，跨组相加；组合加分总额最多 12 分。同组未计入总分的命中结构仍会显示并解锁图鉴。
- 独立模型下，对称结构极其罕见；大多数图案可能没有命中得分结构。这是概率模型的结果，不存在隐含补偿机制。

### 两种稀有度

- **整体稀有度**：参考对应生成器版本的百万份模拟样本，估计得到同分或更高分的概率，不是玩家排名或具体位图出现的概率。
- **结构稀有度**：依据结构自身的命中概率，与本次是否计分无关。可解析的 v2 结构使用理论概率，其余参考模拟频率；零观测项目按 95% 单侧概率上界暂定等级，不把零观测解释为零概率。

两者使用「常见、特别、稀有、珍奇、典藏」五档。历史 v1 藏品保留原位图、原版本概率解读和分享链接；结构评分规则仍为 v1。

## 本地开发

### 环境

- Node.js **22.12.0 或以上**，推荐 Node.js 24 LTS。
- npm。
- 使用本地辅助脚本时需要 Python **3.10 或以上**，仅使用标准库，无需安装 Python 依赖。
- 自动释放端口依赖系统工具：macOS/Linux 使用 `lsof`，Windows 使用 `netstat` 和 `taskkill`。下列命令以 macOS/Linux 为例。

在项目根目录执行：

| 用途 | 命令 |
|---|---|
| 开发热更新并打开浏览器 | `python3 local.py dev --open` |
| 开发详细日志 | `python3 local.py dev --debug --open` |
| 构建本地版本 | `python3 local.py build` |
| 构建带 source map 的调试版本并预览 | `python3 local.py preview --debug --open` |
| 仅预览已有产物，无需 Node | `python3 local.py preview --skip-build` |
| 查看全部选项 | `python3 local.py --help` |

缺少前端构建依赖时，脚本自动执行 `npm ci`；传入 `--install` 可按锁文件重装。

- 开发地址：`http://127.0.0.1:5173/`。
- 静态预览地址：`http://127.0.0.1:4173/Fossildle/`，模拟 Pages 子路径与真实 404 行为。
- 可通过 `--port`、`--host`、`--base-path` 调整服务；按 Ctrl+C 停止。
- 用浏览器开发者工具调试前端。`--debug` 构建提供 TS/TSX source map。

### 本地模式注意事项

**端口自动清理：** `dev` 和 `preview` 启动前会停止占用目标 TCP 端口的监听进程，包括其他项目的服务。先正常终止，超时再强制终止；不会自动提权。纯 `build` 不处理端口。

**调试存档重置：** 每次通过 `local.py` 启动开发服务或重新构建，会生成新的本地版本标识。浏览器首次加载该版本时，清空本应用的本地收藏并更新身份，以便重新抽取。同版本刷新、热更新及 `--skip-build` 不重复重置。此行为仅在本机或私网地址生效，不影响正式站点；需保留本地收藏时请先备份。

也可直接使用 npm，不启用 Python 脚本的自动端口清理与本地版本重置：

```sh
npm ci
npm run dev
```

### 日志

项目日志统一放在 `Saved/`，npm 调试日志写入 `Saved/npm/`。Python 脚本及构建工具默认仍向终端输出；如需保存输出：

```sh
mkdir -p Saved
python3 local.py build --debug > Saved/local-build.log 2>&1
```

`Saved/`、缓存、测试产物及 `dist/` 均已加入 Git 忽略规则。

## 构建与部署

正式构建使用普通 npm 命令：

```sh
npm ci
npm run build
```

产物位于 `dist/`。不要把带本地重置标识和 source map 的调试产物作为正式发布包；应重新执行正式构建。

### GitHub Pages

1. 将本项目内容放在 GitHub 仓库根目录，而不是再套一层项目文件夹。
2. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 向 `main` 或 `master` 推送，或在 Actions 中手动运行 `Deploy Fossildle to GitHub Pages`。
4. 工作流安装依赖、运行前端单元测试、构建并发布 `dist/`。

部署配置：`.github/workflows/deploy.yml`。Vite 使用相对资源路径，页面及只读分享使用 Hash 路由，兼容 `https://<用户>.github.io/<仓库>/` 形式的仓库子路径。

## 测试与校准

| 用途 | 命令 |
|---|---|
| 前端生成、计分、存档与概率单元测试 | `npm test` |
| Python 工具测试 | `python3 -m unittest test_local -v` |
| 安装项目内 Chromium 测试浏览器 | `npm run test:browser` |
| 桌面和手机浏览器回归 | `npm run test:e2e` |
| 重新生成当前版本的百万样本参考分布 | `npm run calibrate` |

浏览器回归会构建生产产物并启动静态服务，默认使用端口 4173；运行前请停止占用该端口的预览服务。Python 集成测试会使用临时端口，并仅清理测试创建的监听进程。

校准输出为 `src/data/rarity-v<生成器版本>.json`。已经发布的版本应冻结生成和概率数据；更改概率模型时新增版本，不覆盖历史分布。

## 目录说明

| 路径 | 内容 |
|---|---|
| `src/App.tsx` | 页面导航、存档初始化、分享与备份交互 |
| `src/components/` | 观察台、像素图案、藏馆、图鉴与弹窗 |
| `src/lib/engine.ts` | 生成器、结构判定与评分 |
| `src/lib/collection.ts` | 版本化标本、每日记录与分享编码 |
| `src/lib/rarity.ts` | 整体及结构稀有度 |
| `src/lib/useRevealSequence.ts` | 逐行显形与逐项得分时序 |
| `src/lib/localMode.ts` | 本地构建版本与存档重置 |
| `src/data/` | 冻结的各版本概率参考数据 |
| `scripts/calibrate.ts` | 概率模拟校准 |
| `tests/` | 浏览器回归测试 |
| `local.py`、`test_local.py` | 本地开发工具及 Python 测试 |
| `Saved/` | 本地日志，不提交到仓库 |

## 存档与限制

收藏仅保存在当前浏览器的 `localStorage`，没有账号或云同步。不同浏览器、域名和端口的记录互不共享；清除网站数据或使用无痕模式可能丢失记录。

在「关于」中可导出 JSON 备份并恢复。**导入会替换当前藏馆和本地身份，不会自动合并**；备份包含本地身份信息，请勿公开。

分享链接只携带所选化石的日期、位图和生成版本，不包含整座藏馆。项目为纯静态游戏，无法阻止修改时钟、编辑存档或构造分享链接，因此不提供服务器认证与防作弊竞技排名。
