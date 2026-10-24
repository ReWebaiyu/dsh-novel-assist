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
    