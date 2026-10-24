# 安装、重装与迁移

## 1. 当前安装状态（本机）

- 插件源码：`D:\WenJian\GZQ\novel-assist`
- desktop profile：`C:\Users\lx\.dsh\profiles\desktop`
- profile `package.json` 依赖：`"dsh-novel-assist": "link:D:/WenJian/GZQ/novel-assist"`
- profile `dsh.profile.bundles` 已包含 `dsh-novel-assist`
- Host 行：`patchId=novel-assist`、`entryId=include:novel-assist`
- 安装方式：DSH 的 `plugin_manager install_bundle`（以绝对包目录为 target），由它完成 pnpm link 和 bundle 登记。

## 2. 重新安装 / 首次安装

推荐用 DSH 内的 `plugin_manager`：

1. 把插件目录放到任意位置（package.json 中的 name 保持 `dsh-novel-assist`）。
2. `plugin_manager` → `install_bundle`，target 填插件目录绝对路径。
3. 确认返回 `application: applied`、`warnings: []`。
4. 刷新 Web 界面（Ctrl+R）；Host 半若未生效，在插件管理里关开一次。

手工方式（仅供参考，desktop profile 的 package.json 会被 DSH 管理）：

```json
{
  "dependencies": { "dsh-novel-assist": "link:D:/path/to/novel-assist" },
  "dsh": { "profile": { "bundles": [ "...", "dsh-novel-assist" ] } }
}
```

然后用 DSH 自带 node/pnpm 在 profile 目录执行 `pnpm install --prefer-offline`。
不要手写 `cordis.patch.yml`：bundle 的 `cordis.patch.yml` 会插入 Host 行。

## 3. 生效方式

| 改动 | 生效方式 |
|---|---|
| `index.js` / `rank.js`（Host 半） | 插件管理里关开一次，或重启 DSH |
| `client.js`（Client 半） | 刷新 Web 页面（Ctrl+R）；不做热更新 |
| `src/client/*.js` | 先 `node src/build-client.mjs` 生成 `client.js`，再刷新 |
| `locale/*.json`、`icon.svg` | 刷新插件管理页/页面 |

构建 Client：

```powershell
$node = 'C:\Users\lx\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
& $node 'D:\WenJian\GZQ\novel-assist\src\build-client.mjs'
& 'D:\WenJian\DeepSeek\DeepSeek Harness.exe' --check 'D:\WenJian\GZQ\novel-assist\client.js'  # 需先 $env:ELECTRON_RUN_AS_NODE=1
```

## 4. 迁移到另一台机器

1. 复制整个 `novel-assist` 目录（含 `client.js`、`index.js`、`rank.js`、`locale`、`icon.svg`）。
2. 把 `package.json` 的 `link:` 依赖指向新路径（或用 plugin_manager 重新安装）。
3. 状态与技能不随插件走：
   - 状态：`%DSH_HOME%\novel-assist\state.json`
   - 扫榜缓存：`%DSH_HOME%\novel-assist\rank-last.json`
   - 技能：`%DSH_HOME%\skills\`
4. 扫描功能依赖本机网络（Bing/镜像/平台），换网络可能表现不同。

## 5. 卸载

- 用 `plugin_manager` 移除 bundle（或关闭插件行）。
- 需要彻底清理时再删除 `%DSH_HOME%\novel-assist` 与导入的技能目录；插件本身不写注册表。
