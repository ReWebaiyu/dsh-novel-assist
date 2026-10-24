# dsh-novel-assist · 小说辅助模拟插件

DeepSeek Harness 的侧边栏小说创作面板，三个页签：

- **自己作品**：绑定本机作品文件夹、扫描目录、集中编辑创作参数。
- **技能兼容**：导入本地或网上下载的 Agent Skills（SKILL.md），并在 GitHub 技能市场里搜索、安装网文/小说类技能。
- **平台扫榜**：按平台 + 分区抓取新书榜，补全镜像正文，归类故事架构；支持多分区、自定义平台/分区、已导入技能筛选视角，结果统一用仿宋字体显示。

## 自己作品

- 侧边栏书页图标（`sidebar.panellist`，order 35）→ `main` 同名面板。
- 作品文件夹：宿主原生目录选择器（`uiWorkspace.pickDirectory()`）或手输路径；限深扫描并显示子文件夹 / 文件 / 疑似章节 / 正文字数。
- 参数：作品信息、创作设定、模拟参数（耐心/爽点/节奏三档滑杆），600ms 防抖自动保存。
- 数据位置：`%DSH_HOME%\novel-assist\state.json`。

## 技能兼容

- **本地技能库**：扫描 `%DSH_HOME%\skills`，展示名称、描述、文件数、更新时间和来源。
- **导入**：选中含 `SKILL.md` 的文件夹（多技能会列出子技能）、本地 `SKILL.md` / `.zip` 路径、GitHub 仓库 / `tree` / `blob` / raw 链接。
- **规范化**：补 `description`、修正非 kebab-case 的 `name`、重名落盘为 `<name>-2` 并同步改写 frontmatter。
- **市场**：9 个精选网文技能仓库 + 实时 GitHub 搜索，一键安装；多技能仓库可选子技能。
- **移除**：两段式确认，仅允许删除用户技能库内、含 `SKILL.md` 的目录。
- 导入后技能立即进入 DSH 技能目录，无需重启。

## 平台扫榜

- **内置平台**：番茄小说、书旗小说、起点中文网、QQ阅读、纵横中文网、七猫小说，每个都带榜单链接。
- **番茄全量分区**：从番茄榜单页抄下 38 个分区（9 个常用 + 29 个扩展，含男频/女频），筛选栏默认只显示一行，点「展开全部分区」查看其余。
- **自定义分区**：填写分区名 + 番茄分区链接（含 `/rank/1_2_258`）或数字 ID，保存到 `state.json`，可删除。
- **自定义平台**：填写平台名 + 榜单链接，通用解析器抽书单；链接支持 `{genre}` / `{genreLabel}` 占位。
- **镜像正文**：开启「镜像补全正文」后，用 Bing 检索该书的镜像站目录，校验书名/作者与章号，抓取前几章正文（每本最多 6 章，单章截断 1500 字）；找不到就退回榜单 + 简介 + 章节标题，并在状态里说明。
- **我的小说 / 筛选技能**：顶部卡片导入自己下载的 `.txt` / `.md` 或文件夹（自动分章、取前 10 章标题），右上角勾选已导入技能，一键用所选技能分析本地小说的开篇架构；技能只作分析视角，不执行代码。
- **结果展示**：扫榜状态、书单（书名/作者/简介 + 前 10 章标题）、能拿到正文的镜像来源链接（没有就不显示）、按分区归类的架构卡片、吸引力说明、分区结论、跨分区结论；该页签所有文字统一使用仿宋（FangSong）字体。
- **干净文本**：番茄书名/作者/简介/章节目录改从书页服务端渲染的 HTML 读取（`page-abstract-content`、`chapter-item-title`、meta keywords），不再使用字体混淆后的状态数据，因此不会出现 □□□；书页解析失败时才回退。
- **结果缓存**：每次扫榜结果写入 `%DSH_HOME%\novel-assist\rank-last.json`；切换页签、关闭面板、刷新页面后自动恢复，不重复调用模型、不重复消耗 Token。
- **扫描流程**：抓榜 → 前 10 → 镜像补正文用于分析 → 调用当前默认模型（`deepseek-account/deepseek-flash`）输出结构化架构分析；正文本身不在界面展示，只给出可跳转的来源链接。

## 数据与接口

| 位置 | 说明 |
|---|---|
| `%DSH_HOME%\novel-assist\state.json` | 作品参数、绑定文件夹、自定义平台、自定义分区 |
| `%DSH_HOME%\novel-assist\rank-last.json` | 最近一次扫榜结果缓存 |
| `%DSH_HOME%\skills\<name>\` | 导入的技能 |

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/novel-assist/api/state` | 读取状态 |
| POST | `/novel-assist/api/state` | 保存 `{ state }` |
| POST | `/novel-assist/api/scan` | 扫描作品文件夹 `{ path }` |
| GET | `/novel-assist/api/skills` | 本地技能库 |
| POST | `/novel-assist/api/skills/import` | 导入技能 `{ kind, path? , url? }` |
| POST | `/novel-assist/api/skills/repo` | 从仓库安装 `{ repo, path?, branch? }` |
| POST | `/novel-assist/api/skills/remove` | 移除 `{ dir }` |
| GET | `/novel-assist/api/skills/market?q=` | 精选 + GitHub 搜索 |
| GET | `/novel-assist/api/rank/platforms` | 平台与 38 个分区目录 |
| GET | `/novel-assist/api/rank/last` | 最近一次扫榜缓存 |
| POST | `/novel-assist/api/rank/scan` | 扫榜 `{ platforms, genres, topN, chapters, mirror, skills }` |
| POST | `/novel-assist/api/rank/local` | 导入本地小说 `{ path }` |
| POST | `/novel-assist/api/rank/local/analyze` | 分析本地小说 `{ path, skills }` |
| GET | `/novel-assist/api/rank/mirror?title=&author=` | 镜像检索诊断 |

`genres` 既接受分区 id 字符串，也接受 `{ id, label, keywords, maps }` 对象（自定义分区用对象）。

## 结构

| 文件 | 作用 |
|---|---|
| `package.json` | bundle 清单：`dsh.bundle.patch` + `dsh.client` |
| `cordis.patch.yml` | 插入 `novel-assist` Host 行 |
| `index.js` | Host 半：状态、作品目录扫描、技能导入/移除、GitHub 搜索与下载 |
| `rank.js` | Host 半：平台/分区目录、榜单抓取、镜像正文、架构分析（LLM） |
| `client.js` | Client 半：侧边栏图标、三页签面板、仿宋结果区、本地化、样式 |
| `locale/zh.json`、`locale/en.json` | 插件管理里的名称与说明 |

## 源码结构（三个板块分开）

`client.js` 由 `src/build-client.mjs` 拼接生成，**改代码请改 `src/client/`**：

| 文件 | 板块 | 内容 |
|---|---|---|
| `src/client/00-boot.js` | 公共层 | 加载器外壳、zh/en 文案、状态合并、请求、格式化、图标、基础控件 |
| `src/client/10-skills.js` | 技能兼容 | `SkillsStudio` |
| `src/client/20-rank.js` | 平台扫榜 | `RankTab` |
| `src/client/30-work.js` | 自己作品 | `NovelPanel`、全局样式、`apply` 注册 |
| `src/build-client.mjs` | 构建 | 按顺序拼接 → `client.js` |

详细代码地图见：

- [docs/panel-work.md](docs/panel-work.md)
- [docs/panel-skills.md](docs/panel-skills.md)
- [docs/panel-rank.md](docs/panel-rank.md)
- [docs/api.md](docs/api.md)
- [docs/install.md](docs/install.md)

构建：

```powershell
$node = 'C:\Users\lx\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
& $node 'D:\WenJian\GZQ\novel-assist\src\build-client.mjs'
```

## 已知限制

- 番茄 web 正文有约 60% 的字体混淆（PUA），插件不解析原文，靠镜像站补正文；书名/作者/简介/章节目录已改取书页服务端渲染文本，正常不会出现框框。
- 镜像命中率取决于 Bing 与镜像可达性（当前 wodushu、washai 等可用，部分站点 403）。
- 起点 202 反爬、QQ阅读/纵横脚本渲染、七猫无法直连，这四家只保留榜单链接并明确报错。
- 书旗章节接口容易 429，主要使用榜单、分类和简介。
- 镜像正文仅用于本次结构分析，不落盘；界面只显示“正文来源”链接，未命中的书不显示链接；请遵守来源站点条款。
- 每次扫榜会消耗一次模型调用；镜像抓取有 240 秒总预算，超时后剩余书回退到简介/标题。

## 本地开发

源码目录 `D:\WenJian\GZQ\novel-assist`，以 `link:` 方式装进 desktop profile。

- 改 Host 半（`index.js` / `rank.js`）：在插件管理里关开一次插件让它重新挂载。
- 改 Client 半（`client.js`）：刷新 Web 界面后生效（客户端模块不做热更新）。
- 语法自检（本机无独立 node）：

```
$env:ELECTRON_RUN_AS_NODE=1
& 'D:\WenJian\DeepSeek\DeepSeek Harness.exe' --check 'D:\WenJian\GZQ\novel-assist\rank.js'
```
