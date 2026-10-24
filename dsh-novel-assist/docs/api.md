# Host 接口与数据文件

所有接口以 `/novel-assist/api` 为前缀，挂在 DSH Web 服务上，返回 JSON。
自定义路由不经过 GUI 登录鉴权，只监听本机回环地址；不要在公网暴露。

统一返回：成功 `{ ok: true, ... }`；失败由 `index.js` 捕获为 HTTP 500 `{ ok: false, error }`。
前端用 `request(action, init, timeoutMs)` 调用，非 2xx 或 `ok !== true` 会抛错。

## 状态与作品目录

| 方法 | 路径 | Body | 返回 |
|---|---|---|---|
| GET | `/state` | — | `{ state, storagePath }` |
| POST | `/state` | `{ state }` | `{ savedAt, state }` |
| POST | `/scan` | `{ path }` | `{ scan }` |

`state` 结构（`index.js::sanitizeState`）：

```json
{
  "version": 1,
  "folder": "D:\\WenJian\\XS",
  "params": {
    "title": "", "genre": "", "pov": "third-limited", "tone": "hot",
    "words": "", "chapterWords": "", "cadence": "",
    "pitch": "", "conflict": "", "world": "", "characters": "", "taboo": "",
    "patience": 3, "pleasure": 3, "pacing": 3
  },
  "platforms": [{ "id": "custom-x", "name": "某站", "home": "https://…", "rankUrl": "https://…", "parser": "generic" }],
  "customGenres": [{ "id": "custom-g-x", "label": "自定义分区", "gender": 1, "fanqieId": 258 }],
  "localNovel": { "name": "长夜行", "path": "D:\\…\\长夜行.txt", "files": 1, "words": 1218, "chapterCount": 12, "chapterTitles": ["第1章 …"], "synopsis": "…", "importedAt": 0 },
  "updatedAt": 0
}
```

`scan` 结构：`{ path, exists, isDirectory, folders, files, chapters, words, bytes, truncated, entries, scannedAt, missing? }`。

## 技能

| 方法 | 路径 | Body / Query | 返回 |
|---|---|---|---|
| GET | `/skills` | — | `{ roots, skills }` |
| POST | `/skills/import` | `{ kind: 'folder'\|'file'\|'url', path?, url? }` | `{ installed }` 或 `{ needsChoice, skills }` |
| POST | `/skills/repo` | `{ repo, path?, branch? }` | 同上 |
| POST | `/skills/remove` | `{ dir }` | `{ removed }` |
| GET | `/skills/market` | `?q=&refresh=1` | `{ curated, items, query, total, cached }` |

`skills[]`：`{ name, description, root: 'user'|'project', dir, file, files, bytes, updatedAt, novel, valid }`。

## 扫榜

| 方法 | 路径 | Body / Query | 返回 |
|---|---|---|---|
| GET | `/rank/platforms` | — | `{ genres, platforms, notes }` |
| POST | `/rank/scan` | `{ platforms, genres, topN, chapters, mirror, skills }` | 见下 |
| GET | `/rank/last` | — | `{ result }`（最近一次扫榜缓存，可能为 null） |
| POST | `/rank/local` | `{ path }` | `{ novel }` |
| POST | `/rank/local/analyze` | `{ path, skills }` | `{ info, analysis, text, model }` |
| GET | `/rank/mirror` | `?title=&author=` | 镜像候选诊断（Bing 结果、目录校验、章号） |
| GET | `/rank/search` | `?q=` | 调试用 `ctx.web.search`（当前无 key 时会报错） |

`genres` 元素可以是分区 id 字符串，或：

```json
{ "id": "custom-g-1", "label": "女频悬疑", "keywords": ["女频悬疑"], "maps": { "fanqie": { "gender": 0, "id": 747 } } }
```

`platforms` 元素：`{ id, name, parser: 'fanqie'|'shuqi'|'generic'|'none', home, rankUrl, genreMap }`。

扫榜返回：

```json
{
  "generatedAt": 0,
  "statuses": [{ "platformId": "fanqie", "platform": "番茄小说", "genre": "传统玄幻", "ok": true, "count": 10, "evidence": "榜单 + 简介 + 镜像正文", "note": "…" }],
  "books": [{
    "rank": 1, "title": "神通者", "author": "天蚕土豆", "category": "",
    "words": 453680, "reads": 0, "abstract": "…", "url": "https://fanqienovel.com/page/…",
    "bookId": "…", "chapterTitles": ["第1章 …"], "chapterSource": "www.wodushu.com", "chapterUrl": "https://…",
    "platform": "番茄小说", "platformId": "fanqie", "genre": "传统玄幻"
  }],
  "analysis": { "genres": [{ "genre": "传统玄幻", "groups": [{ "name": "…", "summary": "…", "traits": [], "why": "…", "books": [] }], "takeaway": "…" }], "crossGenre": "…" },
  "analysisText": "",
  "model": "deepseek-account/deepseek-flash",
  "warnings": [],
  "counts": { "platforms": 1, "genres": 1, "books": 10 }
}
```

- `books[].chapters`（正文）不会出现在响应或缓存里，只用于本次 LLM 分析。
- `chapterUrl` 存在时前端显示「正文来源」链接；没有则不显示。
- `analysisText` 只在模型没返回可解析 JSON 时作为兜底原文。

## 数据文件

| 路径 | 内容 |
|---|---|
| `%DSH_HOME%\novel-assist\state.json` | 状态（见上） |
| `%DSH_HOME%\novel-assist\rank-last.json` | 最近一次扫榜结果（不含正文） |
| `%DSH_HOME%\skills\<name>\SKILL.md` | 导入的技能 |

## 存储与清理

- `rank-last.json` 每次扫榜覆盖；删除该文件等于清空“上次结果”。
- 状态文件由 Host 原子写（临时文件 + rename）。
- 技能移除只允许删除 `%DSH_HOME%\skills` 下、含 `SKILL.md` 的目录。
