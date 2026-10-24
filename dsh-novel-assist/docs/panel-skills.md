# 板块二：技能兼容

源码：`src/client/10-skills.js`；Host 逻辑在 `index.js` 的 `handleSkills()` 与技能辅助函数。

## 1. 职责

- 扫描 `%DSH_HOME%\skills` 下的本地技能（`SKILL.md`），展示名称、描述、文件数、更新时间、来源。
- 导入：文件夹、本地 `.md` / `.zip`、GitHub 仓库 / tree / blob / raw 链接。
- 规范化：补 `description`、修正非 kebab-case 的 `name`、重名落 `<name>-2` 并改写 frontmatter。
- GitHub 技能市场：9 个精选仓库 + 实时搜索，支持多技能仓库选择子技能。
- 移除用户技能库中的技能（两段式确认）。

## 2. 组件 `SkillsStudio(props)`

入参：`t`（翻译）、`pickDirectory`（宿主目录选择器）。

### 状态

| 状态 | 作用 |
|---|---|
| `skills` / `roots` | `/skills` 返回的技能列表与技能根目录 |
| `loading` / `loadError` | 本地库加载状态 |
| `notice` | 操作结果条 `{ kind, text, extra }` |
| `busy` | 正在执行的按钮 key（`folder` / `path` / `url` / `repo` / `repo#path` / `remove#dir`） |
| `localPath` / `url` | 本地路径、GitHub 链接输入框 |
| `market` | `{ curated, items, query }` |
| `marketLoading` / `marketError` | 市场请求状态 |
| `query` | 搜索词 |
| `choices` | 多技能选择结果 `{ 'repo:owner/name': [...] }` 或 `{ local: [...] }` |
| `confirmDir` | 两段式移除确认的目标目录 |

### Effects

- 挂载时并行请求 `GET /skills`、`GET /skills/market`（后者不带 q，只返回精选）。

### 关键函数

| 函数 | Host 接口 | 说明 |
|---|---|---|
| `refreshSkills()` | `GET /skills` | 刷新本地技能库 |
| `loadMarket(q)` | `GET /skills/market?q=` | 精选或搜索；10 分钟缓存 |
| `handleResult(data, key)` | — | 统一处理 `needsChoice` 与 `installed` |
| `importFolder()` | `POST /skills/import` `{kind:'folder',path}` | 原生选择器选目录 |
| `importLocalPath()` | `POST /skills/import` `{kind:'file',path}` | `.md` 或 `.zip` |
| `importFromUrl()` | `POST /skills/import` `{kind:'url',url}` | GitHub 仓库/tree/blob/raw/zip |
| `installRepo(repo, path)` | `POST /skills/repo` `{repo,path?}` | 市场安装；多技能返回选择列表 |
| `chooseLocal(path)` | `POST /skills/import` `{kind:'folder',path}` | 本地多技能选择后安装 |
| `removeSkill(dir)` | `POST /skills/remove` `{dir}` | 只允许用户库内、含 `SKILL.md` 的目录 |

### 页面结构

1. **本地技能库卡片**：数量 + 刷新、安装位置、选择文件夹、本地路径、GitHub 链接、结果条、多技能选择、
   技能列表（名称、小说相关/命名待修正/来源徽章、描述、文件数/体积/日期、移除按钮）、安全提示。
2. **GitHub 技能市场卡片**：搜索框、快捷词（网文/去AI味/长篇小说/拆书/短篇）、精选/搜索结果卡片、
   安装按钮、仓库外链、多技能选择。

## 3. Host 侧（index.js）

- `listSkills(ctx)`：扫描用户技能库 + 项目技能库（`<workingDirectory>/.dsh/skills`，存在才显示）。
- `parseFrontmatter` / `normalizeSkillText` / `buildFrontmatter`：frontmatter 解析与规范化。
- `installDirectory` / `installSingleFile` / `installFromRepo`：三种安装路径，统一经过 `uniqueSkillDir` 与重名改写。
- `extractZip`：PowerShell `Expand-Archive` 解压本地/远程 zip。
- `searchMarket`：GitHub Search API，内存缓存 10 分钟；限流返回 `rate-limited`。
- `loadSkillDirectory` / `directoryStats`：列表统计。

## 4. 样式

`.nvassist-import*`、`.nvassist-notice.*`、`.nvassist-empty`、`.nvassist-skill*`、`.nvassist-badge.*`、
`.nvassist-market*`、`.nvassist-choices/.choice`、`.nvassist-skillpicker/.skillpick`（技能筛选在扫榜页复用）。

## 5. 扩展点

- 新增技能来源（例如 GitLab）：在 `handleSkills` 加 action，`parseRepoInput` 扩展 host。
- 技能启用/停用：需要 DSH 侧按 frontmatter name 过滤，目前未做。
