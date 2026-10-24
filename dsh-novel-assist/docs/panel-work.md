# 板块一：自己作品（面板外壳 + 作品页）

源码：`src/client/30-work.js`

## 1. 职责

- 侧边栏面板根节点（`nvassist-root`）、顶部标题、三页签切换、返回对话。
- 「自己作品」页：作品文件夹绑定、目录扫描、创作参数编辑、自动保存。
- 全局样式 `STYLES`、locale 注册、`sidebar.panellist` + `main` 槽位注册。

## 2. 组件 `NovelPanel(props)`

入参（由 `00-boot.js` 的 `Page` 注入）：

| 字段 | 说明 |
|---|---|
| `t` | locale 翻译函数（命名空间 `novel-assist`） |
| `pickDirectory` | 宿主原生目录选择器 `ctx.uiWorkspace.pickDirectory()` |
| `goConversation` | `ctx.layout.selectPanel('conversation')` |

### 状态

| 状态 | 作用 |
|---|---|
| `tab` | `work` / `skills` / `rank` |
| `state` | 整个持久化状态：`{ folder, params, platforms, customGenres, localNovel, updatedAt }` |
| `loaded` | 首次 `/state` 是否完成 |
| `serviceError` | Host 连接错误（顶部红条） |
| `saveState` / `savedAt` | `idle`/`saving`/`saved`/`error` 与保存时间 |
| `scan` / `scanning` / `scanError` | 当前作品文件夹扫描结果 |
| `storagePath` | Host 返回的 state 文件路径 |

### Effects

1. **挂载加载**：`request('/state')` → `mergeState()` → 若已有 folder 自动 `runScan()`。
2. **自动保存**：`state` 变化后 600ms 防抖 `POST /state`；`skipNextSave` 跳过加载后的首次回写。

### 交互函数

| 函数 | 说明 |
|---|---|
| `runScan(path)` | `POST /scan`，返回文件夹数/文件数/疑似章节/正文字数 |
| `browse()` | 原生目录选择 → 写 folder → 扫描 |
| `setFolder(value)` / `setParam(key, value)` | 局部更新 state |
| `clearFolder()` | 解绑并清空扫描 |
| `setPlatforms` / `setCustomGenres` / `setLocalNovel` | 传给扫榜页的持久化写入器 |

### 页面结构（workContent）

1. 快览 chip：书名 / 题材 / 视角 / 目标字数。
2. 作品文件夹卡片：状态点、路径、修改、选择、扫描、统计、错误。
3. 作品信息：书名、题材、视角（select）、基调（select）、目标字数、单章字数、更新节奏。
4. 创作设定：一句话梗概、主线冲突、世界观关键词、主要角色、禁忌雷点（多行）。
5. 模拟参数：耐心、爽点、节奏（1–5 滑杆）。
6. 底部：state 文件路径。

## 3. Host 数据

`/novel-assist/api/state`、`/scan`，详见 [api.md](./api.md)。
字段定义在 `index.js` 的 `sanitizeState()`：`folder`、`params`、`platforms`、`customGenres`、`localNovel`。

## 4. 样式

`STYLES` 中与本品相关的前缀：

- `.nvassist-root/head/tabs/tab/scroll`
- `.nvassist-quick/chip/card/card-head/card-title`
- `.nvassist-folder-*`、`.nvassist-path*`、`.nvassist-stats/stat`
- `.nvassist-grid/field/control/range/scale`
- `.nvassist-btn[.primary|.ghost|.small]`、`.nvassist-link[.danger]`

## 5. 扩展点

- 新参数：在 `DEFAULT_PARAMS` 加键 → `mergeState` 的 `TEXT_KEYS`/`RANGE_KEYS` 同步 → Host `sanitizeState` 同步 → 页面加字段。
- 新页签：在 `TABS` 加键、`NovelPanel` 加 `TabButton`、`nvassist-scroll` 的三元里加分支。
- 新 Host 接口：`index.js` 的 `handle()` 里加 action，前端用 `request()` 调。
