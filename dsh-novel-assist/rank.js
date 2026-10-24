/**
 * Platform ranking research for Novel Assist.
 *
 * Fetches public ranking pages, takes the top new books of the requested
 * categories, collects the evidence each platform actually exposes (ranking
 * metadata, synopsis, chapter titles; 番茄正文有字体混淆，书旗章节接口可能限流),
 * and asks the configured LLM to group the books by story architecture.
 */
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { homedir } from 'node:os'

const API_PREFIX = '/novel-assist/api'
const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const USER_SKILLS_ROOT = join(DSH_HOME, 'skills')
const RANK_CACHE_DIR = join(DSH_HOME, 'novel-assist')
const RANK_CACHE_FILE = join(RANK_CACHE_DIR, 'rank-last.json')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
const FETCH_TIMEOUT = 25_000
const MAX_TARGETS = 9
const MAX_BOOKS = 45

const CORE_GENRES = [
  { id: 'xuanhuan', label: '传统玄幻', gender: 1, category: 258, keywords: ['玄幻', '东方玄幻', '传统玄幻'] },
  { id: 'xuanyi', label: '悬疑', gender: 1, category: 539, keywords: ['悬疑', '灵异', '推理'] },
  { id: 'gaowu', label: '都市高武', gender: 1, category: 1014, keywords: ['高武', '异能'] },
  { id: 'naodong', label: '脑洞', gender: 1, category: 257, keywords: ['脑洞'] },
  { id: 'shaonao', label: '烧脑', gender: 1, category: 539, keywords: ['悬疑', '推理', '脑洞'], note: '番茄没有独立「烧脑」分区，近似取悬疑脑洞' },
  { id: 'xianxia', label: '仙侠', gender: 1, category: 1140, keywords: ['仙侠', '修真'] },
  { id: 'kehuan', label: '科幻', gender: 1, category: 8, keywords: ['科幻', '末世'] },
  { id: 'lishi', label: '历史', gender: 1, category: 273, keywords: ['历史', '古代'] },
  { id: 'dushi', label: '都市', gender: 1, category: 261, keywords: ['都市', '生活'] },
]

const FANQIE_EXTRA = [
  [1, 1016, '男频衍生'], [1, 1141, '西方奇幻'], [1, 124, '都市修真'], [1, 262, '都市脑洞'],
  [1, 263, '都市种田'], [1, 27, '战神赘婿'], [1, 272, '历史脑洞'], [1, 504, '抗战谍战'],
  [1, 718, '动漫衍生'], [1, 746, '游戏体育'], [1, 751, '悬疑灵异'],
  [0, 1015, '女频衍生'], [0, 1017, '民国言情'], [0, 1139, '古风世情'], [0, 23, '种田'],
  [0, 24, '快穿'], [0, 246, '宫斗宅斗'], [0, 248, '玄幻言情'], [0, 253, '古言脑洞'],
  [0, 267, '现言脑洞'], [0, 539, '悬疑脑洞'], [0, 745, '星光璀璨'], [0, 746, '游戏体育'],
  [0, 747, '女频悬疑'], [0, 748, '豪门总裁'], [0, 749, '青春甜宠'], [0, 750, '职场婚恋'],
  [0, 79, '年代'], [0, 8, '科幻末世'],
]

const GENRES = (() => {
  const list = CORE_GENRES.map((genre) => ({
    id: genre.id,
    label: genre.label,
    group: genre.gender === 1 ? '男频' : '女频',
    featured: true,
    keywords: genre.keywords,
    note: genre.note || '',
    maps: { fanqie: { gender: genre.gender, id: genre.category } },
  }))
  const used = new Set(CORE_GENRES.map((genre) => `${genre.gender}-${genre.category}`))
  const labelCount = new Map()
  for (const [gender, category, label] of FANQIE_EXTRA) {
    if (used.has(`${gender}-${category}`)) continue
    labelCount.set(label, (labelCount.get(label) || 0) + 1)
  }
  for (const [gender, category, label] of FANQIE_EXTRA) {
    if (used.has(`${gender}-${category}`)) continue
    const display = (labelCount.get(label) || 1) > 1 ? `${label}（${gender === 1 ? '男频' : '女频'}）` : label
    list.push({
      id: `fq-${gender}-${category}`,
      label: display,
      group: gender === 1 ? '男频' : '女频',
      featured: false,
      keywords: [label],
      note: '',
      maps: { fanqie: { gender, id: category } },
    })
  }
  return list
})()

const PLATFORMS = [
  {
    id: 'fanqie',
    name: '番茄小说',
    parser: 'fanqie',
    home: 'https://fanqienovel.com',
    rankUrl: 'https://fanqienovel.com/rank',
    genreMap: {
      xuanhuan: 258, xuanyi: 539, gaowu: 1014, naodong: 257, shaonao: 539,
      xianxia: 1140, kehuan: 8, lishi: 273, dushi: 261,
    },
  },
  {
    id: 'shuqi',
    name: '书旗小说',
    parser: 'shuqi',
    home: 'https://www.shuqi.com',
    rankUrl: 'https://www.shuqi.com/ranklist?rank=boyhot',
    genreMap: {},
  },
  {
    id: 'qidian',
    name: '起点中文网',
    parser: 'none',
    home: 'https://www.qidian.com',
    rankUrl: 'https://www.qidian.com/rank/newbook/',
    genreMap: {},
    note: '站点有反爬验证，自动扫描常返回 202；可打开榜单人工查看',
  },
  {
    id: 'qq',
    name: 'QQ阅读',
    parser: 'none',
    home: 'https://book.qq.com/',
    rankUrl: 'https://book.qq.com/book-rank/male-new',
    genreMap: {},
    note: '榜单由脚本渲染，服务端抓取不到书单',
  },
  {
    id: 'zongheng',
    name: '纵横中文网',
    parser: 'none',
    home: 'https://www.zongheng.com/',
    rankUrl: 'https://www.zongheng.com/rank',
    genreMap: {},
    note: '榜单由脚本渲染，服务端抓取不到书单',
  },
  {
    id: 'qimao',
    name: '七猫小说',
    parser: 'none',
    home: 'https://www.qimao.com/',
    rankUrl: 'https://www.qimao.com/rank',
    genreMap: {},
    note: '站点无法从当前网络直连',
  },
]

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 1_048_576) throw new Error('request body too large')
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function clamp(value, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return min
  return Math.max(min, Math.min(max, Math.round(number)))
}

async function fetchHtml(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': UA, 'accept-language': 'zh-CN,zh;q=0.9', accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: controller.signal,
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}${response.status === 429 ? '（请求过于频繁）' : ''}`)
    }
    return text
  } finally {
    clearTimeout(timer)
  }
}

function extractInitialState(html) {
  const marker = 'window.__INITIAL_STATE__='
  const index = html.indexOf(marker)
  if (index < 0) return null
  const start = html.indexOf('{', index)
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let cursor = start; cursor < html.length; cursor += 1) {
    const char = html[cursor]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, cursor + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function cleanText(value, html = false) {
  let text = String(value || '')
  if (html) text = text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  text = text.replace(/[\uE000-\uF8FF]/g, '')
  return text.replace(/\s+/g, ' ').trim()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
}

function cleanForSearch(value) {
  return String(value || '')
    .replace(/[□■�]/g, '')
    .replace(/[《》「」【】"'“”‘’·,.!?，。！？:：;；、\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function safeHost(url) {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

const bingCache = new Map()

async function fetchMirrorHtml(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'zh-CN,zh;q=0.9',
        referer: 'https://cn.bing.com/',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const text = await response.text()
    if (text.length > 3_000_000) throw new Error('页面过大')
    return text
  } finally {
    clearTimeout(timer)
  }
}

async function bingSearch(query) {
  const key = String(query || '').toLowerCase()
  const cached = bingCache.get(key)
  if (cached && Date.now() - cached.at < 30 * 60 * 1000) return cached.results
  const html = await fetchMirrorHtml(
    `https://cn.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-CN&ensearch=0`,
  )
  const results = []
  const seen = new Set()
  const push = (href, title) => {
    if (!href || seen.has(href)) return
    if (!/^https?:\/\//i.test(href)) return
    const host = safeHost(href)
    if (!host || /bing\.com$|microsoft\.com$|msn\.com$/i.test(host)) return
    seen.add(href)
    results.push({ url: href, title: cleanText(title, true).slice(0, 90) })
  }
  for (const match of html.matchAll(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    push(match[1], match[2])
  }
  if (!results.length) {
    for (const match of html.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]{4,90}?)<\/a>/gi)) {
      push(match[1], match[2])
    }
  }
  bingCache.set(key, { at: Date.now(), results })
  return results
}

const CN_DIGITS = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }

function cnNumber(raw) {
  const text = String(raw || '')
  if (/^\d+$/.test(text)) return Number(text)
  let total = 0
  let section = 0
  let number = 0
  for (const char of text) {
    if (CN_DIGITS[char] !== undefined) {
      number = CN_DIGITS[char]
    } else if (char === '十') {
      section += (number || 1) * 10
      number = 0
    } else if (char === '百') {
      section += (number || 1) * 100
      number = 0
    } else if (char === '千') {
      section += (number || 1) * 1000
      number = 0
    } else if (char === '万') {
      total += (section + number) * 10000
      section = 0
      number = 0
    }
  }
  return total + section + number
}

function extractDirectoryLinks(html, baseUrl) {
  const results = []
  const seen = new Set()
  const pattern = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]{1,90}?)<\/a>/gi
  let match
  while ((match = pattern.exec(html))) {
    const title = cleanText(match[2], true)
    if (!title) continue
    const parsed = title.match(/第\s*([0-9一二三四五六七八九十百千万两]+)\s*[章节回]/i)
    if (!parsed) continue
    let url
    try {
      url = new URL(match[1], baseUrl).toString()
    } catch {
      continue
    }
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue
    if (/(login|register|javascript|\.zip|\.txt)/i.test(url)) continue
    seen.add(url)
    results.push({ title: title.slice(0, 60), url, number: cnNumber(parsed[1]) })
  }
  results.sort((left, right) => (left.number || 0) - (right.number || 0))
  return results
}

function findDirectoryHref(html, baseUrl) {
  const pattern = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]{1,40}?)<\/a>/gi
  let match
  while ((match = pattern.exec(html))) {
    const text = cleanText(match[2], true)
    if (!/^(目录|章节列表|全部章节|查看目录|章节目录|返回目录)$/.test(text)) continue
    try {
      return new URL(match[1], baseUrl).toString()
    } catch {
      /* keep looking */
    }
  }
  const read = baseUrl.match(/^(https?:\/\/[^/]+)\/read\/(\d+)\/\d+\.html/i)
  if (read) return `${read[1]}/book/${read[2]}/`
  return ''
}

function extractChapterContent(html) {
  const source = String(html || '')
  const patterns = [
    /<div[^>]+id="content"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]+id="chaptercontent"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]+class="[^"]*(?:read-content|chapter-content|content|txt)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ]
  let block = ''
  for (const pattern of patterns) {
    const match = source.match(pattern)
    if (match && match[1] && match[1].length > 300) {
      block = match[1]
      break
    }
  }
  if (!block) block = source
  const text = decodeEntities(
    block
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 8 && /[\u4e00-\u9fff]/.test(line))
    .filter((line) => !/^(上一章|下一章|目录|章节列表|加入书签|返回列表|字体|背景|字号|热门推荐|本站|版权|我的书城网)/.test(line))
  const joined = lines.join('\n')
  return joined.length >= 200 ? joined : ''
}

const MIRROR_SKIP_HOSTS = /(fanqienovel|qidian|shuqi|book\.qq|zongheng|qimao|readnovel|baidu|zhihu|toutiao|weibo|xiaohongshu|douban|sina|bilibili|163\.com|qq\.com|lingyinsi|hanyuguoxue|gushiwen|zdic|baike|dict|wikipedia|so\.com)/i

function pageTitleOf(html) {
  const match = String(html || '').match(/<title>([\s\S]*?)<\/title>/i)
  return match ? cleanText(match[1]) : ''
}

async function enrichBookWithMirror(book, maxChapters) {
  const title = cleanForSearch(book.title)
  const author = cleanForSearch(book.author)
  if (title.length < 2 && author.length < 2) return null
  const query = title.length >= 2 ? `${title} ${author} 小说` : `${author} 小说`
  let results = []
  try {
    results = await bingSearch(query)
  } catch {
    return null
  }
  const candidates = results
    .filter((entry) => !MIRROR_SKIP_HOSTS.test(safeHost(entry.url)))
    .slice(0, 8)
  let fallback = null
  for (const candidate of candidates.slice(0, 8)) {
    let page
    try {
      page = await fetchMirrorHtml(candidate.url)
    } catch {
      continue
    }
    let pageTitle = pageTitleOf(page)
    let links = extractDirectoryLinks(page, candidate.url)
    if (links.length < 2) {
      const directory = findDirectoryHref(page, candidate.url)
      if (directory) {
        try {
          page = await fetchMirrorHtml(directory)
          pageTitle = pageTitleOf(page)
          links = extractDirectoryLinks(page, directory)
        } catch {
          /* keep the current page */
        }
      }
    }
    if (links.length < 2) continue
    const numbers = links.map((link) => link.number).filter((number) => Number.isFinite(number) && number > 0)
    if (!numbers.length || Math.min(...numbers) > 5) continue
    const identity = (title.length >= 2 && pageTitle.includes(title))
      || (author.length >= 2 && pageTitle.includes(author))
      || (author.length >= 2 && page.includes(author))
    if (!identity) continue
    const picked = links.slice(0, Math.min(maxChapters, 6))
    const chapters = []
    for (const link of picked) {
      try {
        const chapterPage = await fetchMirrorHtml(link.url)
        const text = extractChapterContent(chapterPage)
        if (text.length >= 150) {
          chapters.push({ title: link.title, text: text.slice(0, 1500) })
        }
      } catch {
        /* try the next chapter */
      }
      if (chapters.length >= maxChapters) break
      await sleep(120)
    }
    if (chapters.length) {
      return {
        chapters,
        sourceUrl: candidate.url,
        sourceHost: safeHost(candidate.url),
      }
    }
    if (!fallback) {
      fallback = { chapters: [], sourceUrl: candidate.url, sourceHost: safeHost(candidate.url) }
    }
  }
  return fallback
}

async function readLocalNovel(inputPath) {
  const info = await stat(inputPath)
  if (info.isFile()) {
    if (!/\.(txt|md|markdown|text)$/i.test(inputPath)) {
      throw new Error('暂支持 .txt / .md 文件，或选择一个包含 txt 的文件夹')
    }
    return { files: [inputPath], text: await readFile(inputPath, 'utf8') }
  }
  if (!info.isDirectory()) throw new Error('该路径不是文件或文件夹')
  const files = []
  async function walk(directory, depth) {
    if (depth > 2 || files.length >= 30) return
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = join(directory, entry.name)
      if (entry.isDirectory()) await walk(full, depth + 1)
      else if (/\.(txt|md|markdown)$/i.test(entry.name)) files.push(full)
    }
  }
  await walk(inputPath, 0)
  if (!files.length) throw new Error('文件夹里没有 .txt / .md 文件')
  files.sort()
  let text = ''
  for (const file of files) text += `${await readFile(file, 'utf8')}\n`
  return { files, text }
}

function splitNovelChapters(text, fallbackTitle) {
  const normalized = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n')
  const pattern = /^\s*(第\s*[0-9一二三四五六七八九十百千零两]+\s*[章节回卷部篇集]|Chapter\s+\d+)/i
  const chapters = []
  let current = null
  for (const line of lines) {
    if (pattern.test(line) && line.trim().length <= 60) {
      if (current) chapters.push(current)
      current = { title: line.trim().slice(0, 60), lines: [] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) chapters.push(current)
  if (!chapters.length) chapters.push({ title: fallbackTitle || '正文', lines })
  return chapters.map((chapter) => ({
    title: chapter.title,
    text: chapter.lines.join('\n').trim(),
  }))
}

function guessNovelTitle(text, inputPath) {
  const first = String(text || '')
    .replace(/^\uFEFF/, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)[0] || ''
  if (first && first.length <= 40 && !/^第\s*[0-9一二三四五六七八九十百千零两]+\s*[章节]/.test(first)) {
    return first
  }
  return basename(inputPath).replace(/\.(txt|md|markdown)$/i, '') || '未命名小说'
}

function localNovelInfo(inputPath, files, text) {
  const chapters = splitNovelChapters(text, guessNovelTitle(text, inputPath))
  const words = (String(text || '').match(/[\u4e00-\u9fff]/g) || []).length
  return {
    name: guessNovelTitle(text, inputPath),
    path: inputPath,
    files: files.length,
    words,
    chapterCount: chapters.length,
    chapterTitles: chapters.slice(0, 10).map((chapter) => chapter.title),
    synopsis: String(chapters[0] ? chapters[0].text : '').replace(/\s+/g, ' ').slice(0, 300),
    importedAt: Date.now(),
  }
}

async function callModel(system, prompt, ctx, maxTokens = 2400) {
  const llm = ctx.get('llm')
  if (!llm || typeof llm.stream !== 'function') throw new Error('LLM 服务不可用')
  let selection = {}
  try {
    const service = ctx.get('agentDefaultModel')
    selection = (service && service.currentSelection()) || {}
  } catch {
    selection = {}
  }
  const provider = selection.provider || 'deepseek-account'
  const model = selection.model || 'deepseek-flash'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 160_000)
  let text = ''
  try {
    for await (const chunk of llm.stream({
      provider,
      model,
      system,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      temperature: 0.35,
      maxTokens,
      signal: controller.signal,
    })) {
      if (chunk.type === 'text-delta') text += chunk.text
      else if (chunk.type === 'finish' && chunk.reason && chunk.reason.kind === 'error') {
        throw new Error((chunk.reason.failure && chunk.reason.failure.message) || '模型调用失败')
      }
    }
  } finally {
    clearTimeout(timer)
  }
  return { text, model: `${provider}/${model}` }
}

function parseJsonBlock(text) {
  const source = String(text || '')
  const start = source.indexOf('{')
  const end = source.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(source.slice(start, end + 1))
  } catch {
    return null
  }
}

async function analyzeLocalNovel(inputPath, skills, ctx) {
  const { files, text } = await readLocalNovel(inputPath)
  const info = localNovelInfo(inputPath, files, text)
  const chapters = splitNovelChapters(text, info.name).slice(0, 4)
  const digest = chapters
    .map((chapter) => `${chapter.title}\n${chapter.text.replace(/\s+/g, ' ').slice(0, 1200)}`)
    .join('\n\n')
  const skillBlock = skills.length
    ? `\n可用筛选视角（用户导入的写作技能）：\n${skills.map((skill) => `- ${skill.name}：${skill.excerpt}`).join('\n')}\n`
    : ''
  const system = [
    '你是中文网络小说的结构分析师。',
    '用户导入了一部自己下载好的小说，并提供了前几章正文。请判断它的题材与开篇架构，说明它靠什么留住读者，以及可以借鉴或需要避开的地方。',
    '只输出严格 JSON，不要 Markdown，不要编造未提供的情节。',
  ].join('\n')
  const prompt = [
    `书名：${info.name}`,
    `字数：${info.words}｜章节：${info.chapterCount}`,
    `前几章正文：\n${digest}`,
    skillBlock,
    '输出 JSON：{"title":"书名","genre":"题材判断","architecture":{"name":"架构名","summary":"80字内","traits":["特征"],"why":"为什么能吸引读者（120字内）","targetReaders":"目标读者","openingHook":"开篇钩子","pacing":"节奏判断"},"skillNotes":[{"skill":"技能名","note":"按该技能视角的评价"}],"takeaway":"给作者的可借鉴结论（100字内）"}',
    skills.length
      ? '要求：architecture 只给一个最贴近的主架构；skillNotes 只写输入里出现的技能；无法判断的字段用「不确定」。'
      : '要求：architecture 只给一个最贴近的主架构；本次没有选择技能，skillNotes 输出空数组 []；无法判断的字段用「不确定」。',
  ].join('\n\n')
  const result = await callModel(system, prompt, ctx, 2000)
  return {
    info,
    analysis: parseJsonBlock(result.text),
    text: result.text,
    model: result.model,
  }
}

function parseFanqieRank(html) {  const state = extractInitialState(html)
  const list = state?.rank?.book_list
  if (!Array.isArray(list)) return []
  return list.map((book, index) => ({
    rank: Number(book.currentPos) || index + 1,
    title: cleanText(book.bookName),
    author: cleanText(book.author),
    category: '',
    words: Number(book.wordNumber) || 0,
    reads: Number(book.read_count || book.readCount) || 0,
    abstract: cleanText(book.abstract).slice(0, 500),
    url: `https://fanqienovel.com/page/${book.bookId}`,
    bookId: String(book.bookId || ''),
    chapterTitles: [],
  }))
}

async function fanqieBookMeta(bookId, count) {
  if (!bookId) return { chapterTitles: [], cleanTitle: '', abstract: '', cleanAuthor: '' }
  try {
    const html = await fetchHtml(`https://fanqienovel.com/page/${bookId}`)
    const state = extractInitialState(html)
    const volumes = state?.page?.chapterListWithVolume
    const chapters = Array.isArray(volumes)
      ? volumes.flatMap((volume) => (Array.isArray(volume) ? volume : []))
      : []
    const fallbackTitles = chapters
      .slice(0, count + 4)
      .map((chapter) => cleanText(chapter.title))
      .filter((title) => title && !/^最近更新/.test(title) && !/(新书感言|上架感言|请假条|公告)/.test(title))
      .slice(0, count)
    const renderedTitles = [...html.matchAll(/class="chapter-item-title"[^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => cleanText(match[1], true))
      .filter((title) => title && !/^最近更新/.test(title) && !/(新书感言|上架感言|请假条|公告)/.test(title))
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i)
    const cleanTitle = titleMatch
      ? cleanText(titleMatch[1]).split(/完整版|在线免费阅读|小说_|最新章节|免费阅读/)[0].trim()
      : ''
    const abstractMatch = html.match(/<div class="page-abstract-content">([\s\S]*?)<\/div>/i)
    const abstract = abstractMatch ? cleanText(abstractMatch[1], true).slice(0, 600) : ''
    const keywords = (html.match(/<meta name="keywords" content="([^"]*)"/i) || [])[1] || ''
    const authorMatch = keywords.match(/([^,，]{2,24}?)小说/)
    return {
      chapterTitles: renderedTitles.length ? renderedTitles.slice(0, count) : fallbackTitles,
      cleanTitle,
      abstract,
      cleanAuthor: authorMatch ? authorMatch[1].trim() : '',
    }
  } catch {
    return { chapterTitles: [], cleanTitle: '', abstract: '', cleanAuthor: '' }
  }
}

function parseShuqiRank(html) {
  const books = []
  const chunks = html.split('class="ranklinst-bk"').slice(1)
  for (const chunk of chunks) {
    const href = chunk.match(/href="(\/book\/\d+\.html)"/)
    const title = chunk.match(/<h3>([\s\S]*?)<\/h3>/)
    if (!href || !title) continue
    const author = chunk.match(/class="bkuser-icon">[\s\S]*?<a[^>]*>([^<]+)</)
    const category = chunk.match(/class="bkcate-icon">([^<]+)</)
    const description = chunk.match(/class="ranklist-des">([\s\S]*?)<\/p>/)
    books.push({
      rank: books.length + 1,
      title: cleanText(title[1]),
      author: cleanText(author ? author[1] : ''),
      category: cleanText(category ? category[1] : ''),
      words: 0,
      reads: 0,
      abstract: cleanText(description ? description[1] : '', true).slice(0, 500),
      url: `https://www.shuqi.com${href[1]}`,
      chapterTitles: [],
    })
    if (books.length >= 80) break
  }
  return books
}

function parseGenericRank(html, baseUrl) {
  const skip = /^(首页|登录|注册|排行|排行榜|榜单|更多|目录|书架|下载|客户端|我的|搜索|分类|全部|上一页|下一页|返回|免费|充值|APP|小说|首页|百科|热门榜|新书榜|完本榜|畅销榜|推荐榜)$/
  const blocked = /(book-rank|book-cate|book-search|book-shelf|baike|\/rank|\/login|\/search)/i
  const seen = new Set()
  const books = []
  const pattern = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]{1,160}?)<\/a>/gi
  let match
  while ((match = pattern.exec(html))) {
    const title = cleanText(match[2], true)
    if (title.length < 3 || title.length > 32 || skip.test(title)) continue
    const href = match[1]
    if (!/(book|novel|read|\/n\/|\/b\/)/i.test(href)) continue
    if (blocked.test(href)) continue
    if (seen.has(title)) continue
    seen.add(title)
    let url = href
    try {
      url = new URL(href, baseUrl).toString()
    } catch {
      /* keep raw href */
    }
    books.push({
      rank: books.length + 1,
      title,
      author: '',
      category: '',
      words: 0,
      reads: 0,
      abstract: '',
      url,
      chapterTitles: [],
    })
    if (books.length >= 12) break
  }
  return books
}

function matchesGenre(book, genre) {
  const haystack = `${book.category} ${book.title} ${book.abstract}`
  return genre.keywords.some((keyword) => haystack.includes(keyword))
}

async function enrichBooks(books, options, chapters) {
  if (!options.mirror) return 0
  let count = 0
  await mapLimit(books, 2, async (book) => {
    if (Date.now() > options.deadline) return
    try {
      const result = await enrichBookWithMirror(book, Math.min(chapters, 6))
      if (result) {
        if (Array.isArray(result.chapters) && result.chapters.length) {
          book.chapters = result.chapters
          book.chapterSource = result.sourceHost
          book.chapterUrl = result.sourceUrl
          count += 1
        } else if (result.sourceUrl) {
          book.chapterSource = result.sourceHost
          book.chapterUrl = result.sourceUrl
        }
      }
    } catch {
      /* a failed mirror only loses the text evidence */
    }
  })
  return count
}

async function scanTarget(platform, genre, topN, chapters, options) {
  if (platform.parser === 'fanqie') {
    const mapped = genre.maps && genre.maps.fanqie
    const legacy = platform.genreMap && platform.genreMap[genre.id]
    const category = mapped && mapped.id ? mapped : legacy ? { gender: 1, id: legacy } : null
    if (!category) throw new Error('该平台未配置这个分区')
    const gender = category.gender === 0 ? 0 : 1
    const html = await fetchHtml(`https://fanqienovel.com/rank/${gender}_2_${category.id}`)
    const books = parseFanqieRank(html)
    if (!books.length) throw new Error('榜单解析为空（页面可能改版）')
    const picked = books.slice(0, topN)
    await mapLimit(picked, 3, async (book) => {
      const meta = await fanqieBookMeta(book.bookId, chapters)
      if (meta.chapterTitles.length) book.chapterTitles = meta.chapterTitles
      if (meta.cleanTitle && meta.cleanTitle.length >= 2) book.title = meta.cleanTitle
      if (meta.abstract) book.abstract = meta.abstract
      if (meta.cleanAuthor) book.author = meta.cleanAuthor
    })
    const mirrored = await enrichBooks(picked, options, chapters)
    return {
      books: picked,
      evidence: mirrored ? '榜单 + 简介 + 镜像正文' : '榜单 + 简介 + 章节标题',
      note: mirrored
        ? `镜像补全了 ${mirrored} 本书的正文；其余仅用榜单、简介与章节标题`
        : '番茄正文有字体混淆；镜像检索未命中时只分析榜单、简介与章节标题',
    }
  }

  if (platform.parser === 'shuqi') {
    const html = await fetchHtml(platform.rankUrl || 'https://www.shuqi.com/ranklist?rank=boyhot')
    const all = parseShuqiRank(html)
    if (!all.length) throw new Error('榜单解析为空（页面可能改版）')
    let picked = all.filter((book) => matchesGenre(book, genre))
    let note = '榜单 + 分类 + 简介'
    if (picked.length < 3) {
      picked = all
      note = '书旗没有独立分区标签，已回退到综合热榜'
    }
    const books = picked.slice(0, topN).map((book, index) => ({ ...book, rank: index + 1 }))
    const mirrored = await enrichBooks(books, options, Math.min(chapters, 3))
    if (mirrored) note += `；镜像补全了 ${mirrored} 本书的正文`
    return {
      books,
      evidence: mirrored ? '榜单 + 分类 + 简介 + 镜像正文' : '榜单 + 分类 + 简介',
      note,
    }
  }

  if (platform.parser === 'generic') {
    const template = platform.rankUrl || platform.home
    const url = String(template)
      .replace(/\{genre\}/g, encodeURIComponent(genre.label))
      .replace(/\{genreLabel\}/g, encodeURIComponent(genre.label))
    if (!/^https?:\/\//i.test(url)) throw new Error('自定义平台需要 http(s) 链接')
    const html = await fetchHtml(url)
    const books = parseGenericRank(html, url)
    if (!books.length) throw new Error('通用解析没有找到书单，请确认这是榜单页')
    return {
      books: books.slice(0, topN),
      evidence: '通用页面解析（标题/链接）',
      note: '自定义平台仅做通用解析，可能缺少作者、简介和章节',
    }
  }

  if (platform.parser === 'none') {
    throw new Error(platform.note || '该平台需要浏览器或登录，暂不支持自动扫描；请打开榜单链接查看，或添加自定义平台')
  }

  throw new Error(platform.note || '该平台需要浏览器或登录，暂不支持自动扫描')
}

async function mapLimit(items, limit, worker) {
  let cursor = 0
  const results = []
  async function run() {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
  return results
}

async function loadSkillExcerpts(names) {
  const wanted = Array.isArray(names) ? names.filter((name) => typeof name === 'string') : []
  if (!wanted.length) return []
  const found = []
  let entries = []
  try {
    entries = await readdir(USER_SKILLS_ROOT, { withFileTypes: true })
  } catch {
    return []
  }
  for (const entry of entries) {
    if (found.length >= 3) break
    if (!entry.isDirectory()) continue
    try {
      const text = await readFile(join(USER_SKILLS_ROOT, entry.name, 'SKILL.md'), 'utf8')
      const parsedName = (text.match(/^name:\s*(.+)$/m) || [])[1]
      const name = parsedName ? parsedName.trim().replace(/^["']|["']$/g, '') : entry.name
      if (!wanted.includes(name) && !wanted.includes(entry.name)) continue
      const body = text.replace(/^---[\s\S]*?\n---/, '').trim()
      found.push({ name, excerpt: body.slice(0, 900) })
    } catch {
      /* skip unreadable skills */
    }
  }
  return found
}

function buildDigest(books) {
  const byGenre = new Map()
  for (const book of books) {
    if (!byGenre.has(book.genre)) byGenre.set(book.genre, [])
    byGenre.get(book.genre).push(book)
  }
  const parts = []
  for (const [genre, list] of byGenre) {
    parts.push(`# 分区：${genre}`)
    for (const book of list) {
      const meta = [
        `《${book.title}》`,
        book.author ? `作者：${book.author}` : '',
        book.platform ? `平台：${book.platform}` : '',
        book.words ? `字数：${book.words}` : '',
        book.reads ? `在读：${book.reads}` : '',
      ].filter(Boolean).join('｜')
      const abstract = String(book.abstract || '').slice(0, 220)
      const chapters = Array.isArray(book.chapterTitles) && book.chapterTitles.length
        ? `前${book.chapterTitles.length}章：${book.chapterTitles.slice(0, 12).join('；')}`
        : ''
      const fullText = Array.isArray(book.chapters) && book.chapters.length
        ? `正文摘录（${book.chapterSource || '镜像'}）：${book.chapters
            .slice(0, 3)
            .map((chapter) => `${chapter.title}：${String(chapter.text || '').replace(/\s+/g, ' ').slice(0, 500)}`)
            .join(' / ')}`
        : ''
      parts.push(
        `${meta}\n${abstract ? `简介：${abstract}\n` : ''}${chapters ? `${chapters}\n` : ''}${fullText}`.trim(),
      )
    }
  }
  return parts.join('\n\n')
}

function parseAnalysis(text) {
  const source = String(text || '')
  const start = source.indexOf('{')
  const end = source.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(source.slice(start, end + 1))
    if (!parsed || !Array.isArray(parsed.genres)) return null
    return parsed
  } catch {
    return null
  }
}

async function analyzeBooks(books, skills, ctx) {
  if (!books.length) return { analysis: null, text: '', model: '' }
  const llm = ctx.get('llm')
  if (!llm || typeof llm.stream !== 'function') throw new Error('LLM 服务不可用，无法生成架构分析')
  let selection = {}
  try {
    selection = (ctx.get('agentDefaultModel') && ctx.get('agentDefaultModel').currentSelection()) || {}
  } catch {
    selection = {}
  }
  const provider = selection.provider || 'deepseek-account'
  const model = selection.model || 'deepseek-flash'

  const skillBlock = skills.length
    ? `\n可用筛选视角（用户导入的写作技能，分析时参考其标准）：\n${skills.map((skill) => `- ${skill.name}：${skill.excerpt}`).join('\n')}\n`
    : ''
  const system = [
    '你是中文网络小说的榜单结构分析师。',
    '输入是若干平台、若干分区的榜单书单，含排名、字数、简介、章节标题，部分书还带镜像站的前几章正文。',
    '不同书的证据量不同：有正文的书按正文判断架构，只有简介/标题的书要明确降低把握，不要编造未提供的情节。',
    '你的任务：把同一分区内架构相似的书归为一组，说明每组的故事架构、为什么在该分区吸引读者，并指出该分区当前最值得借鉴的走向。',
    '只输出严格 JSON，不要 Markdown、不要解释文字。',
  ].join('\n')
  const genreNames = [...new Set(books.map((book) => book.genre))]
  const prompt = [
    `本次输入包含 ${genreNames.length} 个分区：${genreNames.join('、')}。`,
    buildDigest(books).slice(0, 22_000),
    skillBlock,
    '请按下面 JSON 结构输出（不要增删字段）：',
    '{"genres":[{"genre":"分区名","groups":[{"name":"架构名","summary":"80字内概述","traits":["特征","特征"],"why":"为什么吸引该分区读者（120字内）","books":["《书名》"]}],"takeaway":"该分区的架构走向（80字内）"}],"crossGenre":"多分区共性与差异（120字内）"}',
    '硬性要求：genres 必须覆盖上面列出的每一个分区，每个分区输出 2-4 组；crossGenre 不能为空；书名必须来自输入；无法归类的书可以放在「其他混合架构」组。',
  ].join('\n\n')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 160_000)
  let text = ''
  try {
    for await (const chunk of llm.stream({
      provider,
      model,
      system,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      temperature: 0.3,
      maxTokens: 4000,
      signal: controller.signal,
    })) {
      if (chunk.type === 'text-delta') text += chunk.text
      else if (chunk.type === 'finish' && chunk.reason && chunk.reason.kind === 'error') {
        throw new Error((chunk.reason.failure && chunk.reason.failure.message) || '模型调用失败')
      }
    }
  } finally {
    clearTimeout(timer)
  }
  return { analysis: parseAnalysis(text), text, model: `${provider}/${model}` }
}

function normalizePlatforms(input) {
  if (!Array.isArray(input)) return []
  const allowedParsers = new Set(['fanqie', 'shuqi', 'generic', 'none'])
  return input
    .filter((platform) => platform && typeof platform.id === 'string')
    .map((platform) => ({
      id: platform.id.slice(0, 80),
      name: String(platform.name || '自定义平台').slice(0, 60),
      parser: allowedParsers.has(platform.parser) ? platform.parser : 'generic',
      home: String(platform.home || '').slice(0, 2000),
      rankUrl: String(platform.rankUrl || platform.home || '').slice(0, 2000),
      genreMap: platform.genreMap && typeof platform.genreMap === 'object' ? platform.genreMap : {},
      note: String(
        platform.note
        || (PLATFORMS.find((entry) => entry.id === platform.id) || {}).note
        || '',
      ).slice(0, 300),
    }))
    .filter((platform) => platform.parser !== 'generic' || /^https?:\/\//i.test(platform.rankUrl))
    .slice(0, 6)
}

function resolveGenres(input) {
  const items = Array.isArray(input) ? input : []
  const resolved = []
  for (const item of items) {
    if (typeof item === 'string') {
      const found = GENRES.find((genre) => genre.id === item)
      if (found) resolved.push(found)
      continue
    }
    if (item && typeof item === 'object' && typeof item.label === 'string') {
      resolved.push({
        id: String(item.id || item.label).slice(0, 60),
        label: item.label.slice(0, 30),
        group: '自定义',
        featured: false,
        keywords: Array.isArray(item.keywords) ? item.keywords.map(String).slice(0, 6) : [item.label],
        maps: item.maps && typeof item.maps === 'object' ? item.maps : {},
        note: '',
      })
    }
  }
  return resolved
}

async function readRankCache() {
  try {
    return JSON.parse(await readFile(RANK_CACHE_FILE, 'utf8'))
  } catch {
    return null
  }
}

async function writeRankCache(payload) {
  await mkdir(RANK_CACHE_DIR, { recursive: true })
  await writeFile(RANK_CACHE_FILE, JSON.stringify(payload), 'utf8')
}

export async function handleRank(req, res, url, ctx) {
  const action = url.pathname.slice(API_PREFIX.length)

  if (action === '/rank/platforms' && req.method === 'GET') {
    send(res, 200, {
      ok: true,
      genres: GENRES,
      platforms: PLATFORMS,
      notes: {
        fanqie: '可自动扫描：分区新书榜 + 章节标题 + 镜像正文（可选）；正文有字体混淆，靠镜像补全',
        shuqi: '可自动扫描：热榜 + 分类 + 简介 + 镜像正文（可选）；章节接口限流',
        others: '站点由脚本渲染或有反爬限制，保留榜单链接，可人工查看或使用自定义平台',
      },
    })
    return true
  }

  if (action === '/rank/last' && req.method === 'GET') {
    const cached = await readRankCache()
    send(res, 200, { ok: true, result: cached })
    return true
  }

  if (action === '/rank/local' && req.method === 'POST') {
    const body = await readBody(req)
    const path = String(body.path || '').trim()
    if (!path) throw new Error('缺少小说路径')
    const { files, text } = await readLocalNovel(path)
    send(res, 200, { ok: true, novel: localNovelInfo(path, files, text) })
    return true
  }

  if (action === '/rank/local/analyze' && req.method === 'POST') {
    const body = await readBody(req)
    const path = String(body.path || '').trim()
    if (!path) throw new Error('缺少小说路径')
    const skills = await loadSkillExcerpts(body.skills)
    const result = await analyzeLocalNovel(path, skills, ctx)
    send(res, 200, { ok: true, ...result })
    return true
  }

  if (action === '/rank/scan' && req.method === 'POST') {
    const body = await readBody(req)
    const platforms = normalizePlatforms(body.platforms)
    if (!platforms.length) throw new Error('至少选择一个平台')
    const genreIds = Array.isArray(body.genres) ? body.genres : []
    const genres = resolveGenres(genreIds)
    if (!genres.length) throw new Error('至少选择一个分区')
    const topN = clamp(body.topN || 10, 3, 10)
    const chapters = clamp(body.chapters || 10, 1, 12)
    const mirror = body.mirror !== false
    const deadline = Date.now() + 240_000
    const targets = []
    for (const platform of platforms) for (const genre of genres) targets.push({ platform, genre })
    if (targets.length > MAX_TARGETS) throw new Error(`一次最多扫描 ${MAX_TARGETS} 个平台×分区组合`)

    const statuses = []
    const books = []
    await mapLimit(targets, 2, async ({ platform, genre }) => {
      try {
        const result = await scanTarget(platform, genre, topN, chapters, { mirror, deadline })
        for (const book of result.books) {
          if (books.length >= MAX_BOOKS) break
          books.push({ ...book, platform: platform.name, platformId: platform.id, genre: genre.label })
        }
        statuses.push({
          platformId: platform.id,
          platform: platform.name,
          genre: genre.label,
          ok: true,
          count: result.books.length,
          evidence: result.evidence,
          note: result.note,
        })
      } catch (error) {
        statuses.push({
          platformId: platform.id,
          platform: platform.name,
          genre: genre.label,
          ok: false,
          error: (error && error.message) || '扫描失败',
        })
      }
    })

    const warnings = []
    let analysis = null
    let analysisText = ''
    let model = ''
    try {
      const skills = await loadSkillExcerpts(body.skills)
      const result = await analyzeBooks(books, skills, ctx)
      analysis = result.analysis
      analysisText = result.analysis ? '' : result.text.slice(0, 4000)
      model = result.model
      if (!analysis && analysisText) warnings.push('模型没有返回可解析的 JSON，以下为原始分析文本')
      if (analysis) {
        const covered = new Set((analysis.genres || []).map((group) => group.genre))
        const expected = [...new Set(books.map((book) => book.genre))]
        const missing = expected.filter((genre) => !covered.has(genre))
        if (missing.length) warnings.push(`模型输出未覆盖分区：${missing.join('、')}，可再点一次扫描重试`)
      }
    } catch (error) {
      warnings.push((error && error.message) || '架构分析失败')
    }

    const displayBooks = books.map((book) => {
      const { chapters, ...rest } = book
      return rest
    })
    const payload = {
      generatedAt: Date.now(),
      statuses,
      books: displayBooks,
      analysis,
      analysisText,
      model,
      warnings,
      counts: { platforms: platforms.length, genres: genres.length, books: displayBooks.length },
    }
    try {
      await writeRankCache(payload)
    } catch {
      /* caching is best-effort */
    }
    send(res, 200, { ok: true, ...payload })
    return true
  }

  if (action === '/rank/mirror' && req.method === 'GET') {
    const title = cleanForSearch(url.searchParams.get('title') || '')
    const author = cleanForSearch(url.searchParams.get('author') || '')
    const query = title ? `${title} ${author} 小说` : `${author} 小说`
    const results = title || author ? await bingSearch(query) : []
    const candidates = results
      .filter((entry) => !MIRROR_SKIP_HOSTS.test(safeHost(entry.url)))
      .slice(0, 8)
    const report = []
    for (const candidate of candidates) {
      const item = { url: candidate.url, bingTitle: candidate.title }
      try {
        const page = await fetchMirrorHtml(candidate.url)
        item.pageTitle = pageTitleOf(page)
        item.containsTitle = Boolean(title && item.pageTitle.includes(title))
        item.containsAuthor = Boolean(author && item.pageTitle.includes(author))
        let links = extractDirectoryLinks(page, candidate.url)
        if (links.length < 2) {
          const directory = findDirectoryHref(page, candidate.url)
          item.directory = directory
          if (directory) {
            try {
              const dirPage = await fetchMirrorHtml(directory)
              item.pageTitle = pageTitleOf(dirPage)
              item.containsTitle = Boolean(title && item.pageTitle.includes(title))
              item.containsAuthor = Boolean(author && item.pageTitle.includes(author))
              links = extractDirectoryLinks(dirPage, directory)
            } catch (error) {
              item.directoryError = error.message
            }
          }
        }
        item.links = links.length
        item.minChapter = links.length ? Math.min(...links.map((link) => link.number).filter((n) => n > 0)) : null
        item.firstTitles = links.slice(0, 3).map((link) => link.title)
      } catch (error) {
        item.error = error.message
      }
      report.push(item)
    }
    send(res, 200, { ok: true, query, results: results.length, report })
    return true
  }

  if (action === '/rank/search' && req.method === 'GET') {
    const web = ctx.get('web')
    if (!web) throw new Error('web 服务不可用')
    const query = (url.searchParams.get('q') || '').trim()
    if (!query) throw new Error('缺少查询词')
    const result = await web.search({ query, maxResults: 6 })
    send(res, 200, {
      ok: true,
      query,
      content: result.content || '',
      sources: result.sources || [],
    })
    return true
  }

  return false
}
