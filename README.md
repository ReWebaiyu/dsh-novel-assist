# DSH 小说辅助模拟插件（dsh-novel-assist 0.6.0）
## 目录

```
D:\DSH\
├─ README.md                  ← 本文件
├─ profile-snippets.json      ← 当前 desktop profile 的依赖/bundle 登记与数据路径
├─ data-backup\               ← 运行数据副本（state.json、rank-last.json）
├─ dsh-novel-assist-0.6.0.zip ← 插件打包（可直接分发）
└─ dsh-novel-assist\          ← 插件完整工程
   ├─ client.js               ← 浏览器加载的最终 Client 产物（由 src 构建）
   ├─ index.js                ← Host：状态、作品目录、技能库
   ├─ rank.js                 ← Host：平台扫榜、镜像、LLM 分析、缓存
   ├─ cordis.patch.yml        ← 插入 Host 行
   ├─ package.json            ← dsh.bundle + dsh.client 清单
   ├─ locale/zh.json, en.json ← 插件管理显示名/说明
   ├─ icon.svg                ← 插件图标
   ├─ README.md               ← 使用说明
   ├─ docs\                   ← 三个页签的详细代码地图 + API + 安装
   │  ├─ README.md
   │  ├─ panel-work.md        ← 自己作品 + 面板外壳
   │  ├─ panel-skills.md      ← 技能兼容
   │  ├─ panel-rank.md        ← 平台扫榜 + rank.js
   │  ├─ api.md               ← 全部 HTTP 接口与数据结构
   │  └─ install.md           ← 安装、重装、迁移
   └─ src\
      ├─ build-client.mjs     ← 拼接构建脚本
      └─ client\
         ├─ 00-boot.js        ← 公共层：加载器/文案/工具/基础控件
         ├─ 10-skills.js      ← 板块二：技能兼容 SkillsStudio
         ├─ 20-rank.js        ← 板块三：平台扫榜 RankTab
         └─ 30-work.js        ← 板块一：自己作品 + 面板外壳 NovelPanel
```

## 三个界面板块

| 板块 | 源码 | 功能 |
|---|---|---|
| 自己作品 | `src/client/30-work.js` | 绑定本地作品文件夹、目录扫描、创作参数编辑与自动保存 |
| 技能兼容 | `src/client/10-skills.js` | 本地技能库、文件夹/md/zip/GitHub 导入、技能市场、移除 |
| 平台扫榜 | `src/client/20-rank.js` + `rank.js` | 38 个番茄分区、自定义平台/分区、扫榜前十、镜像正文、架构归类、结果缓存 |

详细代码地图见 `dsh-novel-assist\docs\`。

## 安装 / 恢复

1. 用 DSH 的 `plugin_manager` → `install_bundle`，target 指向
   `D:\DSH\dsh-novel-assist`（或解压 zip 后的目录）。
2. 确认 `application: applied`，刷新 Web 界面（Ctrl+R）。
3. Host 半改动后在插件管理里关开一次插件。
4. 运行数据不随插件走，需要时把 `data-backup\state.json`、`rank-last.json`
   复制回 `C:\Users\lx\.dsh\novel-assist\`。

## 构建 Client

```powershell
$node = 'C:\Users\lx\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
& $node 'D:\DSH\dsh-novel-assist\src\build-client.mjs'
```

改动请改 `src/client/*.js`，再重新构建 `client.js`；直接改 `client.js` 会在下次构建时被覆盖。
