# 板块三：平台扫榜

源码：`src/client/20-rank.js`；Host 逻辑在 `rank.js`。

## 1. 职责

- 我的小说：导入本地 `.txt` / `.md` / 文件夹，自动分章，显示前 10 章标题，用所选技能分析架构。
- 技能筛选：勾选已导入技能，作为榜单归类和本地小说分析的视角。
- 平台 / 分区：番茄、书旗、起点、QQ阅读、纵横、七猫；38 个番茄分区（9 常用 + 29 折叠）+ 自定义平台 + 自定义分区。
- 扫榜：抓前十 → 镜像补正文（仅用于分析）→ LLM 按分区归类架构 → 结果展示 + 缓存恢复。

## 2. 组件 `RankTab(props)`

入参：`t`、`pickDirectory`、`customPlatforms` / `onPlatformsChange`、`customGenres` / `onCustomGenresChange`、
`localNovel` / `onLocalNovelChange`。

### 状态

| 状态 | 作用 |
|---|---|
| `catalog` | `/rank/platforms` 返回的平台与 38 个分区 |
| `selectedPlatforms` / `selectedGenres` | 多选状态（默认番茄 + 传统玄幻） |
| `scanning` / `scanError` / `result` | 扫榜状态与结果 |
| `skills` / `selectedSkills` / `skillOpen` | 技能筛选面板 |
| `customOpen` / `customName` / `customUrl` / `customError` | 自定义平台 |
| `genresExpanded` | 分区是否展开（默认只显示一行） |
| `customGenreOpen` / `customGenreName` / `customGenreUrl` / `customGenreError` | 自定义分区 |
| `mirror` | 是否用镜像补正文（默认开） |
| `localPath` / `localBusy` / `localError` / `localAnalyzing` / `localAnalysis` | 本地小说导入与分析 |

### Effects

1. 挂载：并行 `GET /rank/platforms`、`GET /skills`。
2. `localNovel` 变化：同步路径输入。
3. 挂载：`GET /rank/last` 恢复上次扫榜结果（不调用模型，不耗 Token）。

### 关键函数

| 函数 | Host 接口 | 说明 |
|---|---|---|
| `scan()` | `POST /rank/scan` | 发送 platforms/genres 对象、topN=10、chapters=10、mirror、skills |
| `importLocalNovel(path?)` | `POST /rank/local` | 解析 txt/md/文件夹，返回书名/字数/章节/前 10 标题/简介 |
| `chooseLocalNovel()` | — | 原生目录选择后导入 |
| `analyzeLocal()` | `POST /rank/local/analyze` | 用所选技能分析本地小说 |
| `addCustom()` / `removeCustom(id)` | — | 自定义平台（写 state） |
| `addCustomGenre()` / `removeCustomGenre(id)` | — | 自定义分区（名称 + 番茄链接/ID，写 state） |
| `togglePlatform/toggleGenre/toggleSkill` | — | 多选 |

### 页面结构

1. **我的小说卡片**（顶部）：技能筛选按钮、导入行（路径 / 选择文件夹 / 导入）、本地小说信息、
   前 10 章标题折叠、分析按钮与架构结果。
2. **扫榜卡片**：平台 chips（带榜单外链）、自定义平台、分区 chips（默认一行 + 展开全部 + 自定义分区）、
   镜像开关、开始扫榜、安全提示、错误。
3. **抓取状态卡片**：每个平台×分区的成功/失败、证据类型、备注、warnings。
4. **上榜新书卡片**：按分区分组；每本显示排名、书名、作者、简介、前 10 章标题、正文来源链接（有则显示）。
5. **架构归类卡片**：每个分区的架构组（名称/概述/特征/吸引力/书目）、分区结论、跨分区结论、原始文本兜底。

## 3. Host 侧（rank.js）

### 数据

- `GENRES`：38 个番茄分区，每个带 `maps.fanqie = { gender, id }`，9 个 `featured`。
- `PLATFORMS`：6 个平台，`parser` 为 `fanqie` / `shuqi` / `generic` / `none`。

### 扫榜流程

1. `resolveGenres()` 接受分区 id 或 `{id,label,keywords,maps}` 对象。
2. `scanTarget()`：
   - 番茄：`/rank/<gender>_2_<categoryId>` → `parseFanqieRank()`；
   - 书旗：`ranklist?rank=boyhot` → `parseShuqiRank()`，按关键词过滤；
   - 通用：自定义平台榜单页，`parseGenericRank()`；
   - `none`：直接报“需要浏览器/登录”。
3. 番茄逐本读书页 `fanqieBookMeta()`：干净书名（`<title>`）、作者（meta keywords）、简介
   （`.page-abstract-content`）、前 10 章标题（`.chapter-item-title`，过滤最近更新/感言）。
4. `enrichBooks()` → `enrichBookWithMirror()`：Bing HTML 搜索 → 过滤官方站 → 目录校验（书名/作者、
   最早章号 ≤5）→ 抓前 6 章正文（仅传入 LLM，不进响应/缓存）；命中目录但抓文失败时仍保留来源链接。
5. `analyzeBooks()`：把书单+正文摘要拼成 digest，调用 `ctx.get('llm').stream`（当前默认模型），
   要求严格 JSON：`genres[].groups[]` + `takeaway` + `crossGenre`。
6. 响应前剥离 `chapters` 正文字段，写入 `%DSH_HOME%\novel-assist\rank-last.json`，返回。

### 本地小说

- `readLocalNovel()`：单文件或文件夹（`.txt/.md`，最多 30 个文件）。
- `splitNovelChapters()`：按“第 N 章 / Chapter N”分章。
- `localNovelInfo()`：书名、字数、章节数、前 10 标题、简介。
- `analyzeLocalNovel()`：前 4 章摘要 + 技能视角 → 单本架构 JSON。

### 缓存

- `GET /rank/last` 读取 `rank-last.json`；扫榜成功即覆盖。
- 缓存含 `generatedAt/statuses/books/analysis/model/warnings/counts`，不含正文。

## 4. 样式

`.nvassist-rank-root`（仿宋）、`.nvassist-rank-*`（chips/section/tools/status/genre/book/source）、
`.nvassist-fulltext`、`.nvassist-arch*`、`.nvassist-skillpicker`、`.nvassist-local*`、`.nvassist-analysis-raw`。

## 5. 扩展点

- 新平台：`PLATFORMS` 加条目 + `scanTarget` 加 parser；自定义平台走 `generic`。
- 新分区：番茄分区加进 `FANQIE_EXTRA` 或让用户在界面自定义。
- 换模型：`callModel` / `analyzeBooks` 已读 `agentDefaultModel.currentSelection()`。
- 镜像源：`MIRROR_SKIP_HOSTS`、`enrichBookWithMirror` 的校验和抓取策略。
