/* ============================================================================
 * 【公共层】加载器、三页签本地化字典、共享工具与基础控件
 * ----------------------------------------------------------------------------
 * 1. window.__ModuleLoader__.load 外壳与 factory(require)
 * 2. 面板/页签文案（zh / en）
 * 3. 共享常量、状态合并、请求、格式化、图标
 * 4. TextField / SelectField / RangeField / Section / QuickChip / Stat / TabButton
 *
 * 三个业务页签分别在：
 *   10-skills.js  技能兼容（SkillsStudio）
 *   20-rank.js    平台扫榜（RankTab）
 *   30-work.js    自己作品 + 面板外壳（NovelPanel）+ 样式 + apply
 * 本文件不包含业务页签的 UI。
 * ========================================================================== */

/**
 * Client half of the Novel Assist bundle.
 *
 * Two tabs in one sidebar panel:
 *   - 自己作品: bind a local manuscript folder and keep creation parameters in view.
 *   - 技能兼容: import Agent Skills from disk or GitHub and browse a skill market.
 */
window.__ModuleLoader__.load({
  id: 'dsh-novel-assist',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useRef, useState } = React

    const PANEL_ID = 'novel-assist'
    const NS = 'novel-assist'
    const API_BASE = '/novel-assist/api'
    const TABS = { work: 'work', skills: 'skills', rank: 'rank' }

    const zh = {
      'nav.label': '小说辅助模拟',
      'panel.eyebrow': 'NOVEL SIMULATION',
      'panel.title': '小说辅助模拟',
      'panel.subtitle': '作品参数台 · 本地稿件与写作技能',
      'panel.back': '返回对话',
      'tab.work': '自己作品',
      'tab.skills': '技能兼容',
      'tab.rank': '平台扫榜',
      'quick.untitled': '未命名作品',
      'quick.none': '未设置',
      'save.idle': '自动保存',
      'save.saving': '保存中…',
      'save.saved': '已保存',
      'save.error': '保存失败',
      'service.error': '无法连接本地服务，请确认插件已启用。',
      'folder.title': '作品文件夹',
      'folder.bound': '已绑定',
      'folder.unbound': '未绑定',
      'folder.empty': '尚未绑定作品文件夹',
      'folder.hint': '绑定后插件会记住该目录，用于精确定位稿件、设定与大纲；参数保存在本机。',
      'folder.placeholder': 'D:\\我的小说\\作品名',
      'folder.browse': '选择文件夹…',
      'folder.scan': '扫描',
      'folder.scanning': '扫描中…',
      'folder.clear': '解除绑定',
      'folder.missing': '路径不存在或无法访问。',
      'folder.notFolder': '该路径不是文件夹。',
      'folder.pickerUnavailable': '当前环境无法打开文件夹选择器，请直接输入路径。',
      'folder.updated': '扫描于',
      'folder.truncated': '目录较大，统计已截断。',
      'stats.folders': '子文件夹',
      'stats.files': '文件',
      'stats.chapters': '疑似章节',
      'stats.words': '正文字数',
      'section.basic': '作品信息',
      'section.basicHint': '标题、题材与目标体量',
      'section.setup': '创作设定',
      'section.setupHint': '给模拟用的事实与约束',
      'section.sim': '模拟参数',
      'section.simHint': '影响场景推演的三个旋钮',
      'field.title': '作品名',
      'field.genre': '题材类型',
      'field.pov': '叙事视角',
      'field.tone': '文风基调',
      'field.words': '目标总字数',
      'field.chapterWords': '单章字数',
      'field.cadence': '更新节奏',
      'field.pitch': '一句话梗概',
      'field.conflict': '主线冲突',
      'field.world': '世界观关键词',
      'field.characters': '主要角色',
      'field.taboo': '禁忌与雷点',
      'field.title.ph': '例：长夜将至',
      'field.genre.ph': '例：仙侠 / 都市 / 悬疑',
      'field.words.ph': '例：1200000',
      'field.chapterWords.ph': '例：3000',
      'field.cadence.ph': '例：日更 4000 字',
      'field.pitch.ph': '用一句话说清主角、目标与阻碍。',
      'field.conflict.ph': '核心矛盾、对手与不可退让的代价。',
      'field.world.ph': '例：灵气复苏、宗门体系、境界九重',
      'field.characters.ph': '主角 / 对手 / 关键配角，各一行关系。',
      'field.taboo.ph': '不能写的内容、感情线边界、设定硬伤。',
      'opt.pov.first': '第一人称',
      'opt.pov.thirdLimited': '第三人称有限',
      'opt.pov.thirdOmniscient': '第三人称全知',
      'opt.pov.multi': '多视角',
      'opt.tone.hot': '热血',
      'opt.tone.calm': '沉稳',
      'opt.tone.light': '轻松',
      'opt.tone.dark': '暗黑',
      'opt.tone.delicate': '细腻',
      'sim.patience': '读者耐心阈值',
      'sim.pleasure': '爽点密度',
      'sim.pacing': '推进速率',
      'sim.low': '保守',
      'sim.high': '激进',
      'foot.storage': '数据保存在本机 · .dsh/novel-assist/state.json',
      'skills.localTitle': '本地技能库',
      'skills.foundUnit': '个技能',
      'skills.refresh': '刷新',
      'skills.importFolder': '选择技能文件夹…',
      'skills.folderHint': '文件夹内需含 SKILL.md',
      'skills.pathPlaceholder': '本地 SKILL.md 或 .zip 路径',
      'skills.importBtn': '导入',
      'skills.importing': '导入中…',
      'skills.urlPlaceholder': 'GitHub 仓库或 SKILL.md 链接',
      'skills.urlBtn': '从链接导入',
      'skills.empty': '还没有导入技能',
      'skills.emptyHint': '网上下载的技能通常是一个含 SKILL.md 的文件夹或压缩包，也可以直接粘贴 GitHub 仓库地址。',
      'skills.userRoot': '用户技能库',
      'skills.projectRoot': '项目技能库',
      'skills.novel': '小说相关',
      'skills.invalid': '命名待修正',
      'skills.filesUnit': '个文件',
      'skills.updatedPrefix': '更新于',
      'skills.noDescription': '无描述',
      'skills.warning': '技能内容会作为 Agent 指令参与运行，请只导入可信来源。',
      'skills.rootNote': '安装位置',
      'skills.marketTitle': 'GitHub 技能市场',
      'skills.marketHint': '精选与实时搜索，安装时写入用户技能库。',
      'skills.searchPlaceholder': '搜索：拆书 / 去AI味 / 长篇小说…',
      'skills.search': '搜索',
      'skills.curated': '精选',
      'skills.archived': '已归档',
      'skills.install': '安装',
      'skills.installing': '安装中…',
      'skills.repoLink': '仓库',
      'skills.chooseSkill': '该仓库包含多个技能，选择要导入的：',
      'skills.installed': '已导入',
      'skills.ready': '已生效，Agent 下一条消息即可调用。',
      'skills.importFailed': '导入失败',
      'skills.loadFailed': '无法读取本地技能库',
      'skills.searchFailed': 'GitHub 搜索失败',
      'skills.noResults': '没有搜到相关仓库',
      'skills.pathRequired': '请先填写本地路径',
      'skills.remove': '移除',
      'skills.confirmRemove': '确认移除',
      'skills.removed': '已移除',
      'skills.removeFailed': '移除失败',
      'rank.title': '平台扫榜',
      'rank.hint': '选择平台与分区，抓取新书榜前列，按故事架构归类并总结哪种写法更吸引该分区读者。',
      'rank.platforms': '平台',
      'rank.genres': '分区（可多选）',
      'rank.chapters': '章节目录',
      'rank.scan': '开始扫榜',
      'rank.scanning': '扫描中…（约 1–3 分钟）',
      'rank.skillPicker': '筛选技能',
      'rank.skillHint': '选中的技能只作为分析视角参与归类，不执行其中的代码。',
      'rank.skillEmpty': '还没有导入技能，去「技能兼容」页导入。',
      'rank.custom': '添加自定义平台',
      'rank.customName': '平台名称',
      'rank.customUrl': '榜单页链接',
      'rank.add': '添加',
      'rank.invalidUrl': '请填写 http(s) 开头的榜单链接',
      'rank.open': '打开榜单',
      'rank.remove': '移除平台',
      'rank.status': '抓取状态',
      'rank.books': '上榜新书',
      'rank.noBooks': '没有抓到书单',
      'rank.analysis': '架构归类',
      'rank.takeaway': '分区结论',
      'rank.crossGenre': '跨分区结论',
      'rank.appeal': '吸引力',
      'rank.evidence': '证据',
      'rank.words': '字',
      'rank.reads': '在读',
      'rank.chaptersShort': '章',
      'rank.noAnalysis': '暂无架构分析',
      'rank.analysisBy': '分析模型',
      'rank.scanFailed': '扫描失败',
      'rank.noPlatform': '请至少选择一个平台',
      'rank.noGenre': '请至少选择一个分区',
      'rank.warning': '只抓取公开榜单、简介、章节目录与镜像站公开章节用于结构分析，不保存原文；请遵守来源站点条款，平台反爬或限流时会明确标注。',
      'rank.selected': '已选',
      'rank.mirror': '镜像补全正文',
      'rank.mirrorHint': '通过 Bing 检索镜像站抓取公开章节，仅用于本次结构分析，不保存原文。',
      'rank.fullText': '正文样本',
      'rank.customGenre': '自定义分区',
      'rank.genreName': '分区名称',
      'rank.genreUrl': '番茄分区链接或 ID',
      'rank.genreNameRequired': '请填写分区名称',
      'rank.genreUrlInvalid': '请填番茄分区链接（含 /rank/1_2_258）或数字 ID',
      'rank.expand': '展开全部分区',
      'rank.collapse': '收起分区',
      'rank.removeGenre': '移除分区',
      'rank.myNovel': '我的小说',
      'rank.novelHint': '导入自己下载好的 .txt / .md 或文件夹，用所选技能分析它的开篇架构。',
      'rank.novelPath': '小说文件或文件夹路径',
      'rank.chooseFolder': '选择文件夹…',
      'rank.importNovel': '导入小说',
      'rank.importingNovel': '导入中…',
      'rank.localEmpty': '还没有导入本地小说',
      'rank.localPathRequired': '请填写小说文件或文件夹路径',
      'rank.localFailed': '导入失败',
      'rank.analyzeLocal': '用所选技能分析',
      'rank.analyzing': '分析中…',
      'rank.localAnalysis': '本地小说架构',
      'rank.targetReaders': '目标读者',
      'rank.openingHook': '开篇钩子',
      'rank.pacing': '节奏',
      'rank.genre': '题材',
      'rank.chapterTitlesLabel': '前 10 章标题',
      'rank.downloadSource': '正文来源',
      'rank.downloadSourceHint': '点击跳转到可获取正文的镜像站',
      'rank.localWords': '字',
      'rank.localChapters': '章',
      'skills.chip.webnovel': '网文',
      'skills.chip.deslop': '去AI味',
      'skills.chip.long': '长篇小说',
      'skills.chip.scan': '拆书',
      'skills.chip.short': '短篇',
    }

    const en = {
      'nav.label': 'Novel Assist',
      'panel.eyebrow': 'NOVEL SIMULATION',
      'panel.title': 'Novel Assist',
      'panel.subtitle': 'Creation console · manuscript and writing skills',
      'panel.back': 'Back to chat',
      'tab.work': 'My work',
      'tab.skills': 'Skills',
      'tab.rank': 'Rankings',
      'quick.untitled': 'Untitled work',
      'quick.none': 'Not set',
      'save.idle': 'Autosave',
      'save.saving': 'Saving…',
      'save.saved': 'Saved',
      'save.error': 'Save failed',
      'service.error': 'Cannot reach the local service. Make sure the plugin is enabled.',
      'folder.title': 'Manuscript folder',
      'folder.bound': 'Bound',
      'folder.unbound': 'Not bound',
      'folder.empty': 'No manuscript folder bound yet',
      'folder.hint': 'Once bound, the plugin remembers this folder to locate drafts, settings and outlines. Parameters stay on this machine.',
      'folder.placeholder': 'D:\\Novels\\My Book',
      'folder.browse': 'Choose folder…',
      'folder.scan': 'Scan',
      'folder.scanning': 'Scanning…',
      'folder.clear': 'Unbind',
      'folder.missing': 'The path does not exist or cannot be read.',
      'folder.notFolder': 'The path is not a folder.',
      'folder.pickerUnavailable': 'No folder picker in this environment; type the path instead.',
      'folder.updated': 'Scanned',
      'folder.truncated': 'The folder is large; statistics were truncated.',
      'stats.folders': 'Folders',
      'stats.files': 'Files',
      'stats.chapters': 'Chapters',
      'stats.words': 'Characters',
      'section.basic': 'Work',
      'section.basicHint': 'Title, genre and target size',
      'section.setup': 'Creative brief',
      'section.setupHint': 'Facts and limits used by the simulation',
      'section.sim': 'Simulation',
      'section.simHint': 'Three dials for scene simulation',
      'field.title': 'Title',
      'field.genre': 'Genre',
      'field.pov': 'Point of view',
      'field.tone': 'Tone',
      'field.words': 'Target length',
      'field.chapterWords': 'Words per chapter',
      'field.cadence': 'Update rhythm',
      'field.pitch': 'One-line pitch',
      'field.conflict': 'Main conflict',
      'field.world': 'World keywords',
      'field.characters': 'Main characters',
      'field.taboo': 'Taboos',
      'field.title.ph': 'e.g. The Long Night',
      'field.genre.ph': 'e.g. xianxia / urban / mystery',
      'field.words.ph': 'e.g. 1200000',
      'field.chapterWords.ph': 'e.g. 3000',
      'field.cadence.ph': 'e.g. daily, 4000 words',
      'field.pitch.ph': 'One sentence: protagonist, goal, obstacle.',
      'field.conflict.ph': 'Core conflict, opponent, and the price that cannot be paid.',
      'field.world.ph': 'e.g. qi revival, sect system, nine realms',
      'field.characters.ph': 'Protagonist / rival / key allies, one line each.',
      'field.taboo.ph': 'Off-limits content, romance boundaries, hard canon limits.',
      'opt.pov.first': 'First person',
      'opt.pov.thirdLimited': 'Third limited',
      'opt.pov.thirdOmniscient': 'Third omniscient',
      'opt.pov.multi': 'Multi-POV',
      'opt.tone.hot': 'Passionate',
      'opt.tone.calm': 'Composed',
      'opt.tone.light': 'Light',
      'opt.tone.dark': 'Dark',
      'opt.tone.delicate': 'Delicate',
      'sim.patience': 'Reader patience',
      'sim.pleasure': 'Payoff density',
      'sim.pacing': 'Pacing speed',
      'sim.low': 'Conservative',
      'sim.high': 'Aggressive',
      'foot.storage': 'Stored on this machine · .dsh/novel-assist/state.json',
      'skills.localTitle': 'Local skill library',
      'skills.foundUnit': 'skills',
      'skills.refresh': 'Refresh',
      'skills.importFolder': 'Choose skill folder…',
      'skills.folderHint': 'The folder must contain SKILL.md',
      'skills.pathPlaceholder': 'Local SKILL.md or .zip path',
      'skills.importBtn': 'Import',
      'skills.importing': 'Importing…',
      'skills.urlPlaceholder': 'GitHub repo or SKILL.md link',
      'skills.urlBtn': 'Import from link',
      'skills.empty': 'No skills imported yet',
      'skills.emptyHint': 'A downloaded skill is usually a folder or zip containing SKILL.md. You can also paste a GitHub repo URL.',
      'skills.userRoot': 'User library',
      'skills.projectRoot': 'Project library',
      'skills.novel': 'Novel',
      'skills.invalid': 'Name needs fixing',
      'skills.filesUnit': 'files',
      'skills.updatedPrefix': 'Updated',
      'skills.noDescription': 'No description',
      'skills.warning': 'Skill content runs as agent instructions. Import only sources you trust.',
      'skills.rootNote': 'Install location',
      'skills.marketTitle': 'GitHub skill market',
      'skills.marketHint': 'Curated picks plus live search. Installs go to the user skill library.',
      'skills.searchPlaceholder': 'Search: plotting, de-AI, long-form…',
      'skills.search': 'Search',
      'skills.curated': 'Curated',
      'skills.archived': 'Archived',
      'skills.install': 'Install',
      'skills.installing': 'Installing…',
      'skills.repoLink': 'Repo',
      'skills.chooseSkill': 'This repository has multiple skills. Choose one:',
      'skills.installed': 'Installed',
      'skills.ready': 'Ready now — the next agent message can use it.',
      'skills.importFailed': 'Import failed',
      'skills.loadFailed': 'Cannot read the local skill library',
      'skills.searchFailed': 'GitHub search failed',
      'skills.noResults': 'No repositories found',
      'skills.pathRequired': 'Enter a local path first',
      'skills.remove': 'Remove',
      'skills.confirmRemove': 'Confirm remove',
      'skills.removed': 'Removed',
      'skills.removeFailed': 'Remove failed',
      'rank.title': 'Platform scan',
      'rank.hint': 'Pick platforms and categories; the panel reads each new-book ranking, groups story architectures and explains what pulls readers in that category.',
      'rank.platforms': 'Platforms',
      'rank.genres': 'Categories (multi-select)',
      'rank.chapters': 'Chapter titles',
      'rank.scan': 'Scan rankings',
      'rank.scanning': 'Scanning… (1–3 min)',
      'rank.skillPicker': 'Screening skills',
      'rank.skillHint': 'Selected skills only guide the analysis; no code from them runs.',
      'rank.skillEmpty': 'No skills yet — import them in the Skills tab.',
      'rank.custom': 'Add custom platform',
      'rank.customName': 'Platform name',
      'rank.customUrl': 'Ranking page URL',
      'rank.add': 'Add',
      'rank.invalidUrl': 'Enter an http(s) ranking URL',
      'rank.open': 'Open ranking',
      'rank.remove': 'Remove platform',
      'rank.status': 'Fetch status',
      'rank.books': 'Ranked books',
      'rank.noBooks': 'No books collected',
      'rank.analysis': 'Architecture groups',
      'rank.takeaway': 'Category takeaway',
      'rank.crossGenre': 'Cross-category takeaway',
      'rank.appeal': 'Why it works',
      'rank.evidence': 'Evidence',
      'rank.words': 'words',
      'rank.reads': 'readers',
      'rank.chaptersShort': 'ch',
      'rank.noAnalysis': 'No architecture analysis',
      'rank.analysisBy': 'Model',
      'rank.scanFailed': 'Scan failed',
      'rank.noPlatform': 'Select at least one platform',
      'rank.noGenre': 'Select at least one category',
      'rank.warning': 'Only public rankings, synopsis, chapter titles and public mirror chapters are fetched for structure analysis; no original text is stored. Follow each source site’s terms; anti-bot and rate limits are reported.',
      'rank.selected': 'selected',
      'rank.mirror': 'Fill text via mirrors',
      'rank.mirrorHint': 'Search mirrors via Bing for public chapters; used only for this analysis and not stored.',
      'rank.fullText': 'Text samples',
      'rank.customGenre': 'Custom category',
      'rank.genreName': 'Category name',
      'rank.genreUrl': 'Fanqie category URL or ID',
      'rank.genreNameRequired': 'Enter a category name',
      'rank.genreUrlInvalid': 'Enter a Fanqie category URL (with /rank/1_2_258) or numeric ID',
      'rank.expand': 'Show all categories',
      'rank.collapse': 'Collapse categories',
      'rank.removeGenre': 'Remove category',
      'rank.myNovel': 'My novel',
      'rank.novelHint': 'Import a downloaded .txt / .md or folder, then analyze its opening architecture with the selected skills.',
      'rank.novelPath': 'Novel file or folder path',
      'rank.chooseFolder': 'Choose folder…',
      'rank.importNovel': 'Import novel',
      'rank.importingNovel': 'Importing…',
      'rank.localEmpty': 'No local novel imported yet',
      'rank.localPathRequired': 'Enter a novel file or folder path',
      'rank.localFailed': 'Import failed',
      'rank.analyzeLocal': 'Analyze with selected skills',
      'rank.analyzing': 'Analyzing…',
      'rank.localAnalysis': 'Local novel architecture',
      'rank.targetReaders': 'Target readers',
      'rank.openingHook': 'Opening hook',
      'rank.pacing': 'Pacing',
      'rank.genre': 'Genre',
      'rank.chapterTitlesLabel': 'First 10 chapter titles',
      'rank.downloadSource': 'Text source',
      'rank.downloadSourceHint': 'Open the mirror site where the text is available',
      'rank.localWords': 'chars',
      'rank.localChapters': 'chapters',
      'skills.chip.webnovel': 'Web novel',
      'skills.chip.deslop': 'De-AI',
      'skills.chip.long': 'Long-form',
      'skills.chip.scan': 'Story breakdown',
      'skills.chip.short': 'Short story',
    }

    const POV_OPTIONS = [
      { value: 'first', key: 'opt.pov.first' },
      { value: 'third-limited', key: 'opt.pov.thirdLimited' },
      { value: 'third-omniscient', key: 'opt.pov.thirdOmniscient' },
      { value: 'multi', key: 'opt.pov.multi' },
    ]

    const TONE_OPTIONS = [
      { value: 'hot', key: 'opt.tone.hot' },
      { value: 'calm', key: 'opt.tone.calm' },
      { value: 'light', key: 'opt.tone.light' },
      { value: 'dark', key: 'opt.tone.dark' },
      { value: 'delicate', key: 'opt.tone.delicate' },
    ]

    const DEFAULT_PARAMS = {
      title: '',
      genre: '',
      pov: 'third-limited',
      tone: 'hot',
      words: '',
      chapterWords: '',
      cadence: '',
      pitch: '',
      conflict: '',
      world: '',
      characters: '',
      taboo: '',
      patience: 3,
      pleasure: 3,
      pacing: 3,
    }

    const TEXT_KEYS = [
      'title', 'genre', 'pov', 'tone', 'words',
      'chapterWords', 'cadence', 'pitch', 'conflict', 'world', 'characters', 'taboo',
    ]
    const RANGE_KEYS = ['patience', 'pleasure', 'pacing']

    function clampRange(value) {
      const parsed = Number(value)
      if (!Number.isFinite(parsed)) return 3
      return Math.min(5, Math.max(1, Math.round(parsed)))
    }

    function createDefaultState() {
      return { version: 1, folder: '', params: { ...DEFAULT_PARAMS }, platforms: [], customGenres: [], localNovel: null, updatedAt: 0 }
    }

    function mergeLocalNovel(raw) {
      if (!raw || typeof raw !== 'object' || typeof raw.path !== 'string' || !raw.path.trim()) return null
      return {
        name: typeof raw.name === 'string' ? raw.name : '',
        path: raw.path,
        files: Number(raw.files) || 1,
        words: Number(raw.words) || 0,
        chapterCount: Number(raw.chapterCount) || 0,
        chapterTitles: Array.isArray(raw.chapterTitles)
          ? raw.chapterTitles.filter((title) => typeof title === 'string').slice(0, 10)
          : [],
        synopsis: typeof raw.synopsis === 'string' ? raw.synopsis : '',
        importedAt: Number(raw.importedAt) || 0,
      }
    }

    function mergeCustomGenres(raw) {
      if (!Array.isArray(raw)) return []
      return raw
        .filter((entry) => entry && typeof entry === 'object' && typeof entry.label === 'string' && entry.label.trim())
        .slice(0, 30)
        .map((entry) => ({
          id: typeof entry.id === 'string' && entry.id ? entry.id : `custom-g-${Math.random().toString(36).slice(2, 8)}`,
          label: entry.label.trim(),
          gender: entry.gender === 0 ? 0 : 1,
          fanqieId: Number(entry.fanqieId) || 0,
        }))
        .filter((entry) => entry.fanqieId > 0)
    }

    function mergePlatforms(raw) {
      if (!Array.isArray(raw)) return []
      return raw
        .filter((entry) => entry && typeof entry === 'object' && typeof entry.rankUrl === 'string' && /^https?:\/\//i.test(entry.rankUrl))
        .slice(0, 20)
        .map((entry) => ({
          id: typeof entry.id === 'string' && entry.id ? entry.id : `custom-${Math.random().toString(36).slice(2, 8)}`,
          name: typeof entry.name === 'string' && entry.name ? entry.name : '自定义平台',
          home: typeof entry.home === 'string' ? entry.home : '',
          rankUrl: entry.rankUrl,
          parser: 'generic',
        }))
    }

    function mergeState(raw) {
      const base = createDefaultState()
      if (!raw || typeof raw !== 'object') return base
      const source = raw.params && typeof raw.params === 'object' ? raw.params : {}
      const params = { ...base.params }
      for (const key of TEXT_KEYS) {
        const value = typeof source[key] === 'string' ? source[key] : ''
        params[key] = value === '' ? base.params[key] : value
      }
      for (const key of RANGE_KEYS) {
        params[key] = clampRange(source[key] === undefined ? params[key] : source[key])
      }
      if (!POV_OPTIONS.some((option) => option.value === params.pov)) params.pov = 'third-limited'
      if (!TONE_OPTIONS.some((option) => option.value === params.tone)) params.tone = 'hot'
      return {
        version: 1,
        folder: typeof raw.folder === 'string' ? raw.folder : '',
        params,
        platforms: mergePlatforms(raw.platforms),
        customGenres: mergeCustomGenres(raw.customGenres),
        localNovel: mergeLocalNovel(raw.localNovel),
        updatedAt: Number(raw.updatedAt) || 0,
      }
    }

    function messageOf(error) {
      if (!error) return 'unknown error'
      if (error.name === 'AbortError') return 'timeout'
      return error.message ? String(error.message) : String(error)
    }

    async function request(action, init, timeoutMs = 20_000) {
      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetch(`${API_BASE}${action}`, {
          ...init,
          cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          signal: controller.signal,
        })
        let data
        try {
          data = await response.json()
        } catch {
          throw new Error(`HTTP ${response.status}`)
        }
        if (!response.ok || !data || data.ok !== true) {
          throw new Error((data && data.error) || `HTTP ${response.status}`)
        }
        return data
      } finally {
        window.clearTimeout(timer)
      }
    }

    function clockOf(value) {
      const timestamp = Number(value)
      if (!timestamp) return ''
      try {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      } catch {
        return ''
      }
    }

    function dateOf(value) {
      const timestamp = Number(value)
      if (!timestamp) return ''
      try {
        return new Date(timestamp).toLocaleDateString()
      } catch {
        return ''
      }
    }

    function numberText(value) {
      return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '—'
    }

    function sizeText(bytes) {
      const value = Number(bytes)
      if (!Number.isFinite(value) || value <= 0) return '0 B'
      if (value < 1024) return `${value} B`
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
      return `${(value / (1024 * 1024)).toFixed(1)} MB`
    }

    function BookIcon({ size }) {
      const edge = size || 18
      return h(
        'svg',
        {
          width: edge,
          height: edge,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        h('path', { d: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15.5H6.5A2.5 2.5 0 0 0 4 21V5.5Z' }),
        h('path', { d: 'M4 21a2.5 2.5 0 0 1 2.5-2.5H19' }),
        h('path', { d: 'M9 8h6M9 11h4' }),
      )
    }

    function SidebarIcon({ size }) {
      return h(
        'span',
        {
          'data-dsh-plugin': 'dsh-novel-assist',
          'data-dsh-part': 'sidebar-icon',
          style: { display: 'inline-flex' },
        },
        h(BookIcon, { size: size || 18 }),
      )
    }

    function TextField({ id, label, value, placeholder, onChange, multiline }) {
      const control = multiline
        ? h('textarea', {
            id,
            className: 'nvassist-control',
            rows: 3,
            value,
            placeholder: placeholder || '',
            onChange: (event) => onChange(event.target.value),
          })
        : h('input', {
            id,
            className: 'nvassist-control',
            type: 'text',
            value,
            placeholder: placeholder || '',
            spellCheck: false,
            onChange: (event) => onChange(event.target.value),
          })
      return h('div', { className: multiline ? 'nvassist-field wide' : 'nvassist-field' }, h('label', { htmlFor: id }, label), control)
    }

    function SelectField({ id, label, value, options, onChange, t }) {
      return h(
        'div',
        { className: 'nvassist-field' },
        h('label', { htmlFor: id }, label),
        h(
          'select',
          { id, className: 'nvassist-control', value, onChange: (event) => onChange(event.target.value) },
          options.map((option) => h('option', { key: option.value, value: option.value }, t(option.key))),
        ),
      )
    }

    function RangeField({ id, label, value, low, high, onChange }) {
      return h(
        'div',
        { className: 'nvassist-field' },
        h('label', { htmlFor: id }, label),
        h(
          'div',
          { className: 'nvassist-range-row' },
          h('input', {
            id,
            type: 'range',
            min: 1,
            max: 5,
            step: 1,
            className: 'nvassist-range',
            value,
            onChange: (event) => onChange(Number(event.target.value)),
          }),
          h('span', { className: 'nvassist-range-value' }, String(value)),
        ),
        h('div', { className: 'nvassist-scale' }, h('span', null, low), h('span', null, high)),
      )
    }

    function Section({ title, hint, children }) {
      return h(
        'section',
        { className: 'nvassist-card' },
        h(
          'div',
          { className: 'nvassist-card-head' },
          h('h2', { className: 'nvassist-card-title' }, title),
          hint ? h('span', { className: 'nvassist-card-hint' }, hint) : null,
        ),
        children,
      )
    }

    function QuickChip({ label, value }) {
      return h('span', { className: 'nvassist-chip' }, h('span', null, label), h('b', null, value))
    }

    function Stat({ value, label }) {
      return h('div', { className: 'nvassist-stat' }, h('b', null, numberText(value)), h('span', null, label))
    }

    function TabButton({ active, onClick, children }) {
      return h(
        'button',
        {
          type: 'button',
          role: 'tab',
          'aria-selected': active,
          className: active ? 'nvassist-tab active' : 'nvassist-tab',
          onClick,
        },
        children,
      )
    }

    /* ------------------------------------------------------------------ */
    
/* ============================================================================
 * 【板块二】技能兼容 —— SkillsStudio
 * ----------------------------------------------------------------------------
 * 作用：扫描本地技能库、导入文件夹 / SKILL.md / .zip / GitHub 链接、
 *       GitHub 技能市场搜索与安装、两段式确认移除。
 * Host 接口：GET /skills、POST /skills/import、POST /skills/repo、
 *            POST /skills/remove、GET /skills/market?q=
 * 详细代码地图：docs/panel-skills.md
 * ========================================================================== */

/* Skills tab                                                          */
    /* ------------------------------------------------------------------ */

    const MARKET_CHIPS = [
      { key: 'skills.chip.webnovel', query: '网文' },
      { key: 'skills.chip.deslop', query: '去AI味 小说' },
      { key: 'skills.chip.long', query: '长篇小说' },
      { key: 'skills.chip.scan', query: '拆书 小说' },
      { key: 'skills.chip.short', query: '短篇小说' },
    ]

    function SkillsStudio({ t, pickDirectory }) {
      const [skills, setSkills] = useState([])
      const [roots, setRoots] = useState([])
      const [loading, setLoading] = useState(true)
      const [loadError, setLoadError] = useState('')
      const [notice, setNotice] = useState(null)
      const [busy, setBusy] = useState('')
      const [localPath, setLocalPath] = useState('')
      const [url, setUrl] = useState('')
      const [market, setMarket] = useState({ curated: [], items: [], query: '' })
      const [marketLoading, setMarketLoading] = useState(true)
      const [marketError, setMarketError] = useState('')
      const [query, setQuery] = useState('')
      const [choices, setChoices] = useState({})
      const [confirmDir, setConfirmDir] = useState('')

      const refreshSkills = useCallback(async () => {
        setLoading(true)
        setLoadError('')
        try {
          const data = await request('/skills', { method: 'GET' }, 25_000)
          setSkills(Array.isArray(data.skills) ? data.skills : [])
          setRoots(Array.isArray(data.roots) ? data.roots : [])
        } catch (error) {
          setLoadError(messageOf(error))
        } finally {
          setLoading(false)
        }
      }, [])

      const loadMarket = useCallback(
        async (searchQuery) => {
          setMarketLoading(true)
          setMarketError('')
          try {
            const suffix = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''
            const data = await request(`/skills/market${suffix}`, { method: 'GET' }, 90_000)
            setMarket((current) => ({
              curated: Array.isArray(data.curated) ? data.curated : current.curated,
              items: Array.isArray(data.items) ? data.items : [],
              query: data.query || searchQuery || '',
            }))
          } catch (error) {
            setMarketError(messageOf(error))
          } finally {
            setMarketLoading(false)
          }
        },
        [],
      )

      useEffect(() => {
        refreshSkills()
        loadMarket('')
      }, [refreshSkills, loadMarket])

      const report = (kind, text, extra) => setNotice({ kind, text, extra: extra || '' })

      const handleResult = useCallback(
        (data, choiceKey) => {
          if (data.needsChoice) {
            const key = data.repo ? `repo:${data.repo}` : choiceKey || 'local'
            setChoices((current) => ({ ...current, [key]: Array.isArray(data.skills) ? data.skills : [] }))
            return
          }
          if (data.installed) {
            const extra = data.warnings && data.warnings.length ? data.warnings[0] : t('skills.ready')
            report('ok', `${t('skills.installed')}：${data.installed.name}`, extra)
            refreshSkills()
          }
        },
        [refreshSkills, t],
      )

      const importFolder = useCallback(async () => {
        if (!pickDirectory) {
          report('err', t('skills.importFailed'), t('folder.pickerUnavailable'))
          return
        }
        setBusy('folder')
        try {
          const picked = await pickDirectory()
          if (!picked) return
          const data = await request('/skills/import', {
            method: 'POST',
            body: JSON.stringify({ kind: 'folder', path: picked }),
          }, 90_000)
          handleResult(data, 'local')
        } catch (error) {
          report('err', t('skills.importFailed'), messageOf(error))
        } finally {
          setBusy('')
        }
      }, [handleResult, pickDirectory, t])

      const importLocalPath = useCallback(async () => {
        const path = localPath.trim()
        if (!path) {
          report('err', t('skills.importFailed'), t('skills.pathRequired'))
          return
        }
        setBusy('path')
        try {
          const data = await request('/skills/import', {
            method: 'POST',
            body: JSON.stringify({ kind: 'file', path }),
          }, 180_000)
          handleResult(data, 'local')
        } catch (error) {
          report('err', t('skills.importFailed'), messageOf(error))
        } finally {
          setBusy('')
        }
      }, [handleResult, localPath, t])

      const importFromUrl = useCallback(async () => {
        const trimmed = url.trim()
        if (!trimmed) {
          report('err', t('skills.importFailed'), t('skills.pathRequired'))
          return
        }
        setBusy('url')
        try {
          const data = await request('/skills/import', {
            method: 'POST',
            body: JSON.stringify({ kind: 'url', url: trimmed }),
          }, 240_000)
          handleResult(data, 'local')
        } catch (error) {
          report('err', t('skills.importFailed'), messageOf(error))
        } finally {
          setBusy('')
        }
      }, [handleResult, t, url])

      const installRepo = useCallback(
        async (repo, skillPath) => {
          const key = skillPath ? `${repo}#${skillPath}` : repo
          setBusy(key)
          try {
            const data = await request('/skills/repo', {
              method: 'POST',
              body: JSON.stringify(skillPath ? { repo, path: skillPath } : { repo }),
            }, 300_000)
            handleResult(data, null)
            if (data.installed) {
              setChoices((current) => {
                const next = { ...current }
                delete next[`repo:${repo}`]
                return next
              })
            }
            if (!data.needsChoice && !data.installed) report('ok', t('skills.install'), '')
          } catch (error) {
            report('err', t('skills.importFailed'), messageOf(error))
          } finally {
            setBusy('')
          }
        },
        [handleResult, t],
      )

      const chooseLocal = useCallback(
        async (path) => {
          setBusy(`local#${path}`)
          try {
            const data = await request('/skills/import', {
              method: 'POST',
              body: JSON.stringify({ kind: 'folder', path }),
            }, 180_000)
            handleResult(data, 'local')
            setChoices((current) => {
              const next = { ...current }
              delete next.local
              return next
            })
          } catch (error) {
            report('err', t('skills.importFailed'), messageOf(error))
          } finally {
            setBusy('')
          }
        },
        [handleResult, t],
      )

      const removeSkill = useCallback(
        async (dir) => {
          setBusy(`remove#${dir}`)
          try {
            await request('/skills/remove', { method: 'POST', body: JSON.stringify({ dir }) }, 30_000)
            setConfirmDir('')
            report('ok', t('skills.removed'), '')
            refreshSkills()
          } catch (error) {
            report('err', t('skills.removeFailed'), messageOf(error))
          } finally {
            setBusy('')
          }
        },
        [refreshSkills, t],
      )

      const localChoices = choices.local || []
      const userRoot = roots.find((root) => root.id === 'user')

      return h(
        React.Fragment,
        null,
        h(
          'section',
          { className: 'nvassist-card' },
          h(
            'div',
            { className: 'nvassist-card-head' },
            h(
              'h2',
              { className: 'nvassist-card-title' },
              t('skills.localTitle'),
              h('span', { className: 'nvassist-count' }, ` ${skills.length} ${t('skills.foundUnit')}`),
            ),
            h('button', { type: 'button', className: 'nvassist-link', onClick: refreshSkills }, t('skills.refresh')),
          ),
          userRoot
            ? h(
                'p',
                { className: 'nvassist-hint nvassist-root-note' },
                `${t('skills.rootNote')}：`,
                h('code', null, userRoot.path),
              )
            : null,
          h(
            'div',
            { className: 'nvassist-import' },
            h(
              'div',
              { className: 'nvassist-import-row' },
              h(
                'button',
                { type: 'button', className: 'nvassist-btn primary', onClick: importFolder, disabled: busy === 'folder' },
                busy === 'folder' ? t('skills.importing') : t('skills.importFolder'),
              ),
              h('span', { className: 'nvassist-hint' }, t('skills.folderHint')),
            ),
            h(
              'div',
              { className: 'nvassist-import-row' },
              h('input', {
                className: 'nvassist-control',
                type: 'text',
                value: localPath,
                placeholder: t('skills.pathPlaceholder'),
                spellCheck: false,
                'aria-label': t('skills.pathPlaceholder'),
                onChange: (event) => setLocalPath(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    importLocalPath()
                  }
                },
              }),
              h(
                'button',
                { type: 'button', className: 'nvassist-btn', onClick: importLocalPath, disabled: busy === 'path' },
                busy === 'path' ? t('skills.importing') : t('skills.importBtn'),
              ),
            ),
            h(
              'div',
              { className: 'nvassist-import-row' },
              h('input', {
                className: 'nvassist-control',
                type: 'text',
                value: url,
                placeholder: t('skills.urlPlaceholder'),
                spellCheck: false,
                'aria-label': t('skills.urlPlaceholder'),
                onChange: (event) => setUrl(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    importFromUrl()
                  }
                },
              }),
              h(
                'button',
                { type: 'button', className: 'nvassist-btn', onClick: importFromUrl, disabled: busy === 'url' },
                busy === 'url' ? t('skills.importing') : t('skills.urlBtn'),
              ),
            ),
          ),
          notice
            ? h(
                'div',
                { className: `nvassist-notice ${notice.kind}`, role: 'status' },
                h('strong', null, notice.text),
                notice.extra ? h('span', null, notice.extra) : null,
              )
            : null,
          loadError
            ? h('p', { className: 'nvassist-error' }, `${t('skills.loadFailed')}：${loadError}`)
            : null,
          localChoices.length > 0
            ? h(
                'div',
                { className: 'nvassist-choices' },
                h('p', { className: 'nvassist-hint' }, t('skills.chooseSkill')),
                localChoices.map((entry) =>
                  h(
                    'button',
                    {
                      key: entry.path,
                      type: 'button',
                      className: 'nvassist-choice',
                      disabled: busy === `local#${entry.path}`,
                      onClick: () => chooseLocal(entry.path),
                    },
                    h('code', null, entry.label),
                    h('span', null, entry.dir || entry.path),
                  ),
                ),
              )
            : null,
          loading
            ? h('p', { className: 'nvassist-hint' }, '…')
            : skills.length === 0
              ? h(
                  'div',
                  { className: 'nvassist-empty' },
                  h('strong', null, t('skills.empty')),
                  h('p', null, t('skills.emptyHint')),
                )
              : h(
                  'div',
                  { className: 'nvassist-skill-list' },
                  skills.map((skill) =>
                    h(
                      'div',
                      { key: skill.dir, className: 'nvassist-skill' },
                      h(
                        'div',
                        { className: 'nvassist-skill-line' },
                        h('code', { className: 'nvassist-skill-name' }, skill.name),
                        skill.novel ? h('span', { className: 'nvassist-badge accent' }, t('skills.novel')) : null,
                        skill.valid ? null : h('span', { className: 'nvassist-badge warn' }, t('skills.invalid')),
                        h(
                          'span',
                          { className: 'nvassist-badge' },
                          skill.root === 'project' ? t('skills.projectRoot') : t('skills.userRoot'),
                        ),
                        skill.root === 'user'
                          ? h(
                              'button',
                              {
                                type: 'button',
                                className: confirmDir === skill.dir ? 'nvassist-link danger nvassist-skill-remove' : 'nvassist-link nvassist-skill-remove',
                                disabled: busy === `remove#${skill.dir}`,
                                onClick: () => {
                                  if (confirmDir === skill.dir) removeSkill(skill.dir)
                                  else setConfirmDir(skill.dir)
                                },
                              },
                              confirmDir === skill.dir ? t('skills.confirmRemove') : t('skills.remove'),
                            )
                          : null,
                      ),
                      h('p', { className: 'nvassist-skill-desc' }, skill.description || t('skills.noDescription')),
                      h(
                        'p',
                        { className: 'nvassist-skill-meta' },
                        `${skill.files} ${t('skills.filesUnit')} · ${sizeText(skill.bytes)} · ${t('skills.updatedPrefix')} ${dateOf(skill.updatedAt)}`,
                      ),
                    ),
                  ),
                ),
          h('p', { className: 'nvassist-hint nvassist-warning' }, t('skills.warning')),
        ),
        h(
          'section',
          { className: 'nvassist-card' },
          h(
            'div',
            { className: 'nvassist-card-head' },
            h(
              'div',
              null,
              h('h2', { className: 'nvassist-card-title' }, t('skills.marketTitle')),
              h('p', { className: 'nvassist-card-hint' }, t('skills.marketHint')),
            ),
            h(
              'button',
              { type: 'button', className: 'nvassist-link', onClick: () => loadMarket(query) },
              t('skills.refresh'),
            ),
          ),
          h(
            'div',
            { className: 'nvassist-import-row nvassist-search-row' },
            h('input', {
              className: 'nvassist-control',
              type: 'text',
              value: query,
              placeholder: t('skills.searchPlaceholder'),
              spellCheck: false,
              'aria-label': t('skills.searchPlaceholder'),
              onChange: (event) => setQuery(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  loadMarket(query)
                }
              },
            }),
            h(
              'button',
              { type: 'button', className: 'nvassist-btn primary', onClick: () => loadMarket(query), disabled: marketLoading },
              marketLoading ? '…' : t('skills.search'),
            ),
          ),
          h(
            'div',
            { className: 'nvassist-chips' },
            MARKET_CHIPS.map((chip) =>
              h(
                'button',
                {
                  key: chip.key,
                  type: 'button',
                  className: 'nvassist-chip-btn',
                  onClick: () => {
                    setQuery(chip.query)
                    loadMarket(chip.query)
                  },
                },
                t(chip.key),
              ),
            ),
          ),
          marketError
            ? h('p', { className: 'nvassist-error' }, `${t('skills.searchFailed')}：${marketError}`)
            : null,
          market.items.length > 0
            ? h(
                'div',
                { className: 'nvassist-market' },
                market.items.map((item) => marketCard(item, false)),
              )
            : !market.query && market.curated.length > 0
              ? h(
                  'div',
                  { className: 'nvassist-market' },
                  market.curated.map((item) => marketCard(item, true)),
                )
              : null,
          market.items.length === 0 && market.query && !marketLoading && !marketError
            ? h('p', { className: 'nvassist-hint' }, t('skills.noResults'))
            : null,
          market.items.length === 0 && !market.query && !marketLoading && !marketError && market.curated.length === 0
            ? h('p', { className: 'nvassist-hint' }, t('skills.noResults'))
            : null,
        ),
      )

      function marketCard(item, curated) {
        const repo = item.repo
        const repoChoices = choices[`repo:${repo}`] || []
        const installing = busy === repo || busy.startsWith(`${repo}#`)
        return h(
          'div',
          { key: repo, className: 'nvassist-market-card' },
          h(
            'div',
            { className: 'nvassist-market-head' },
            h('code', { className: 'nvassist-market-repo' }, repo),
            typeof item.stars === 'number' ? h('span', { className: 'nvassist-stars' }, `★ ${numberText(item.stars)}`) : null,
            curated ? h('span', { className: 'nvassist-badge accent' }, t('skills.curated')) : null,
            item.archived ? h('span', { className: 'nvassist-badge warn' }, t('skills.archived')) : null,
          ),
          item.title ? h('strong', { className: 'nvassist-market-title' }, item.title) : null,
          h('p', { className: 'nvassist-market-desc' }, item.description || t('skills.noDescription')),
          Array.isArray(item.tags) && item.tags.length > 0
            ? h(
                'div',
                { className: 'nvassist-tags' },
                item.tags.map((tag) => h('span', { key: tag, className: 'nvassist-tag' }, tag)),
              )
            : null,
          h(
            'div',
            { className: 'nvassist-market-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'nvassist-btn primary small',
                disabled: installing,
                onClick: () => installRepo(repo, ''),
              },
              installing ? t('skills.installing') : t('skills.install'),
            ),
            item.url
              ? h(
                  'a',
                  { className: 'nvassist-link', href: item.url, target: '_blank', rel: 'noreferrer noopener' },
                  `${t('skills.repoLink')} ↗`,
                )
              : null,
          ),
          repoChoices.length > 0
            ? h(
                'div',
                { className: 'nvassist-choices' },
                h('p', { className: 'nvassist-hint' }, t('skills.chooseSkill')),
                repoChoices.map((entry) =>
                  h(
                    'button',
                    {
                      key: entry.path,
                      type: 'button',
                      className: 'nvassist-choice',
                      disabled: busy === `${repo}#${entry.path}`,
                      onClick: () => installRepo(repo, entry.path),
                    },
                    h('code', null, entry.label),
                    h('span', null, entry.path),
                  ),
                ),
              )
            : null,
        )
      }
    }

    /* ------------------------------------------------------------------ */
    
/* ============================================================================
 * 【板块三】平台扫榜 —— RankTab
 * ----------------------------------------------------------------------------
 * 作用：本地小说导入与分析、技能筛选、平台 / 分区选择（38 个番茄分区 + 自定义）、
 *       扫榜（镜像补正文、LLM 架构归类）、扫榜结果缓存恢复。
 * Host 接口：GET /rank/platforms、POST /rank/scan、GET /rank/last、
 *            POST /rank/local、POST /rank/local/analyze、GET /skills
 * 详细代码地图：docs/panel-rank.md
 * ========================================================================== */

/* Rankings tab                                                        */
    /* ------------------------------------------------------------------ */

    function groupBy(list, key) {
      const map = new Map()
      for (const item of list || []) {
        const value = item[key] || ''
        if (!map.has(value)) map.set(value, [])
        map.get(value).push(item)
      }
      return [...map.entries()]
    }

    function RankTab({
      t,
      pickDirectory,
      customPlatforms,
      onPlatformsChange,
      customGenres,
      onCustomGenresChange,
      localNovel,
      onLocalNovelChange,
    }) {
      const [catalog, setCatalog] = useState({ genres: [], platforms: [] })
      const [catalogError, setCatalogError] = useState('')
      const [selectedPlatforms, setSelectedPlatforms] = useState(['fanqie'])
      const [selectedGenres, setSelectedGenres] = useState(['xuanhuan'])
      const [scanning, setScanning] = useState(false)
      const [scanError, setScanError] = useState('')
      const [result, setResult] = useState(null)
      const [skills, setSkills] = useState([])
      const [selectedSkills, setSelectedSkills] = useState([])
      const [skillOpen, setSkillOpen] = useState(false)
      const [customOpen, setCustomOpen] = useState(false)
      const [customName, setCustomName] = useState('')
      const [customUrl, setCustomUrl] = useState('')
      const [customError, setCustomError] = useState('')
      const [genresExpanded, setGenresExpanded] = useState(false)
      const [customGenreOpen, setCustomGenreOpen] = useState(false)
      const [customGenreName, setCustomGenreName] = useState('')
      const [customGenreUrl, setCustomGenreUrl] = useState('')
      const [customGenreError, setCustomGenreError] = useState('')
      const [mirror, setMirror] = useState(true)
      const [localPath, setLocalPath] = useState(localNovel && localNovel.path ? localNovel.path : '')
      const [localBusy, setLocalBusy] = useState(false)
      const [localError, setLocalError] = useState('')
      const [localAnalyzing, setLocalAnalyzing] = useState(false)
      const [localAnalysis, setLocalAnalysis] = useState(null)

      useEffect(() => {
        let cancelled = false
        Promise.all([
          request('/rank/platforms', { method: 'GET' }, 30_000),
          request('/skills', { method: 'GET' }, 25_000),
        ])
          .then(([catalogData, skillData]) => {
            if (cancelled) return
            setCatalog({
              genres: Array.isArray(catalogData.genres) ? catalogData.genres : [],
              platforms: Array.isArray(catalogData.platforms) ? catalogData.platforms : [],
            })
            setSkills(Array.isArray(skillData.skills) ? skillData.skills : [])
          })
          .catch((error) => {
            if (!cancelled) setCatalogError(messageOf(error))
          })
        return () => {
          cancelled = true
        }
      }, [])

      useEffect(() => {
        if (localNovel && localNovel.path) setLocalPath(localNovel.path)
      }, [localNovel])

      useEffect(() => {
        let cancelled = false
        request('/rank/last', { method: 'GET' }, 20_000)
          .then((data) => {
            if (cancelled) return
            if (data.result && Array.isArray(data.result.books) && data.result.books.length) {
              setResult(data.result)
            }
          })
          .catch(() => {})
        return () => {
          cancelled = true
        }
      }, [])

      const custom = Array.isArray(customPlatforms) ? customPlatforms : []
      const platforms = [...catalog.platforms, ...custom.map((entry) => ({ ...entry, parser: 'generic' }))]
      const customGenreList = (Array.isArray(customGenres) ? customGenres : []).map((entry) => ({
        id: entry.id,
        label: entry.label,
        featured: false,
        group: '自定义',
        custom: true,
        keywords: [entry.label],
        maps: entry.fanqieId ? { fanqie: { gender: entry.gender === 0 ? 0 : 1, id: entry.fanqieId } } : {},
      }))
      const allGenres = [...catalog.genres, ...customGenreList]
      const featuredGenres = catalog.genres.filter((genre) => genre.featured)
      const extraGenres = catalog.genres.filter((genre) => !genre.featured)

      const togglePlatform = (id) => {
        setSelectedPlatforms((current) =>
          current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
        )
      }
      const toggleGenre = (id) => {
        setSelectedGenres((current) =>
          current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
        )
      }
      const toggleSkill = (name) => {
        setSelectedSkills((current) =>
          current.includes(name) ? current.filter((value) => value !== name) : [...current, name],
        )
      }

      const addCustom = () => {
        const url = customUrl.trim()
        if (!/^https?:\/\//i.test(url)) {
          setCustomError(t('rank.invalidUrl'))
          return
        }
        const name = customName.trim() || '自定义平台'
        const id = `custom-${Date.now().toString(36)}`
        onPlatformsChange([...custom, { id, name, home: url, rankUrl: url, parser: 'generic' }])
        setSelectedPlatforms((current) => (current.includes(id) ? current : [...current, id]))
        setCustomName('')
        setCustomUrl('')
        setCustomError('')
        setCustomOpen(false)
      }

      const removeCustom = (id) => {
        onPlatformsChange(custom.filter((entry) => entry.id !== id))
        setSelectedPlatforms((current) => current.filter((value) => value !== id))
      }

      const addCustomGenre = () => {
        const label = customGenreName.trim()
        if (!label) {
          setCustomGenreError(t('rank.genreNameRequired'))
          return
        }
        const raw = customGenreUrl.trim()
        const urlMatch = raw.match(/\/rank\/([01])_[12]_(\d+)/)
        let gender = 1
        let fanqieId = 0
        if (urlMatch) {
          gender = Number(urlMatch[1])
          fanqieId = Number(urlMatch[2])
        } else if (/^\d+$/.test(raw)) {
          fanqieId = Number(raw)
        } else {
          setCustomGenreError(t('rank.genreUrlInvalid'))
          return
        }
        if (!fanqieId) {
          setCustomGenreError(t('rank.genreUrlInvalid'))
          return
        }
        const id = `custom-g-${Date.now().toString(36)}`
        onCustomGenresChange([...(customGenres || []), { id, label, gender, fanqieId }])
        setSelectedGenres((current) => (current.includes(id) ? current : [...current, id]))
        setCustomGenreName('')
        setCustomGenreUrl('')
        setCustomGenreError('')
        setCustomGenreOpen(false)
      }

      const removeCustomGenre = (id) => {
        onCustomGenresChange((customGenres || []).filter((entry) => entry.id !== id))
        setSelectedGenres((current) => current.filter((value) => value !== id))
      }

      const importLocalNovel = async (pathOverride) => {
        const path = String(pathOverride || localPath || '').trim()
        if (!path) {
          setLocalError(t('rank.localPathRequired'))
          return
        }
        setLocalBusy(true)
        setLocalError('')
        setLocalAnalysis(null)
        try {
          const data = await request('/rank/local', { method: 'POST', body: JSON.stringify({ path }) }, 180_000)
          onLocalNovelChange(data.novel)
          setLocalPath(data.novel.path || path)
        } catch (error) {
          setLocalError(messageOf(error))
        } finally {
          setLocalBusy(false)
        }
      }

      const chooseLocalNovel = async () => {
        if (!pickDirectory) {
          setLocalError(t('folder.pickerUnavailable'))
          return
        }
        try {
          const picked = await pickDirectory()
          if (picked) await importLocalNovel(picked)
        } catch (error) {
          setLocalError(messageOf(error))
        }
      }

      const analyzeLocal = async () => {
        if (!localNovel || !localNovel.path) return
        setLocalAnalyzing(true)
        setLocalError('')
        setLocalAnalysis(null)
        try {
          const data = await request(
            '/rank/local/analyze',
            { method: 'POST', body: JSON.stringify({ path: localNovel.path, skills: selectedSkills }) },
            400_000,
          )
          setLocalAnalysis(data)
        } catch (error) {
          setLocalError(messageOf(error))
        } finally {
          setLocalAnalyzing(false)
        }
      }

      const scan = async () => {
        const chosen = platforms
          .filter((platform) => selectedPlatforms.includes(platform.id))
          .map((platform) => ({
            id: platform.id,
            name: platform.name,
            parser: platform.parser || 'generic',
            home: platform.home || '',
            rankUrl: platform.rankUrl || '',
            genreMap: platform.genreMap || {},
          }))
        if (!chosen.length) {
          setScanError(t('rank.noPlatform'))
          return
        }
        const chosenGenres = allGenres
          .filter((genre) => selectedGenres.includes(genre.id))
          .map((genre) => ({
            id: genre.id,
            label: genre.label,
            keywords: genre.keywords || [genre.label],
            maps: genre.maps || {},
          }))
        if (!chosenGenres.length) {
          setScanError(t('rank.noGenre'))
          return
        }
        setScanning(true)
        setScanError('')
        setResult(null)
        try {
          const data = await request(
            '/rank/scan',
            {
              method: 'POST',
              body: JSON.stringify({
                platforms: chosen,
                genres: chosenGenres,
                topN: 10,
                chapters: 10,
                mirror,
                skills: selectedSkills,
              }),
            },
            480_000,
          )
          setResult(data)
        } catch (error) {
          setScanError(messageOf(error))
        } finally {
          setScanning(false)
        }
      }

      const genreGroups = result ? groupBy(result.books, 'genre') : []
      const analysis = result && result.analysis ? result.analysis : null
      const localModel = localAnalysis && localAnalysis.analysis ? localAnalysis.analysis : null
      const localArch = localModel && localModel.architecture ? localModel.architecture : null

      const localCard = h(
        'section',
        { className: 'nvassist-card' },
        h(
          'div',
          { className: 'nvassist-card-head' },
          h(
            'div',
            null,
            h('h2', { className: 'nvassist-card-title' }, t('rank.myNovel')),
            h('p', { className: 'nvassist-card-hint' }, t('rank.novelHint')),
          ),
          h(
            'button',
            { type: 'button', className: 'nvassist-btn small ghost', onClick: () => setSkillOpen((value) => !value) },
            `${t('rank.skillPicker')}${selectedSkills.length ? ` (${selectedSkills.length})` : ''}`,
          ),
        ),
        skillOpen
          ? h(
              'div',
              { className: 'nvassist-skillpicker' },
              skills.length
                ? skills.map((skill) =>
                    h(
                      'label',
                      { key: skill.dir, className: 'nvassist-skillpick' },
                      h('input', {
                        type: 'checkbox',
                        checked: selectedSkills.includes(skill.name),
                        onChange: () => toggleSkill(skill.name),
                      }),
                      h('code', null, skill.name),
                      h('span', null, skill.description || t('skills.noDescription')),
                    ),
                  )
                : h('p', { className: 'nvassist-hint' }, t('rank.skillEmpty')),
              h('p', { className: 'nvassist-hint' }, t('rank.skillHint')),
            )
          : null,
        h(
          'div',
          { className: 'nvassist-import-row' },
          h('input', {
            className: 'nvassist-control',
            type: 'text',
            value: localPath,
            placeholder: t('rank.novelPath'),
            spellCheck: false,
            onChange: (event) => setLocalPath(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                importLocalNovel()
              }
            },
          }),
          h('button', { type: 'button', className: 'nvassist-btn', onClick: chooseLocalNovel }, t('rank.chooseFolder')),
          h(
            'button',
            {
              type: 'button',
              className: 'nvassist-btn primary',
              disabled: localBusy,
              onClick: () => importLocalNovel(),
            },
            localBusy ? t('rank.importingNovel') : t('rank.importNovel'),
          ),
        ),
        localError ? h('p', { className: 'nvassist-error' }, `${t('rank.localFailed')}：${localError}`) : null,
        localNovel
          ? h(
              'div',
              { className: 'nvassist-local' },
              h(
                'div',
                { className: 'nvassist-skill-line' },
                h('strong', null, localNovel.name || t('quick.untitled')),
                h('span', { className: 'nvassist-badge' }, `${localNovel.words} ${t('rank.localWords')}`),
                h('span', { className: 'nvassist-badge' }, `${localNovel.chapterCount} ${t('rank.localChapters')}`),
              ),
              h('p', { className: 'nvassist-local-path' }, localNovel.path),
              localNovel.synopsis ? h('p', { className: 'nvassist-local-synopsis' }, localNovel.synopsis) : null,
              Array.isArray(localNovel.chapterTitles) && localNovel.chapterTitles.length
                ? h(
                    'details',
                    { className: 'nvassist-fulltext' },
                    h(
                      'summary',
                      null,
                      `${t('rank.chapterTitlesLabel')} · ${localNovel.chapterTitles.length}`,
                    ),
                    h('p', { className: 'nvassist-local-chapters' }, localNovel.chapterTitles.join('；')),
                  )
                : null,
              h(
                'div',
                { className: 'nvassist-local-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'nvassist-btn primary small',
                    disabled: localAnalyzing,
                    onClick: analyzeLocal,
                  },
                  localAnalyzing ? t('rank.analyzing') : t('rank.analyzeLocal'),
                ),
              ),
              localAnalysis && localModel
                ? h(
                    'div',
                    { className: 'nvassist-local-result' },
                    h(
                      'div',
                      { className: 'nvassist-arch' },
                      h('div', { className: 'nvassist-arch-name' }, (localArch && localArch.name) || localModel.genre || t('rank.localAnalysis')),
                      localModel.genre
                        ? h('p', { className: 'nvassist-arch-summary' }, `${t('rank.genre')}：${localModel.genre}`)
                        : null,
                      localArch && localArch.summary
                        ? h('p', { className: 'nvassist-arch-summary' }, localArch.summary)
                        : null,
                      localArch && Array.isArray(localArch.traits) && localArch.traits.length
                        ? h(
                            'div',
                            { className: 'nvassist-tags' },
                            localArch.traits.map((trait, index) =>
                              h('span', { key: index, className: 'nvassist-tag' }, trait),
                            ),
                          )
                        : null,
                      localArch && localArch.why
                        ? h('p', { className: 'nvassist-arch-why' }, `${t('rank.appeal')}：${localArch.why}`)
                        : null,
                      localArch && localArch.targetReaders
                        ? h('p', { className: 'nvassist-arch-books' }, `${t('rank.targetReaders')}：${localArch.targetReaders}`)
                        : null,
                      localArch && localArch.openingHook
                        ? h('p', { className: 'nvassist-arch-books' }, `${t('rank.openingHook')}：${localArch.openingHook}`)
                        : null,
                      localArch && localArch.pacing
                        ? h('p', { className: 'nvassist-arch-books' }, `${t('rank.pacing')}：${localArch.pacing}`)
                        : null,
                      Array.isArray(localModel.skillNotes) && localModel.skillNotes.length
                        ? h(
                            'div',
                            { className: 'nvassist-local-skills' },
                            localModel.skillNotes.map((note, index) =>
                              h(
                                'p',
                                { key: index, className: 'nvassist-arch-books' },
                                `${note.skill}：${note.note}`,
                              ),
                            ),
                          )
                        : null,
                      localModel.takeaway
                        ? h('p', { className: 'nvassist-arch-takeaway' }, localModel.takeaway)
                        : null,
                    ),
                  )
                : null,
              localAnalysis && !localModel && localAnalysis.text
                ? h('pre', { className: 'nvassist-analysis-raw' }, localAnalysis.text)
                : null,
            )
          : h('p', { className: 'nvassist-hint' }, t('rank.localEmpty')),
      )

      return h(
        'div',
        { className: 'nvassist-rank-root' },
        localCard,
        h(
          'section',
          { className: 'nvassist-card' },
          h(
            'div',
            { className: 'nvassist-card-head' },
            h(
              'div',
              null,
              h('h2', { className: 'nvassist-card-title' }, t('rank.title')),
              h('p', { className: 'nvassist-card-hint' }, t('rank.hint')),
            ),
          ),
          catalogError ? h('p', { className: 'nvassist-error' }, catalogError) : null,
          h(
            'div',
            { className: 'nvassist-rank-section' },
            h('h3', { className: 'nvassist-rank-label' }, t('rank.platforms')),
            h(
              'div',
              { className: 'nvassist-rank-chips' },
              platforms.map((platform) => {
                const active = selectedPlatforms.includes(platform.id)
                const isCustom = custom.some((entry) => entry.id === platform.id)
                return h(
                  'div',
                  { key: platform.id, className: active ? 'nvassist-rank-chip active' : 'nvassist-rank-chip' },
                  h(
                    'label',
                    { className: 'nvassist-rank-check' },
                    h('input', {
                      type: 'checkbox',
                      checked: active,
                      onChange: () => togglePlatform(platform.id),
                    }),
                    h('span', null, platform.name),
                  ),
                  platform.rankUrl
                    ? h(
                        'a',
                        {
                          className: 'nvassist-rank-link',
                          href: platform.rankUrl,
                          target: '_blank',
                          rel: 'noreferrer noopener',
                          title: t('rank.open'),
                        },
                        '↗',
                      )
                    : null,
                  isCustom
                    ? h(
                        'button',
                        {
                          type: 'button',
                          className: 'nvassist-rank-x',
                          title: t('rank.remove'),
                          onClick: () => removeCustom(platform.id),
                        },
                        '×',
                      )
                    : null,
                )
              }),
            ),
            h(
              'button',
              { type: 'button', className: 'nvassist-link', onClick: () => setCustomOpen((value) => !value) },
              `＋ ${t('rank.custom')}`,
            ),
            customOpen
              ? h(
                  'div',
                  { className: 'nvassist-custom-form' },
                  h('input', {
                    className: 'nvassist-control',
                    type: 'text',
                    value: customName,
                    placeholder: t('rank.customName'),
                    onChange: (event) => setCustomName(event.target.value),
                  }),
                  h('input', {
                    className: 'nvassist-control',
                    type: 'text',
                    value: customUrl,
                    placeholder: t('rank.customUrl'),
                    spellCheck: false,
                    onChange: (event) => setCustomUrl(event.target.value),
                    onKeyDown: (event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addCustom()
                      }
                    },
                  }),
                  h('button', { type: 'button', className: 'nvassist-btn primary small', onClick: addCustom }, t('rank.add')),
                  h('button', { type: 'button', className: 'nvassist-btn small ghost', onClick: () => setCustomOpen(false) }, '×'),
                  customError ? h('p', { className: 'nvassist-error' }, customError) : null,
                )
              : null,
          ),
          h(
            'div',
            { className: 'nvassist-rank-section' },
            h('h3', { className: 'nvassist-rank-label' }, t('rank.genres')),
            h(
              'div',
              { className: genresExpanded ? 'nvassist-rank-chips' : 'nvassist-rank-chips collapsed' },
              (genresExpanded ? [...featuredGenres, ...extraGenres] : featuredGenres).map((genre) => {
                const active = selectedGenres.includes(genre.id)
                return h(
                  'label',
                  { key: genre.id, className: active ? 'nvassist-rank-chip active' : 'nvassist-rank-chip' },
                  h('input', {
                    type: 'checkbox',
                    checked: active,
                    onChange: () => toggleGenre(genre.id),
                  }),
                  h('span', null, genre.label),
                )
              }),
            ),
            h(
              'div',
              { className: 'nvassist-rank-tools' },
              extraGenres.length
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'nvassist-link',
                      onClick: () => setGenresExpanded((value) => !value),
                    },
                    genresExpanded
                      ? t('rank.collapse')
                      : `${t('rank.expand')} (${extraGenres.length + customGenreList.length})`,
                  )
                : null,
              h(
                'button',
                {
                  type: 'button',
                  className: 'nvassist-link',
                  onClick: () => setCustomGenreOpen((value) => !value),
                },
                `＋ ${t('rank.customGenre')}`,
              ),
            ),
            customGenreList.length
              ? h(
                  'div',
                  { className: 'nvassist-rank-chips nvassist-rank-custom-row' },
                  customGenreList.map((genre) => {
                    const active = selectedGenres.includes(genre.id)
                    return h(
                      'div',
                      { key: genre.id, className: active ? 'nvassist-rank-chip active' : 'nvassist-rank-chip' },
                      h(
                        'label',
                        { className: 'nvassist-rank-check' },
                        h('input', {
                          type: 'checkbox',
                          checked: active,
                          onChange: () => toggleGenre(genre.id),
                        }),
                        h('span', null, genre.label),
                      ),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'nvassist-rank-x',
                          title: t('rank.removeGenre'),
                          onClick: () => removeCustomGenre(genre.id),
                        },
                        '×',
                      ),
                    )
                  }),
                )
              : null,
            customGenreOpen
              ? h(
                  'div',
                  { className: 'nvassist-custom-form' },
                  h('input', {
                    className: 'nvassist-control',
                    type: 'text',
                    value: customGenreName,
                    placeholder: t('rank.genreName'),
                    onChange: (event) => setCustomGenreName(event.target.value),
                  }),
                  h('input', {
                    className: 'nvassist-control',
                    type: 'text',
                    value: customGenreUrl,
                    placeholder: t('rank.genreUrl'),
                    spellCheck: false,
                    onChange: (event) => setCustomGenreUrl(event.target.value),
                    onKeyDown: (event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addCustomGenre()
                      }
                    },
                  }),
                  h(
                    'button',
                    { type: 'button', className: 'nvassist-btn primary small', onClick: addCustomGenre },
                    t('rank.add'),
                  ),
                  h(
                    'button',
                    { type: 'button', className: 'nvassist-btn small ghost', onClick: () => setCustomGenreOpen(false) },
                    '×',
                  ),
                  customGenreError ? h('p', { className: 'nvassist-error' }, customGenreError) : null,
                )
              : null,
          ),
          h(
            'div',
            { className: 'nvassist-rank-controls' },
            h(
              'label',
              { className: 'nvassist-rank-control' },
              h('input', {
                type: 'checkbox',
                checked: mirror,
                onChange: (event) => setMirror(event.target.checked),
              }),
              t('rank.mirror'),
            ),
            h(
              'button',
              { type: 'button', className: 'nvassist-btn primary', disabled: scanning, onClick: scan },
              scanning ? t('rank.scanning') : t('rank.scan'),
            ),
          ),
          h('p', { className: 'nvassist-hint' }, t('rank.mirrorHint')),
          h('p', { className: 'nvassist-hint nvassist-warning' }, t('rank.warning')),
          scanError ? h('p', { className: 'nvassist-error', role: 'alert' }, `${t('rank.scanFailed')}：${scanError}`) : null,
        ),
        scanning
          ? h(
              'section',
              { className: 'nvassist-card' },
              h('p', { className: 'nvassist-hint' }, t('rank.scanning')),
            )
          : null,
        result
          ? h(
              React.Fragment,
              null,
              h(
                'section',
                { className: 'nvassist-card' },
                h(
                  'div',
                  { className: 'nvassist-card-head' },
                  h('h2', { className: 'nvassist-card-title' }, t('rank.status')),
                  h(
                    'span',
                    { className: 'nvassist-card-hint' },
                    `${t('rank.books')} ${result.books.length} · ${result.counts.platforms}×${result.counts.genres}`,
                  ),
                ),
                (result.statuses || []).map((status, index) =>
                  h(
                    'div',
                    { key: index, className: status.ok ? 'nvassist-rank-status ok' : 'nvassist-rank-status fail' },
                    h('b', null, `${status.platform} · ${status.genre}`),
                    h(
                      'span',
                      null,
                      status.ok
                        ? `${status.count} 本 · ${t('rank.evidence')}：${status.evidence}${status.note ? ` · ${status.note}` : ''}`
                        : status.error,
                    ),
                  ),
                ),
                (result.warnings || []).length
                  ? h(
                      'div',
                      { className: 'nvassist-notice err' },
                      result.warnings.map((warning, index) => h('span', { key: index }, warning)),
                    )
                  : null,
              ),
              h(
                'section',
                { className: 'nvassist-card' },
                h(
                  'div',
                  { className: 'nvassist-card-head' },
                  h('h2', { className: 'nvassist-card-title' }, t('rank.books')),
                  h('span', { className: 'nvassist-card-hint' }, `${result.books.length}`),
                ),
                genreGroups.length === 0
                  ? h('p', { className: 'nvassist-hint' }, t('rank.noBooks'))
                  : genreGroups.map(([genre, books]) =>
                      h(
                        'div',
                        { key: genre, className: 'nvassist-rank-genre' },
                        h('h3', { className: 'nvassist-rank-genre-name' }, genre),
                        books.map((book) =>
                          h(
                            'div',
                            { key: `${book.platform}-${book.title}-${book.rank}`, className: 'nvassist-rank-book' },
                            h(
                              'div',
                              { className: 'nvassist-rank-book-line' },
                              h('span', { className: 'nvassist-rank-no' }, `#${book.rank}`),
                              h('strong', null, book.title),
                              book.author ? h('span', { className: 'nvassist-rank-author' }, book.author) : null,
                              book.url
                                ? h(
                                    'a',
                                    {
                                      className: 'nvassist-rank-link',
                                      href: book.url,
                                      target: '_blank',
                                      rel: 'noreferrer noopener',
                                      title: t('rank.open'),
                                    },
                                    '↗',
                                  )
                                : null,
                            ),
                            book.abstract
                              ? h('p', { className: 'nvassist-rank-book-desc' }, book.abstract)
                              : null,
                            book.chapterUrl
                              ? h(
                                  'p',
                                  { className: 'nvassist-rank-source' },
                                  h(
                                    'a',
                                    {
                                      href: book.chapterUrl,
                                      target: '_blank',
                                      rel: 'noreferrer noopener',
                                      title: t('rank.downloadSourceHint'),
                                    },
                                    `${t('rank.downloadSource')} ↗`,
                                  ),
                                  book.chapterSource ? h('span', null, ` · ${book.chapterSource}`) : null,
                                )
                              : null,
                            book.words || book.reads || (book.chapterTitles && book.chapterTitles.length)
                              ? h(
                                  'p',
                                  { className: 'nvassist-rank-book-meta' },
                                  [
                                    book.words ? `${book.words} ${t('rank.words')}` : '',
                                    book.reads ? `${book.reads} ${t('rank.reads')}` : '',
                                    book.chapterTitles && book.chapterTitles.length
                                      ? `${book.chapterTitles.length} ${t('rank.chaptersShort')}`
                                      : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' · '),
                                )
                              : null,
                            book.chapterTitles && book.chapterTitles.length
                              ? h(
                                  'p',
                                  { className: 'nvassist-rank-chapters' },
                                  `${t('rank.chapterTitlesLabel')}：${book.chapterTitles.slice(0, 10).join('；')}`,
                                )
                              : null,
                          ),
                        ),
                      ),
                    ),
              ),
              h(
                'section',
                { className: 'nvassist-card' },
                h(
                  'div',
                  { className: 'nvassist-card-head' },
                  h('h2', { className: 'nvassist-card-title' }, t('rank.analysis')),
                  result.model ? h('span', { className: 'nvassist-card-hint' }, `${t('rank.analysisBy')} ${result.model}`) : null,
                ),
                analysis
                  ? h(
                      React.Fragment,
                      null,
                      (analysis.genres || []).map((genre) =>
                        h(
                          'div',
                          { key: genre.genre, className: 'nvassist-rank-analysis' },
                          h('h3', { className: 'nvassist-rank-genre-name' }, genre.genre),
                          (genre.groups || []).map((group) =>
                            h(
                              'div',
                              { key: group.name, className: 'nvassist-arch' },
                              h('div', { className: 'nvassist-arch-name' }, group.name),
                              group.summary ? h('p', { className: 'nvassist-arch-summary' }, group.summary) : null,
                              Array.isArray(group.traits) && group.traits.length
                                ? h(
                                    'div',
                                    { className: 'nvassist-tags' },
                                    group.traits.map((trait, index) =>
                                      h('span', { key: index, className: 'nvassist-tag' }, trait),
                                    ),
                                  )
                                : null,
                              group.why
                                ? h('p', { className: 'nvassist-arch-why' }, `${t('rank.appeal')}：${group.why}`)
                                : null,
                              Array.isArray(group.books) && group.books.length
                                ? h('p', { className: 'nvassist-arch-books' }, group.books.join('、'))
                                : null,
                            ),
                          ),
                          genre.takeaway
                            ? h('p', { className: 'nvassist-arch-takeaway' }, `${t('rank.takeaway')}：${genre.takeaway}`)
                            : null,
                        ),
                      ),
                      analysis.crossGenre
                        ? h('p', { className: 'nvassist-arch-cross' }, `${t('rank.crossGenre')}：${analysis.crossGenre}`)
                        : null,
                    )
                  : h('p', { className: 'nvassist-hint' }, t('rank.noAnalysis')),
                result.analysisText ? h('pre', { className: 'nvassist-analysis-raw' }, result.analysisText) : null,
              ),
            )
          : null,
      )
    }

    /* ------------------------------------------------------------------ */
    
/* ============================================================================
 * 【板块一】自己作品 —— 面板外壳 + 作品文件夹 + 创作参数
 * ----------------------------------------------------------------------------
 * 作用：侧边栏面板根节点、三页签切换、作品文件夹绑定 / 扫描、
 *       参数编辑与 600ms 防抖自动保存、全局样式、locale 注册与槽位注册。
 * Host 接口：GET /state、POST /state、POST /scan
 * 详细代码地图：docs/panel-work.md
 * ========================================================================== */

/* Work tab                                                            */
    /* ------------------------------------------------------------------ */

    function NovelPanel(props) {
      const t = props.t
      const pickDirectory = props.pickDirectory
      const goConversation = props.goConversation

      const [tab, setTab] = useState(TABS.work)
      const [state, setState] = useState(createDefaultState)
      const [loaded, setLoaded] = useState(false)
      const [serviceError, setServiceError] = useState('')
      const [saveState, setSaveState] = useState('idle')
      const [savedAt, setSavedAt] = useState(0)
      const [scan, setScan] = useState(null)
      const [scanning, setScanning] = useState(false)
      const [scanError, setScanError] = useState('')
      const [storagePath, setStoragePath] = useState('')
      const skipNextSave = useRef(true)

      const runScan = useCallback(
        async (path) => {
          const value = String(path || '').trim()
          if (!value) {
            setScan(null)
            setScanError('')
            return
          }
          setScanning(true)
          setScanError('')
          try {
            const data = await request('/scan', { method: 'POST', body: JSON.stringify({ path: value }) }, 60_000)
            setScan(data.scan || null)
            if (data.scan && data.scan.exists === false) setScanError(t('folder.missing'))
            else if (data.scan && data.scan.isDirectory === false) setScanError(t('folder.notFolder'))
          } catch (error) {
            setScan(null)
            setScanError(messageOf(error))
          } finally {
            setScanning(false)
          }
        },
        [t],
      )

      useEffect(() => {
        let cancelled = false
        request('/state')
          .then((data) => {
            if (cancelled) return
            const next = mergeState(data.state)
            skipNextSave.current = true
            setState(next)
            setStoragePath(typeof data.storagePath === 'string' ? data.storagePath : '')
            setServiceError('')
            setLoaded(true)
            if (next.updatedAt) {
              setSavedAt(next.updatedAt)
              setSaveState('saved')
            }
            if (next.folder) runScan(next.folder)
          })
          .catch((error) => {
            if (cancelled) return
            skipNextSave.current = true
            setServiceError(messageOf(error))
            setLoaded(true)
          })
        return () => {
          cancelled = true
        }
      }, [runScan])

      useEffect(() => {
        if (!loaded) return undefined
        if (skipNextSave.current) {
          skipNextSave.current = false
          return undefined
        }
        setSaveState('saving')
        const timer = window.setTimeout(() => {
          request('/state', { method: 'POST', body: JSON.stringify({ state }) })
            .then((data) => {
              setSaveState('saved')
              setSavedAt(data.savedAt || Date.now())
              setServiceError('')
            })
            .catch((error) => {
              setSaveState('error')
              setServiceError(messageOf(error))
            })
        }, 600)
        return () => window.clearTimeout(timer)
      }, [state, loaded])

      const setFolder = useCallback((value) => {
        setState((current) => ({ ...current, folder: value }))
      }, [])

      const setParam = useCallback((key, value) => {
        setState((current) => ({
          ...current,
          params: { ...current.params, [key]: value },
        }))
      }, [])

      const setPlatforms = useCallback((next) => {
        setState((current) => ({ ...current, platforms: next }))
      }, [])

      const setCustomGenres = useCallback((next) => {
        setState((current) => ({ ...current, customGenres: next }))
      }, [])

      const setLocalNovel = useCallback((next) => {
        setState((current) => ({ ...current, localNovel: next }))
      }, [])

      const browse = useCallback(async () => {
        if (!pickDirectory) {
          setScanError(t('folder.pickerUnavailable'))
          return
        }
        try {
          const picked = await pickDirectory()
          if (!picked) return
          setState((current) => ({ ...current, folder: picked }))
          await runScan(picked)
        } catch (error) {
          setScanError(messageOf(error))
        }
      }, [pickDirectory, runScan, t])

      const clearFolder = useCallback(() => {
        setState((current) => ({ ...current, folder: '' }))
        setScan(null)
        setScanError('')
      }, [])

      const params = state.params
      const bound = state.folder.trim().length > 0
      const povOption = POV_OPTIONS.find((option) => option.value === params.pov) || POV_OPTIONS[1]

      let saveLabel = t('save.idle')
      if (saveState === 'saving') saveLabel = t('save.saving')
      else if (saveState === 'saved') saveLabel = t('save.saved')
      else if (saveState === 'error') saveLabel = t('save.error')

      const savedClock = saveState === 'saved' && savedAt ? clockOf(savedAt) : ''

      const workContent = [
        h(
          'div',
          { className: 'nvassist-quick', key: 'quick' },
          h(QuickChip, { label: t('field.title'), value: params.title.trim() || t('quick.untitled') }),
          h(QuickChip, { label: t('field.genre'), value: params.genre.trim() || t('quick.none') }),
          h(QuickChip, { label: t('field.pov'), value: t(povOption.key) }),
          h(QuickChip, { label: t('field.words'), value: params.words.trim() || t('quick.none') }),
        ),
        serviceError
          ? h(
              'div',
              { className: 'nvassist-banner', role: 'alert', key: 'banner' },
              h('strong', null, t('service.error')),
              h('span', null, serviceError),
            )
          : null,
        h(
          Section,
          { title: t('folder.title'), hint: null, key: 'folder' },
          h(
            'div',
            { className: 'nvassist-folder-row' },
            h('div', { className: 'nvassist-folder-badge' }, h(BookIcon, { size: 22 })),
            h(
              'div',
              { className: 'nvassist-folder-main' },
              h(
                'div',
                { className: 'nvassist-folder-line' },
                h('span', { className: bound ? 'nvassist-dot on' : 'nvassist-dot' }),
                h('span', { className: 'nvassist-status-label' }, bound ? t('folder.bound') : t('folder.unbound')),
                scan && scan.exists ? h('span', { className: 'nvassist-meta' }, `${t('folder.updated')} ${clockOf(scan.scannedAt)}`) : null,
                bound ? h('button', { type: 'button', className: 'nvassist-link', onClick: clearFolder }, t('folder.clear')) : null,
              ),
              h('div', { className: bound ? 'nvassist-path' : 'nvassist-path muted' }, state.folder.trim() || t('folder.empty')),
              h('p', { className: 'nvassist-hint' }, t('folder.hint')),
            ),
          ),
          h(
            'div',
            { className: 'nvassist-path-edit' },
            h('input', {
              className: 'nvassist-control nvassist-path-input',
              type: 'text',
              value: state.folder,
              placeholder: t('folder.placeholder'),
              spellCheck: false,
              'aria-label': t('folder.title'),
              onChange: (event) => setFolder(event.target.value),
              onKeyDown: (event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                runScan(event.currentTarget.value)
              },
            }),
            h('button', { type: 'button', className: 'nvassist-btn primary', onClick: browse }, t('folder.browse')),
            h(
              'button',
              {
                type: 'button',
                className: 'nvassist-btn',
                disabled: scanning || !bound,
                onClick: () => runScan(state.folder),
              },
              scanning ? t('folder.scanning') : t('folder.scan'),
            ),
          ),
          scanError ? h('p', { className: 'nvassist-error', role: 'alert' }, scanError) : null,
          scan && scan.exists && scan.isDirectory
            ? h(
                'div',
                { className: 'nvassist-stats' },
                h(Stat, { value: scan.folders, label: t('stats.folders') }),
                h(Stat, { value: scan.files, label: t('stats.files') }),
                h(Stat, { value: scan.chapters, label: t('stats.chapters') }),
                h(Stat, { value: scan.words, label: t('stats.words') }),
              )
            : null,
          scan && scan.truncated ? h('p', { className: 'nvassist-hint' }, t('folder.truncated')) : null,
        ),
        h(
          Section,
          { title: t('section.basic'), hint: t('section.basicHint'), key: 'basic' },
          h(
            'div',
            { className: 'nvassist-grid' },
            h(TextField, {
              id: 'nvassist-title',
              label: t('field.title'),
              value: params.title,
              placeholder: t('field.title.ph'),
              onChange: (value) => setParam('title', value),
            }),
            h(TextField, {
              id: 'nvassist-genre',
              label: t('field.genre'),
              value: params.genre,
              placeholder: t('field.genre.ph'),
              onChange: (value) => setParam('genre', value),
            }),
            h(SelectField, {
              id: 'nvassist-pov',
              label: t('field.pov'),
              value: params.pov,
              options: POV_OPTIONS,
              onChange: (value) => setParam('pov', value),
              t,
            }),
            h(SelectField, {
              id: 'nvassist-tone',
              label: t('field.tone'),
              value: params.tone,
              options: TONE_OPTIONS,
              onChange: (value) => setParam('tone', value),
              t,
            }),
            h(TextField, {
              id: 'nvassist-words',
              label: t('field.words'),
              value: params.words,
              placeholder: t('field.words.ph'),
              onChange: (value) => setParam('words', value),
            }),
            h(TextField, {
              id: 'nvassist-chapter-words',
              label: t('field.chapterWords'),
              value: params.chapterWords,
              placeholder: t('field.chapterWords.ph'),
              onChange: (value) => setParam('chapterWords', value),
            }),
            h(TextField, {
              id: 'nvassist-cadence',
              label: t('field.cadence'),
              value: params.cadence,
              placeholder: t('field.cadence.ph'),
              onChange: (value) => setParam('cadence', value),
            }),
          ),
        ),
        h(
          Section,
          { title: t('section.setup'), hint: t('section.setupHint'), key: 'setup' },
          h(
            'div',
            { className: 'nvassist-grid' },
            h(TextField, {
              id: 'nvassist-pitch',
              label: t('field.pitch'),
              value: params.pitch,
              placeholder: t('field.pitch.ph'),
              multiline: true,
              onChange: (value) => setParam('pitch', value),
            }),
            h(TextField, {
              id: 'nvassist-conflict',
              label: t('field.conflict'),
              value: params.conflict,
              placeholder: t('field.conflict.ph'),
              multiline: true,
              onChange: (value) => setParam('conflict', value),
            }),
            h(TextField, {
              id: 'nvassist-world',
              label: t('field.world'),
              value: params.world,
              placeholder: t('field.world.ph'),
              onChange: (value) => setParam('world', value),
            }),
            h(TextField, {
              id: 'nvassist-characters',
              label: t('field.characters'),
              value: params.characters,
              placeholder: t('field.characters.ph'),
              multiline: true,
              onChange: (value) => setParam('characters', value),
            }),
            h(TextField, {
              id: 'nvassist-taboo',
              label: t('field.taboo'),
              value: params.taboo,
              placeholder: t('field.taboo.ph'),
              multiline: true,
              onChange: (value) => setParam('taboo', value),
            }),
          ),
        ),
        h(
          Section,
          { title: t('section.sim'), hint: t('section.simHint'), key: 'sim' },
          h(
            'div',
            { className: 'nvassist-grid' },
            h(RangeField, {
              id: 'nvassist-patience',
              label: t('sim.patience'),
              value: params.patience,
              low: t('sim.low'),
              high: t('sim.high'),
              onChange: (value) => setParam('patience', value),
            }),
            h(RangeField, {
              id: 'nvassist-pleasure',
              label: t('sim.pleasure'),
              value: params.pleasure,
              low: t('sim.low'),
              high: t('sim.high'),
              onChange: (value) => setParam('pleasure', value),
            }),
            h(RangeField, {
              id: 'nvassist-pacing',
              label: t('sim.pacing'),
              value: params.pacing,
              low: t('sim.low'),
              high: t('sim.high'),
              onChange: (value) => setParam('pacing', value),
            }),
          ),
        ),
        h('p', { className: 'nvassist-foot', key: 'foot' }, storagePath || t('foot.storage')),
      ]

      return h(
        'div',
        { className: 'nvassist-root', 'data-dsh-plugin': 'dsh-novel-assist' },
        h('style', { key: 'nvassist-style' }, STYLES),
        h('div', { className: 'nvassist-drag', 'data-window-drag': true, 'aria-hidden': true }),
        h(
          'header',
          { className: 'nvassist-head' },
          h(
            'div',
            { className: 'nvassist-head-main' },
            h('div', { className: 'nvassist-eyebrow' }, t('panel.eyebrow')),
            h('h1', { className: 'nvassist-title' }, t('panel.title')),
            h('p', { className: 'nvassist-sub' }, t('panel.subtitle')),
          ),
          h(
            'div',
            { className: 'nvassist-head-side' },
            tab === TABS.work
              ? h(
                  'span',
                  { className: `nvassist-save ${saveState}` },
                  h('span', { className: 'nvassist-save-dot' }),
                  savedClock ? `${saveLabel} · ${savedClock}` : saveLabel,
                )
              : null,
            h('button', { type: 'button', className: 'nvassist-btn ghost', onClick: goConversation }, t('panel.back')),
          ),
        ),
        h(
          'div',
          { className: 'nvassist-tabs', role: 'tablist' },
          h(TabButton, { active: tab === TABS.work, onClick: () => setTab(TABS.work) }, t('tab.work')),
          h(TabButton, { active: tab === TABS.skills, onClick: () => setTab(TABS.skills) }, t('tab.skills')),
          h(TabButton, { active: tab === TABS.rank, onClick: () => setTab(TABS.rank) }, t('tab.rank')),
        ),
        h('div', { className: 'nvassist-scroll' }, tab === TABS.skills
          ? h(SkillsStudio, { t, pickDirectory })
          : tab === TABS.rank
            ? h(RankTab, {
                t,
                pickDirectory,
                customPlatforms: state.platforms,
                onPlatformsChange: setPlatforms,
                customGenres: state.customGenres,
                onCustomGenresChange: setCustomGenres,
                localNovel: state.localNovel,
                onLocalNovelChange: setLocalNovel,
              })
            : workContent),
      )
    }

    const STYLES = `
      .nvassist-root {
        height: 100%;
        min-height: 0;
        box-sizing: border-box;
        padding-block-start: var(--dsh-frame-top-clearance, 0px);
        position: relative;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: var(--dsw-alias-bg-base);
        color: var(--dsw-alias-label-primary);
        font-size: 14px;
        line-height: 1.5;
      }
      .nvassist-drag {
        height: var(--dsh-frame-top-clearance, 0px);
        position: absolute;
        inset: 0 0 auto;
        -webkit-app-region: drag;
      }
      .nvassist-head {
        flex: none;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 32px 12px;
      }
      .nvassist-eyebrow {
        font-size: 10.5px;
        letter-spacing: 0.16em;
        font-weight: 600;
        color: var(--dsw-alias-label-tertiary);
      }
      .nvassist-title { margin: 3px 0 2px; font-size: 19px; font-weight: 600; }
      .nvassist-sub { margin: 0; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
      .nvassist-head-side { display: flex; align-items: center; gap: 10px; padding-top: 10px; }
      .nvassist-save {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11.5px;
        color: var(--dsw-alias-label-tertiary);
        white-space: nowrap;
      }
      .nvassist-save-dot {
        width: 6px; height: 6px; border-radius: 50%;
        background: var(--dsw-alias-state-idle-primary);
      }
      .nvassist-save.saving .nvassist-save-dot { background: var(--dsw-alias-state-warn-primary); }
      .nvassist-save.saved .nvassist-save-dot { background: var(--dsw-alias-state-success-primary); }
      .nvassist-save.error .nvassist-save-dot { background: var(--dsw-alias-state-error-primary); }
      .nvassist-tabs {
        flex: none;
        display: flex;
        gap: 4px;
        padding: 0 32px;
        border-bottom: 1px solid var(--dsw-alias-border-l1);
      }
      .nvassist-tab {
        border: 0;
        background: none;
        color: var(--dsw-alias-label-tertiary);
        font-family: inherit;
        font-size: 13px;
        padding: 9px 2px 10px;
        margin-right: 20px;
        border-bottom: 2px solid transparent;
        cursor: pointer;
      }
      .nvassist-tab:hover { color: var(--dsw-alias-label-secondary); }
      .nvassist-tab.active {
        color: var(--dsw-alias-label-primary);
        border-bottom-color: var(--dsw-alias-brand-primary);
        font-weight: 600;
      }
      .nvassist-tab:focus-visible {
        outline: 2px solid var(--dsw-alias-brand-primary);
        outline-offset: -1px;
        border-radius: 4px;
      }
      .nvassist-scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 16px 32px 40px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .nvassist-quick { display: flex; flex-wrap: wrap; gap: 8px; }
      .nvassist-chip {
        display: inline-flex;
        align-items: baseline;
        gap: 7px;
        padding: 4px 11px;
        border-radius: 999px;
        border: 1px solid var(--dsw-alias-border-l1);
        background: var(--dsw-alias-bg-layer-2);
        font-size: 11.5px;
        color: var(--dsw-alias-label-tertiary);
        max-width: 100%;
      }
      .nvassist-chip b { color: var(--dsw-alias-label-primary); font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
      .nvassist-card {
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 12px;
        background: var(--dsw-alias-bg-layer-1);
        padding: 15px 18px 17px;
      }
      .nvassist-card-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 13px;
      }
      .nvassist-card-title { margin: 0; font-size: 13.5px; font-weight: 600; }
      .nvassist-card-hint { margin: 2px 0 0; font-size: 11.5px; color: var(--dsw-alias-label-tertiary); }
      .nvassist-count { font-weight: 400; font-size: 11.5px; color: var(--dsw-alias-label-tertiary); }
      .nvassist-root-note { margin: -4px 0 12px; word-break: break-all; }
      .nvassist-root-note code { font-size: 11px; }
      .nvassist-folder-row { display: flex; align-items: flex-start; gap: 13px; }
      .nvassist-folder-badge {
        flex: none;
        width: 42px; height: 42px;
        display: grid; place-items: center;
        border-radius: 11px;
        border: 1px solid var(--dsw-alias-border-l1);
        background: var(--dsw-alias-bg-layer-2);
        color: var(--dsw-alias-brand-primary);
      }
      .nvassist-folder-main { flex: 1; min-width: 0; }
      .nvassist-folder-line { display: flex; align-items: center; gap: 8px; }
      .nvassist-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--dsw-alias-state-idle-primary); flex: none; }
      .nvassist-dot.on { background: var(--dsw-alias-state-success-primary); }
      .nvassist-status-label { font-size: 12px; font-weight: 600; }
      .nvassist-meta { font-size: 11.5px; color: var(--dsw-alias-label-tertiary); }
      .nvassist-path {
        margin: 5px 0 7px;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 12.5px;
        word-break: break-all;
        color: var(--dsw-alias-label-primary);
      }
      .nvassist-path.muted { color: var(--dsw-alias-label-tertiary); }
      .nvassist-hint { margin: 0; font-size: 11.5px; color: var(--dsw-alias-label-tertiary); }
      .nvassist-link {
        border: 0;
        background: none;
        color: var(--dsw-alias-link);
        font-size: 11.5px;
        cursor: pointer;
        padding: 0;
        text-decoration: none;
        white-space: nowrap;
      }
      .nvassist-link:hover { text-decoration: underline; }
      .nvassist-path-edit { display: flex; gap: 8px; margin-top: 13px; flex-wrap: wrap; }
      .nvassist-path-input { flex: 1; min-width: 220px; }
      .nvassist-btn {
        flex: none;
        border: 1px solid var(--dsw-alias-border-l2);
        background: var(--dsw-alias-bg-layer-1);
        color: var(--dsw-alias-label-primary);
        border-radius: 8px;
        padding: 7px 13px;
        font-size: 12.5px;
        font-family: inherit;
        cursor: pointer;
      }
      .nvassist-btn.small { padding: 5px 11px; font-size: 12px; }
      .nvassist-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }
      .nvassist-btn.primary {
        border-color: transparent;
        background: var(--dsw-alias-button-primary-fill);
        color: var(--dsw-alias-label-primary-inverted);
        font-weight: 500;
      }
      .nvassist-btn.primary:hover { background: var(--dsw-alias-button-primary-hover); }
      .nvassist-btn.ghost { background: transparent; color: var(--dsw-alias-label-secondary); }
      .nvassist-btn:disabled { opacity: 0.45; cursor: not-allowed; }
      .nvassist-control {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 8px;
        background: var(--dsw-specific-input-major, var(--dsw-alias-bg-layer-2));
        color: var(--dsw-alias-label-primary);
        padding: 7px 10px;
        font-size: 12.5px;
        font-family: inherit;
        line-height: 1.45;
      }
      .nvassist-control:focus {
        outline: 2px solid var(--dsw-alias-brand-primary);
        outline-offset: -1px;
        border-color: transparent;
      }
      textarea.nvassist-control { resize: vertical; min-height: 62px; }
      .nvassist-stats {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
        margin-top: 14px;
      }
      .nvassist-stat {
        border-radius: 9px;
        background: var(--dsw-alias-bg-layer-2);
        padding: 8px 11px;
        min-width: 0;
      }
      .nvassist-stat b {
        display: block;
        font-size: 15.5px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .nvassist-stat span { font-size: 11px; color: var(--dsw-alias-label-tertiary); }
      .nvassist-error {
        margin: 10px 0 0;
        font-size: 12px;
        color: var(--dsw-alias-state-error-primary);
      }
      .nvassist-banner {
        display: flex;
        flex-direction: column;
        gap: 2px;
        border: 1px solid var(--dsw-alias-state-error-primary);
        border-radius: 9px;
        padding: 9px 12px;
        font-size: 12px;
        color: var(--dsw-alias-state-error-primary);
        background: var(--dsw-alias-bg-layer-1);
      }
      .nvassist-banner span { opacity: 0.8; }
      .nvassist-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
        gap: 12px 16px;
      }
      .nvassist-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
      .nvassist-field.wide { grid-column: 1 / -1; }
      .nvassist-field > label { font-size: 11.5px; color: var(--dsw-alias-label-secondary); font-weight: 500; }
      .nvassist-range-row { display: flex; align-items: center; gap: 10px; }
      .nvassist-range { flex: 1; accent-color: var(--dsw-alias-brand-primary); min-width: 0; }
      .nvassist-range-value {
        min-width: 30px;
        text-align: right;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        color: var(--dsw-alias-label-secondary);
      }
      .nvassist-scale {
        display: flex;
        justify-content: space-between;
        font-size: 10.5px;
        color: var(--dsw-alias-label-tertiary);
      }
      .nvassist-foot { margin: 2px 0 0; font-size: 11px; color: var(--dsw-alias-label-tertiary); word-break: break-all; }

      /* skills tab */
      .nvassist-import { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
      .nvassist-import-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .nvassist-import-row .nvassist-control { flex: 1; min-width: 220px; }
      .nvassist-notice {
        display: flex;
        flex-direction: column;
        gap: 2px;
        border-radius: 9px;
        padding: 8px 12px;
        font-size: 12px;
        margin: 10px 0;
        border: 1px solid var(--dsw-alias-border-l1);
        background: var(--dsw-alias-bg-layer-2);
      }
      .nvassist-notice.ok { border-color: var(--dsw-alias-state-success-primary); color: var(--dsw-alias-state-success-primary); }
      .nvassist-notice.err { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
      .nvassist-notice span { color: var(--dsw-alias-label-tertiary); }
      .nvassist-empty {
        border: 1px dashed var(--dsw-alias-border-l2);
        border-radius: 10px;
        padding: 16px;
        text-align: center;
        color: var(--dsw-alias-label-secondary);
        font-size: 12.5px;
      }
      .nvassist-empty p { margin: 4px 0 0; color: var(--dsw-alias-label-tertiary); font-size: 11.5px; }
      .nvassist-skill-list { display: flex; flex-direction: column; gap: 8px; }
      .nvassist-skill {
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 10px;
        padding: 10px 12px;
        background: var(--dsw-alias-bg-layer-2);
      }
      .nvassist-skill-line { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
      .nvassist-skill-name { font-size: 12.5px; font-weight: 600; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
      .nvassist-skill-remove { margin-left: auto; }
      .nvassist-link.danger { color: var(--dsw-alias-state-error-primary); }
      .nvassist-badge {
        font-size: 10px;
        padding: 1px 7px;
        border-radius: 999px;
        border: 1px solid var(--dsw-alias-border-l1);
        color: var(--dsw-alias-label-tertiary);
        white-space: nowrap;
      }
      .nvassist-badge.accent {
        color: var(--dsw-alias-brand-primary);
        border-color: var(--dsw-alias-brand-primary);
      }
      .nvassist-badge.warn {
        color: var(--dsw-alias-state-warn-primary);
        border-color: var(--dsw-alias-state-warn-primary);
      }
      .nvassist-skill-desc {
        margin: 5px 0 3px;
        font-size: 12px;
        color: var(--dsw-alias-label-secondary);
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .nvassist-skill-meta { margin: 0; font-size: 11px; color: var(--dsw-alias-label-tertiary); }
      .nvassist-warning { margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--dsw-alias-border-l1); }
      .nvassist-search-row { margin-bottom: 8px; }
      .nvassist-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
      .nvassist-chip-btn {
        border: 1px solid var(--dsw-alias-border-l1);
        background: var(--dsw-alias-bg-layer-2);
        color: var(--dsw-alias-label-secondary);
        border-radius: 999px;
        padding: 4px 11px;
        font-size: 11.5px;
        font-family: inherit;
        cursor: pointer;
      }
      .nvassist-chip-btn:hover { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
      .nvassist-market {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 10px;
      }
      .nvassist-market-card {
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 10px;
        padding: 11px 13px;
        background: var(--dsw-alias-bg-layer-2);
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
      }
      .nvassist-market-head { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
      .nvassist-market-repo {
        font-size: 11.5px;
        color: var(--dsw-alias-label-tertiary);
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .nvassist-stars { font-size: 11px; color: var(--dsw-alias-state-warn-primary); }
      .nvassist-market-title { font-size: 13px; }
      .nvassist-market-desc {
        margin: 0;
        font-size: 12px;
        color: var(--dsw-alias-label-secondary);
        display: -webkit-box;
        -webkit-line-clamp: 4;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .nvassist-tags { display: flex; flex-wrap: wrap; gap: 5px; }
      .nvassist-tag {
        font-size: 10.5px;
        padding: 0 7px;
        border-radius: 5px;
        background: var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-1));
        color: var(--dsw-alias-label-tertiary);
      }
      .nvassist-market-actions { display: flex; align-items: center; gap: 12px; margin-top: 2px; }
      .nvassist-choices {
        margin-top: 10px;
        border-top: 1px dashed var(--dsw-alias-border-l1);
        padding-top: 9px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 220px;
        overflow-y: auto;
      }
      .nvassist-choice {
        display: flex;
        align-items: baseline;
        gap: 10px;
        text-align: left;
        border: 1px solid var(--dsw-alias-border-l1);
        background: var(--dsw-alias-bg-layer-1);
        color: var(--dsw-alias-label-primary);
        border-radius: 8px;
        padding: 6px 10px;
        font-family: inherit;
        font-size: 12px;
        cursor: pointer;
      }
      .nvassist-choice:hover { border-color: var(--dsw-alias-brand-primary); }
      .nvassist-choice span { color: var(--dsw-alias-label-tertiary); font-size: 11px; overflow: hidden; text-overflow: ellipsis; }

      /* rankings tab */
      .nvassist-rank-root {
        display: flex;
        flex-direction: column;
        gap: 14px;
        font-family: "FangSong", "仿宋", "FangSong_GB2312", "STFangsong", "Noto Serif CJK SC", "SimSun", serif;
      }
      .nvassist-rank-root .nvassist-control,
      .nvassist-rank-root .nvassist-btn,
      .nvassist-rank-root .nvassist-rank-chip,
      .nvassist-rank-root .nvassist-rank-label,
      .nvassist-rank-root code {
        font-family: "FangSong", "仿宋", "FangSong_GB2312", "STFangsong", "Noto Serif CJK SC", "SimSun", serif;
      }
      .nvassist-rank-chips.collapsed {
        max-height: 30px;
        overflow: hidden;
      }
      .nvassist-rank-tools {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
        margin-top: 7px;
      }
      .nvassist-rank-custom-row { margin-top: 7px; }
      .nvassist-fulltext {
        margin-top: 6px;
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 8px;
        background: var(--dsw-alias-bg-layer-1);
        padding: 6px 9px;
      }
      .nvassist-fulltext summary {
        cursor: pointer;
        font-size: 11.5px;
        color: var(--dsw-alias-link);
        outline: none;
      }
      .nvassist-chapter { margin-top: 8px; }
      .nvassist-chapter-title {
        font-size: 12px;
        font-weight: 600;
        color: var(--dsw-alias-label-primary);
        margin-bottom: 3px;
      }
      .nvassist-chapter-text {
        margin: 0;
        font-size: 12.5px;
        line-height: 1.75;
        color: var(--dsw-alias-label-secondary);
        white-space: pre-wrap;
        max-height: 200px;
        overflow-y: auto;
        padding-right: 4px;
      }
      .nvassist-skillpicker {
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 9px;
        background: var(--dsw-alias-bg-layer-2);
        padding: 10px 12px;
        margin-bottom: 12px;
        display: flex;
        flex-direction: column;
        gap: 7px;
        max-height: 240px;
        overflow-y: auto;
      }
      .nvassist-skillpick {
        display: flex;
        align-items: baseline;
        gap: 8px;
        font-size: 12px;
        cursor: pointer;
      }
      .nvassist-skillpick span {
        color: var(--dsw-alias-label-tertiary);
        font-size: 11px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .nvassist-rank-section { margin-bottom: 14px; }
      .nvassist-rank-label {
        margin: 0 0 7px;
        font-size: 11.5px;
        font-weight: 600;
        color: var(--dsw-alias-label-secondary);
      }
      .nvassist-rank-chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
      .nvassist-rank-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 9px;
        border-radius: 999px;
        border: 1px solid var(--dsw-alias-border-l1);
        background: var(--dsw-alias-bg-layer-2);
        font-size: 11.5px;
        color: var(--dsw-alias-label-secondary);
      }
      .nvassist-rank-chip.active {
        border-color: var(--dsw-alias-brand-primary);
        color: var(--dsw-alias-brand-primary);
        background: var(--dsw-alias-bg-layer-1);
      }
      .nvassist-rank-chip input[type='checkbox'] { accent-color: var(--dsw-alias-brand-primary); margin: 0; }
      .nvassist-rank-check { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
      .nvassist-rank-link {
        color: var(--dsw-alias-link);
        text-decoration: none;
        font-size: 11.5px;
        line-height: 1;
      }
      .nvassist-rank-link:hover { text-decoration: underline; }
      .nvassist-rank-x {
        border: 0;
        background: none;
        color: var(--dsw-alias-label-tertiary);
        cursor: pointer;
        font-size: 13px;
        line-height: 1;
        padding: 0 2px;
      }
      .nvassist-rank-x:hover { color: var(--dsw-alias-state-error-primary); }
      .nvassist-custom-form {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
        margin-top: 9px;
      }
      .nvassist-custom-form .nvassist-control { flex: 1; min-width: 160px; width: auto; }
      .nvassist-rank-controls {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 10px;
      }
      .nvassist-rank-control {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-size: 11.5px;
        color: var(--dsw-alias-label-secondary);
      }
      .nvassist-rank-control .nvassist-control { width: auto; padding: 5px 8px; }
      .nvassist-rank-status {
        display: flex;
        flex-direction: column;
        gap: 2px;
        border-left: 3px solid var(--dsw-alias-border-l2);
        padding: 3px 0 3px 9px;
        margin-bottom: 8px;
        font-size: 12px;
      }
      .nvassist-rank-status b { font-size: 12px; font-weight: 600; }
      .nvassist-rank-status span { color: var(--dsw-alias-label-tertiary); font-size: 11px; }
      .nvassist-rank-status.ok { border-left-color: var(--dsw-alias-state-success-primary); }
      .nvassist-rank-status.fail { border-left-color: var(--dsw-alias-state-error-primary); }
      .nvassist-rank-status.fail span { color: var(--dsw-alias-state-error-primary); }
      .nvassist-rank-genre { margin-bottom: 16px; }
      .nvassist-rank-genre:last-child { margin-bottom: 0; }
      .nvassist-rank-genre-name {
        margin: 12px 0 7px;
        font-size: 12.5px;
        font-weight: 600;
        color: var(--dsw-alias-brand-primary);
      }
      .nvassist-rank-genre-name:first-child { margin-top: 0; }
      .nvassist-rank-book {
        border-top: 1px solid var(--dsw-alias-border-l1);
        padding: 8px 0;
      }
      .nvassist-rank-book:first-of-type { border-top: 0; }
      .nvassist-rank-book-line { display: flex; align-items: baseline; gap: 7px; flex-wrap: wrap; }
      .nvassist-rank-book-line strong { font-size: 12.5px; font-weight: 600; }
      .nvassist-rank-no {
        font-size: 10.5px;
        color: var(--dsw-alias-label-tertiary);
        font-variant-numeric: tabular-nums;
        min-width: 22px;
      }
      .nvassist-rank-author { font-size: 11px; color: var(--dsw-alias-label-tertiary); }
      .nvassist-rank-book-desc {
        margin: 3px 0 0;
        font-size: 11.5px;
        color: var(--dsw-alias-label-secondary);
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .nvassist-rank-book-meta { margin: 3px 0 0; font-size: 10.5px; color: var(--dsw-alias-label-tertiary); }
      .nvassist-rank-chapters {
        margin: 4px 0 0;
        font-size: 10.5px;
        color: var(--dsw-alias-label-tertiary);
        line-height: 1.5;
      }
      .nvassist-arch {
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 10px;
        background: var(--dsw-alias-bg-layer-2);
        padding: 10px 12px;
        margin-bottom: 9px;
      }
      .nvassist-arch-name { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
      .nvassist-arch-summary { margin: 0 0 6px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
      .nvassist-arch-why { margin: 6px 0 0; font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
      .nvassist-arch-books { margin: 5px 0 0; font-size: 11px; color: var(--dsw-alias-label-tertiary); }
      .nvassist-arch-takeaway {
        margin: 8px 0 0;
        padding: 7px 10px;
        border-radius: 8px;
        background: var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-2));
        font-size: 11.5px;
        color: var(--dsw-alias-label-primary);
      }
      .nvassist-arch-cross {
        margin: 10px 0 0;
        padding: 8px 10px;
        border-left: 3px solid var(--dsw-alias-brand-primary);
        border-radius: 6px;
        background: var(--dsw-alias-bg-layer-2);
        font-size: 11.5px;
        color: var(--dsw-alias-label-primary);
      }
      .nvassist-analysis-raw {
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 11.5px;
        margin: 8px 0 0;
        padding: 9px 11px;
        border-radius: 8px;
        background: var(--dsw-alias-bg-layer-2);
        color: var(--dsw-alias-label-secondary);
        max-height: 260px;
        overflow-y: auto;
      }
      .nvassist-rank-analysis { margin-bottom: 14px; }
      .nvassist-local {
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px dashed var(--dsw-alias-border-l1);
      }
      .nvassist-local-path {
        margin: 4px 0;
        font-size: 10.5px;
        color: var(--dsw-alias-label-tertiary);
        word-break: break-all;
      }
      .nvassist-local-synopsis {
        margin: 5px 0;
        font-size: 12px;
        color: var(--dsw-alias-label-secondary);
      }
      .nvassist-local-chapters {
        margin: 6px 0 0;
        font-size: 11.5px;
        color: var(--dsw-alias-label-secondary);
        line-height: 1.6;
      }
      .nvassist-local-actions { display: flex; gap: 8px; margin-top: 9px; }
      .nvassist-local-result { margin-top: 10px; }
      .nvassist-rank-source { margin: 4px 0 0; font-size: 11px; }
      .nvassist-rank-source a { color: var(--dsw-alias-link); text-decoration: none; }
      .nvassist-rank-source a:hover { text-decoration: underline; }
      .nvassist-rank-source span { color: var(--dsw-alias-label-tertiary); font-size: 10.5px; }
      @media (max-width: 760px) {
        .nvassist-head { padding-left: 18px; padding-right: 18px; }
        .nvassist-tabs { padding-left: 18px; padding-right: 18px; }
        .nvassist-scroll { padding-left: 18px; padding-right: 18px; }
        .nvassist-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .nvassist-head-side { flex-direction: column; align-items: flex-end; }
      }
    `

    return {
      inject: ['slots', 'locale', 'layout', 'uiWorkspace'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'novel-assist: locale dictionaries')
        const t = ctx.locale.bind(NS)

        function Page(props) {
          return h(NovelPanel, {
            ...props,
            t,
            pickDirectory: () => ctx.uiWorkspace.pickDirectory(),
            goConversation: () => ctx.layout.selectPanel('conversation'),
          })
        }

        ctx.slots.inject('main', () =>
          ctx.slots.inject('sidebar.panellist', () => {
            const stopMain = ctx.slots.register({ name: 'main', key: PANEL_ID }, Page)
            let stopIcon
            try {
              stopIcon = ctx.slots.register(
                {
                  name: 'sidebar.panellist',
                  id: PANEL_ID,
                  order: 35,
                  label: () => t('nav.label'),
                  locale: NS,
                },
                SidebarIcon,
              )
            } catch (error) {
              stopMain()
              throw error
            }
            return () => {
              stopIcon()
              stopMain()
            }
          }),
        )
      },
    }
  },
})
