# 代码目录（三个界面板块）

`src/client/` 是可读源码，按三个页签拆分；`client.js` 由 `src/build-client.mjs` 拼接生成，
浏览器只加载这一个文件。**改代码请改 `src/client/`，再运行构建**，不要直接改 `client.js`。

| 文件 | 板块 | 内容 |
|---|---|---|
| `src/client/00-boot.js` | 公共层 | 模块加载器外壳、zh/en 文案、状态合并、请求、格式化、图标、基础控件 |
| `src/client/10-skills.js` | 技能兼容 | `SkillsStudio`：本地技能库、导入、市场、移除 |
| `src/client/20-rank.js` | 平台扫榜 | `RankTab`：我的小说、平台/分区筛选、扫榜与结果展示 |
| `src/client/30-work.js` | 自己作品 | `NovelPanel`（面板外壳 + 自己作品页）、样式、`apply` 注册 |
| `src/build-client.mjs` | 构建 | 按顺序拼接四个源码块 → `client.js` |

```powershell
$node = 'C:\Users\lx\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
& $node 'D:\WenJian\GZQ\novel-assist\src\build-client.mjs'
```

拆分是“同作用域拼接”：四个文件共享 `factory(require)` 内的变量，所以源码块之间不需要
import/export；拼接后的代码与拆分前逐字符一致（只多了分块注释）。

详细说明：

- [panel-work.md](./panel-work.md) — 自己作品页 + 面板外壳
- [panel-skills.md](./panel-skills.md) — 技能兼容页
- [panel-rank.md](./panel-rank.md) — 平台扫榜页
- [api.md](./api.md) — Host 接口与数据文件
- [install.md](./install.md) — 安装、重装、迁移
