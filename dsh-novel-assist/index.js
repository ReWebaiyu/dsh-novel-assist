/**
 * Host half of the Novel Assist bundle.
 *
 * Owns:
 *   - the creation-parameter store and manuscript folder scans;
 *   - the Agent-Skills library: listing, importing, and GitHub discovery.
 *
 * All endpoints live under `/novel-assist/api` on the same origin as the Web GUI.
 */
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve, sep } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { homedir, tmpdir } from 'node:os'
import { handleRank } from './rank.js'

export const inject = ['webServer']

const ROUTE_PREFIX = '/novel-assist/api'
const HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const STORAGE_DIR = join(HOME, 'novel-assist')
const STORAGE_FILE = join(STORAGE_DIR, 'state.json')
const USER_SKILLS_ROOT = join(HOME, 'skills')
const VERSION = 1

const execFileAsync = promisify(execFile)

const TEXT_EXTENSIONS = new Set([
  '.md', '.markdown', '.txt', '.text', '.json', '.yml', '.yaml', '.csv', '.html', '.htm',
])
const CHAPTER_PATTERN = /(第\s*[0-9一二三四五六七八九十百千零两]+\s*[章节回卷部篇集]|chapter\s*[0-9]+)/i
const READ_MAX_FILES = 240
const READ_MAX_CHARS = 12_000_000
const SCAN_MAX_DEPTH = 4
const SCAN_MAX_ENTRIES = 4000
const TOP_ENTRY_LIMIT = 24

const TEXT_PARAM_KEYS = [
  'title', 'genre', 'pov', 'tone', 'words', 'chapterWords', 'cadence',
  'pitch', 'conflict', 'world', 'characters', 'taboo',
]
const RANGE_PARAM_KEYS = ['patience', 'pleasure', 'pacing']
const PARAM_DEFAULTS = {
  title: '', genre: '', pov: 'third-limited', tone: 'hot', words: '',
  chapterWords: '', cadence: '', pitch: '', conflict: '', world: '',
  characters: '', taboo: '', patience: 3, pleasure: 3, pacing: 3,
}

/* ------------------------------------------------------------------ */
/* JSON and state                                                      */
/* ------------------------------------------------------------------ */

function send(res, status, body) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(payload)
}

async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 1_048_576) throw new Error('request body too large')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function clampRange(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 3
  return Math.min(5, Math.max(1, Math.round(parsed)))
}

function sanitizePlatforms(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((entry) => entry && typeof entry === 'object' && typeof entry.rankUrl === 'string' && /^https?:\/\//i.test(entry.rankUrl))
    .slice(0, 20)
    .map((entry) => ({
      id: String(entry.id || `custom-${Math.random().toString(36).slice(2, 8)}`).slice(0, 80),
      name: String(entry.name || '自定义平台').slice(0, 60),
      home: typeof entry.home === 'string' ? entry.home.slice(0, 2000) : '',
      rankUrl: String(entry.rankUrl).slice(0, 2000),
      parser: 'generic',
    }))
}

function sanitizeCustomGenres(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((entry) => entry && typeof entry === 'object' && typeof entry.label === 'string' && entry.label.trim())
    .slice(0, 30)
    .map((entry) => ({
      id: String(entry.id || `custom-g-${Math.random().toString(36).slice(2, 8)}`).slice(0, 64),
      label: entry.label.trim().slice(0, 30),
      gender: entry.gender === 0 ? 0 : 1,
      fanqieId: Number(entry.fanqieId) || 0,
    }))
    .filter((entry) => entry.fanqieId > 0)
}

function sanitizeLocalNovel(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.path !== 'string' || !raw.path.trim()) return null
  return {
    name: String(raw.name || '').slice(0, 120),
    path: raw.path.slice(0, 2000),
    files: Number(raw.files) || 1,
    words: Number(raw.words) || 0,
    chapterCount: Number(raw.chapterCount) || 0,
    chapterTitles: Array.isArray(raw.chapterTitles)
      ? raw.chapterTitles.filter((title) => typeof title === 'string').slice(0, 10).map((title) => title.slice(0, 80))
      : [],
    synopsis: typeof raw.synopsis === 'string' ? raw.synopsis.slice(0, 500) : '',
    importedAt: Number(raw.importedAt) || 0,
  }
}

function sanitizeState(raw) {
  const input = raw && typeof raw === 'object' ? raw : {}
  const source = input.params && typeof input.params === 'object' ? input.params : {}
  const params = {}
  for (const key of TEXT_PARAM_KEYS) {
    const value = source[key]
    const text = typeof value === 'string' ? value.slice(0, 4000) : ''
    params[key] = text === '' ? PARAM_DEFAULTS[key] : text
  }
  for (const key of RANGE_PARAM_KEYS) {
    params[key] = clampRange(source[key])
  }
  return {
    version: VERSION,
    folder: typeof input.folder === 'string' ? input.folder.trim().slice(0, 2000) : '',
    params,
    platforms: sanitizePlatforms(input.platforms),
    customGenres: sanitizeCustomGenres(input.customGenres),
    localNovel: sanitizeLocalNovel(input.localNovel),
    updatedAt: Number(input.updatedAt) || 0,
  }
}

async function loadState() {
  try {
    const text = await readFile(STORAGE_FILE, 'utf8')
    return sanitizeState(JSON.parse(text))
  } catch (error) {
    if (error && error.code === 'ENOENT') return sanitizeState({})
    throw error
  }
}

async function saveState(state) {
  const next = sanitizeState(state)
  next.updatedAt = Date.now()
  await mkdir(STORAGE_DIR, { recursive: true })
  const temporary = `${STORAGE_FILE}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  await rename(temporary, STORAGE_FILE)
  return next
}

/* ------------------------------------------------------------------ */
/* Manuscript folder scan                                              */
/* ------------------------------------------------------------------ */

function emptyScan(path, extra) {
  return {
    path,
    exists: false,
    isDirectory: false,
    folders: 0,
    files: 0,
    chapters: 0,
    words: 0,
    bytes: 0,
    truncated: false,
    entries: [],
    scannedAt: Date.now(),
    ...extra,
  }
}

async function scanFolder(inputPath) {
  const target = resolve(String(inputPath))
  let info
  try {
    info = await stat(target)
  } catch {
    return emptyScan(target, { missing: true })
  }
  if (!info.isDirectory()) return emptyScan(target, { exists: true, isDirectory: false })

  const result = emptyScan(target, { exists: true, isDirectory: true })
  const readBudget = { files: 0, chars: 0 }
  let visited = 0

  async function walk(directory, depth) {
    if (depth > SCAN_MAX_DEPTH || visited > SCAN_MAX_ENTRIES || result.truncated) return
    let children
    try {
      children = await readdir(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const child of children) {
      if (result.truncated) return
      if (child.name.startsWith('.')) continue
      visited += 1
      if (visited > SCAN_MAX_ENTRIES) {
        result.truncated = true
        return
      }
      const full = join(directory, child.name)
      if (child.isDirectory()) {
        result.folders += 1
        if (depth === 0 && result.entries.length < TOP_ENTRY_LIMIT) {
          result.entries.push({ name: child.name, kind: 'folder' })
        }
        await walk(full, depth + 1)
        continue
      }
      if (!child.isFile()) continue
      result.files += 1
      const extension = extname(child.name).toLowerCase()
      if (CHAPTER_PATTERN.test(basename(child.name, extension))) result.chapters += 1
      if (depth === 0 && result.entries.length < TOP_ENTRY_LIMIT) {
        let size = 0
        try {
          size = (await stat(full)).size
        } catch {
          size = 0
        }
        result.bytes += size
        result.entries.push({ name: child.name, kind: 'file', ext: extension, size })
      } else if (TEXT_EXTENSIONS.has(extension) && depth === 0) {
        try {
          result.bytes += (await stat(full)).size
        } catch {
          /* unreadable size is not fatal */
        }
      }
      if (
        TEXT_EXTENSIONS.has(extension)
        && readBudget.files < READ_MAX_FILES
        && readBudget.chars < READ_MAX_CHARS
      ) {
        try {
          const fileInfo = await stat(full)
          if (fileInfo.size > 0 && fileInfo.size <= 8 * 1024 * 1024) {
            const text = await readFile(full, 'utf8')
            readBudget.files += 1
            readBudget.chars += text.length
            result.words += text.replace(/\s+/g, '').length
          }
        } catch {
          /* unreadable text is not fatal */
        }
      }
    }
  }

  await walk(target, 0)
  result.entries.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'folder' ? -1 : 1
    return left.name.localeCompare(right.name, 'zh-Hans-CN')
  })
  return result
}

/* ------------------------------------------------------------------ */
/* Skill helpers                                                       */
/* ------------------------------------------------------------------ */

const SKILL_FILE = 'SKILL.md'
const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const NOVEL_HINT_RE = /(novel|fiction|story|writing|writer|webnovel|网文|小说|写作|剧情|设定|人设|角色|章节|拆书|拆文|扫榜|改稿|去\s*ai|润色|文笔|长篇|短篇|爽点|伏笔|世界观|一章|连载)/i
const JUNK_DIRS = new Set(['.git', '.github', 'node_modules', '.idea', '.vscode', 'dist', 'build'])
const GITHUB_HEADERS = {
  accept: 'application/vnd.github+json',
  'user-agent': 'dsh-novel-assist',
}
const MAX_SKILL_FILES = 200
const MAX_SKILL_BYTES = 8 * 1024 * 1024
const MAX_SINGLE_FILE = 2 * 1024 * 1024
const marketCache = new Map()
const MARKET_TTL = 10 * 60 * 1000

const CURATED_REPOS = [
  {
    repo: 'zenstory-ai/oh-story-claudecode',
    title: 'oh-story 网文全流程',
    description: '13 个网文技能：扫榜、拆文、长篇/短篇写作、去 AI 味、审稿、封面，基于文件的长篇连续性管理。',
    tags: ['网文', '全流程', '多技能'],
  },
  {
    repo: 'PenglongHuang/chinese-novelist-skill',
    title: '中文长篇小说生成',
    description: '从零生成 10–50 章完整中文小说：三层问答、创作记忆、悬念钩子、自动校验。',
    tags: ['长篇小说', '中文'],
  },
  {
    repo: 'Nanako0129/sepia',
    title: 'Sepia 去 AI 味',
    description: '面向虚构写作的去 AI 味与叙事结构修复，提供写作、审稿、重构等多个技能。',
    tags: ['去AI味', '文笔', '多技能'],
  },
  {
    repo: 'Tomsawyerhu/Chinese-WebNovel-Skill',
    title: '中文网文写作',
    description: '中文网文小说写作 skill，聚焦连载节奏与网文表达。',
    tags: ['网文', '单技能'],
  },
  {
    repo: 'tance-mang/chinese-webnovel-skills',
    title: '中文网文工具包',
    description: '23+ 个中文网文写作技能：人物、连续性、共写、润色、拆解等。',
    tags: ['网文', '多技能'],
  },
  {
    repo: 'zy-zmc/tianming-skill',
    title: '天命 · 长篇小说协同',
    description: '模块化提示词工程系统，用于长篇小说协同创作。',
    tags: ['长篇小说', '提示词'],
  },
  {
    repo: 'wgwtest/novel-writing',
    title: '小说规划与修订',
    description: '虚构写作的规划与修订技能：视角、对话、保风格改写，中英文示例。',
    tags: ['修订', '英文'],
  },
  {
    repo: 'qi531416/novel-humanize',
    title: '小说去 AI 味',
    description: '中文小说/网文去 AI 味，聚焦人味与查重降低。',
    tags: ['去AI味', '中文'],
  },
  {
    repo: 'xiaotiewinner/xt-webnovel-writing',
    title: '网文生成流水线',
    description: '拆解 → 立书 → 剧情设计 → 爽点与文笔 → 反 AI 味 → 长篇持久化记忆。',
    tags: ['流水线', '中文'],
  },
]

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

function quoteYaml(value) {
  return `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"`
}

function parseFrontmatter(text) {
  const source = String(text || '').replace(/^\uFEFF/, '')
  const lines = source.split(/\r?\n/)
  if (!/^---\s*$/.test(lines[0] || '')) {
    return { name: '', description: '', body: source, frontmatter: '', lines, end: -1 }
  }
  let end = -1
  for (let index = 1; index < lines.length; index += 1) {
    if (/^---\s*$/.test(lines[index])) {
      end = index
      break
    }
  }
  if (end < 0) {
    return { name: '', description: '', body: source, frontmatter: '', lines, end: -1 }
  }
  const block = lines.slice(1, end)
  const fields = {}
  for (let index = 0; index < block.length; index += 1) {
    const match = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(block[index])
    if (!match) continue
    let value = match[2].trim()
    if (/^[>|][-+]?$/.test(value)) {
      const collected = []
      for (let next = index + 1; next < block.length && /^\s+\S/.test(block[next]); next += 1) {
        collected.push(block[next].trim())
        index = next
      }
      value = collected.join(' ')
    }
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    else if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1)
    fields[match[1]] = value
  }
  return {
    name: fields.name || '',
    description: fields.description || '',
    body: lines.slice(end + 1).join('\n'),
    frontmatter: lines.slice(0, end + 1).join('\n'),
    lines,
    end,
  }
}

function firstSummary(body) {
  const plain = String(body || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s+.*$/gm, ' ')
    .replace(/[>*_`#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.slice(0, 160)
}

function buildFrontmatter(parsed, name, description) {
  const block = parsed.end > 0 ? parsed.lines.slice(1, parsed.end) : []
  const output = []
  let hasName = false
  let hasDescription = false
  for (let index = 0; index < block.length; index += 1) {
    const match = /^([A-Za-z0-9_-]+)\s*:/.exec(block[index])
    if (match && match[1] === 'name') {
      output.push(`name: ${name}`)
      hasName = true
      continue
    }
    if (match && match[1] === 'description') {
      output.push(`description: ${quoteYaml(description)}`)
      hasDescription = true
      let next = index + 1
      while (next < block.length && /^\s+\S/.test(block[next])) next += 1
      index = next - 1
      continue
    }
    output.push(block[index])
  }
  if (!hasName) output.unshift(`name: ${name}`)
  if (!hasDescription) output.push(`description: ${quoteYaml(description)}`)
  return ['---', ...output, '---'].join('\n')
}

function normalizeSkillText(text, fallbackName) {
  const parsed = parseFrontmatter(text)
  let name = parsed.name
  let renamed = false
  if (!SKILL_NAME_RE.test(name)) {
    const derived = slugify(name) || slugify(fallbackName) || 'novel-skill'
    renamed = Boolean(name)
    name = derived
  }
  let description = parsed.description
  if (!description) description = firstSummary(parsed.body) || 'Imported agent skill.'
  const frontmatter = buildFrontmatter(parsed, name, description)
  const body = parsed.body.replace(/^\s+/, '')
  return {
    text: `${frontmatter}\n\n${body}`.replace(/\s+$/, '\n'),
    name,
    description,
    renamed,
  }
}

function renameSkillText(text, name) {
  const parsed = parseFrontmatter(text)
  const description = parsed.description || firstSummary(parsed.body) || 'Imported agent skill.'
  const frontmatter = buildFrontmatter(parsed, name, description)
  return `${frontmatter}\n\n${parsed.body.replace(/^\s+/, '')}`.replace(/\s+$/, '\n')
}

async function directoryStats(root) {
  let files = 0
  let bytes = 0
  let visited = 0
  async function walk(directory, depth) {
    if (depth > 4 || visited > 400) return
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue
      visited += 1
      if (visited > 400) return
      const full = join(directory, entry.name)
      if (entry.isDirectory()) await walk(full, depth + 1)
      else if (entry.isFile()) {
        files += 1
        try {
          bytes += (await stat(full)).size
        } catch {
          /* ignore unreadable sizes */
        }
      }
    }
  }
  await walk(root, 0)
  return { files, bytes }
}

async function readSkillDirectory(directory, rootId) {
  const file = join(directory, SKILL_FILE)
  let text
  let info
  try {
    text = await readFile(file, 'utf8')
    info = await stat(file)
  } catch {
    return null
  }
  const parsed = parseFrontmatter(text)
  const stats = await directoryStats(directory)
  const name = parsed.name || basename(directory)
  const description = parsed.description || ''
  return {
    name,
    description,
    root: rootId,
    dir: directory,
    file,
    files: stats.files,
    bytes: stats.bytes,
    updatedAt: info.mtimeMs,
    novel: NOVEL_HINT_RE.test(`${name} ${description} ${basename(directory)}`),
    valid: SKILL_NAME_RE.test(name) && Boolean(description),
  }
}

function skillRoots(ctx) {
  const roots = [{ id: 'user', label: '用户技能库', path: USER_SKILLS_ROOT }]
  try {
    const working = ctx && typeof ctx.get === 'function' ? ctx.get('workingDirectory') : undefined
    const base = working && typeof working.defaultDirectory === 'string' ? working.defaultDirectory : ''
    if (base) roots.push({ id: 'project', label: '项目技能库', path: join(base, '.dsh', 'skills') })
  } catch {
    /* optional service */
  }
  return roots
}

async function listSkills(ctx) {
  const roots = skillRoots(ctx)
  const skills = []
  const rootReport = []
  for (const root of roots) {
    let exists = false
    try {
      exists = (await stat(root.path)).isDirectory()
    } catch {
      exists = false
    }
    rootReport.push({ ...root, exists })
    if (!exists) continue
    let entries = []
    try {
      entries = await readdir(root.path, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const skill = await readSkillDirectory(join(root.path, entry.name), root.id)
      if (skill) skills.push(skill)
    }
  }
  skills.sort((left, right) => {
    if (left.novel !== right.novel) return left.novel ? -1 : 1
    return left.name.localeCompare(right.name, 'zh-Hans-CN')
  })
  return { roots: rootReport, skills }
}

async function uniqueSkillDir(name) {
  const base = join(USER_SKILLS_ROOT, name)
  let candidate = base
  let suffix = 2
  while (true) {
    try {
      await stat(candidate)
      candidate = `${base}-${suffix}`
      suffix += 1
    } catch {
      return candidate
    }
  }
}

async function copySkillTree(source, target) {
  const warnings = []
  let files = 0
  let bytes = 0
  let truncated = false
  async function walk(from, to, depth) {
    if (depth > 6) return
    let entries = []
    try {
      entries = await readdir(from, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (JUNK_DIRS.has(entry.name) || entry.name === '.DS_Store') continue
      const full = join(from, entry.name)
      const destination = join(to, entry.name)
      if (entry.isDirectory()) {
        await mkdir(destination, { recursive: true })
        await walk(full, destination, depth + 1)
        continue
      }
      if (!entry.isFile()) continue
      let info
      try {
        info = await stat(full)
      } catch {
        continue
      }
      if (info.size > MAX_SINGLE_FILE) {
        truncated = true
        continue
      }
      if (files >= MAX_SKILL_FILES || bytes + info.size > MAX_SKILL_BYTES) {
        truncated = true
        continue
      }
      await mkdir(dirname(destination), { recursive: true })
      await copyFile(full, destination)
      files += 1
      bytes += info.size
    }
  }
  await walk(source, target, 0)
  if (truncated) warnings.push('技能文件过多或过大，已截断部分内容')
  return { files, bytes, warnings }
}

async function installDirectory(sourceDirectory, fallbackName) {
  await mkdir(USER_SKILLS_ROOT, { recursive: true })
  const skillFile = join(sourceDirectory, SKILL_FILE)
  const raw = await readFile(skillFile, 'utf8')
  const normalized = normalizeSkillText(raw, fallbackName || basename(sourceDirectory))
  const target = await uniqueSkillDir(normalized.name)
  const finalName = basename(target)
  const text = finalName === normalized.name ? normalized.text : renameSkillText(normalized.text, finalName)
  await mkdir(target, { recursive: true })
  const copied = await copySkillTree(sourceDirectory, target)
  await writeFile(join(target, SKILL_FILE), text, 'utf8')
  const installed = await readSkillDirectory(target, 'user')
  return {
    installed,
    warnings: copied.warnings,
    renamed: normalized.renamed || finalName !== normalized.name,
    sourceName: normalized.name,
  }
}

async function installSingleFile(raw, fallbackName) {
  await mkdir(USER_SKILLS_ROOT, { recursive: true })
  const normalized = normalizeSkillText(raw, fallbackName)
  const target = await uniqueSkillDir(normalized.name)
  const finalName = basename(target)
  const text = finalName === normalized.name ? normalized.text : renameSkillText(normalized.text, finalName)
  await mkdir(target, { recursive: true })
  await writeFile(join(target, SKILL_FILE), text, 'utf8')
  const installed = await readSkillDirectory(target, 'user')
  return {
    installed,
    warnings: [],
    renamed: normalized.renamed || finalName !== normalized.name,
    sourceName: normalized.name,
  }
}

async function extractZip(zipPath) {
  const destination = join(tmpdir(), `novel-assist-zip-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await mkdir(destination, { recursive: true })
  const escapedZip = zipPath.replace(/'/g, "''")
  const escapedDestination = destination.replace(/'/g, "''")
  await execFileAsync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Expand-Archive -LiteralPath '${escapedZip}' -DestinationPath '${escapedDestination}' -Force`,
    ],
    { windowsHide: true, timeout: 120_000 },
  )
  return destination
}

/* ------------------------------------------------------------------ */
/* GitHub discovery and repository install                             */
/* ------------------------------------------------------------------ */

async function fetchWithTimeout(url, init = {}, timeoutMs = 25_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' })
  } finally {
    clearTimeout(timer)
  }
}

async function githubJson(url) {
  const response = await fetchWithTimeout(url, { headers: GITHUB_HEADERS })
  if (!response.ok) {
    const detail = response.status === 403 || response.status === 429 ? 'rate-limited' : `GitHub API ${response.status}`
    const error = new Error(detail)
    error.status = response.status
    error.reset = response.headers.get('x-ratelimit-reset')
    throw error
  }
  return response.json()
}

function rawUrlCandidates(repo, branch, path) {
  const encodedPath = String(path).split('/').map(encodeURIComponent).join('/')
  const encodedBranch = encodeURIComponent(branch)
  const raw = `https://raw.githubusercontent.com/${repo}/${encodedBranch}/${encodedPath}`
  return [
    `https://gh-proxy.com/${raw}`,
    raw,
  ]
}

async function downloadFile(repo, branch, path) {
  let lastError
  for (const url of rawUrlCandidates(repo, branch, path)) {
    try {
      const response = await fetchWithTimeout(url, { headers: { 'user-agent': 'dsh-novel-assist' } }, 40_000)
      if (!response.ok) {
        lastError = new Error(`下载失败 HTTP ${response.status}: ${path}`)
        continue
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.length > MAX_SINGLE_FILE) {
        lastError = new Error(`文件过大：${path}`)
        continue
      }
      return buffer
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error(`无法下载 ${path}`)
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

function parseRepoInput(input) {
  const raw = String(input || '').trim()
  if (!raw) return null
  if (/^[\w.-]+\/[\w.-]+$/.test(raw)) return { repo: raw }
  let url
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\./, '')
  if (host === 'github.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    const repo = `${parts[0]}/${parts[1]}`
    if (parts[2] === 'tree' && parts.length >= 4) {
      return { repo, branch: parts[3], subpath: parts.slice(4).join('/') }
    }
    if (parts[2] === 'blob' && parts.length >= 4) {
      const rest = parts.slice(4).join('/')
      return { repo, branch: parts[3], subpath: rest.replace(/\/?SKILL\.md$/i, '') }
    }
    return { repo }
  }
  if (host === 'raw.githubusercontent.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length >= 4) {
      return { repo: `${parts[0]}/${parts[1]}`, branch: parts[2], rawPath: parts.slice(3).join('/') }
    }
  }
  if (host === 'gh-proxy.com' && url.pathname.startsWith('/https://')) {
    return parseRepoInput(url.pathname.slice(1))
  }
  return { directUrl: raw }
}

async function resolveRepo(repo, branch) {
  const info = await githubJson(`https://api.github.com/repos/${repo}`)
  const resolvedBranch = branch || info.default_branch || 'main'
  const tree = await githubJson(`https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(resolvedBranch)}?recursive=1`)
  const blobs = (tree.tree || []).filter((node) => node.type === 'blob')
  const skills = blobs
    .filter((node) => /(^|\/)SKILL\.md$/i.test(node.path))
    .map((node) => {
      const directory = node.path.replace(/\/?SKILL\.md$/i, '')
      return {
        path: node.path,
        dir: directory,
        label: directory ? directory.split('/').filter(Boolean).pop() : repo.split('/').pop(),
      }
    })
  return {
    repo,
    branch: resolvedBranch,
    stars: typeof info.stargazers_count === 'number' ? info.stargazers_count : undefined,
    description: info.description || '',
    blobs,
    skills,
    truncated: Boolean(tree.truncated),
  }
}

function selectBlobs(blobs, directory) {
  if (!directory) {
    return blobs.filter((node) => !node.path.split('/').some((segment) => JUNK_DIRS.has(segment)))
  }
  const prefix = `${directory}/`
  return blobs.filter((node) => node.path === `${directory}/SKILL.md` || node.path.startsWith(prefix))
}

async function localSkillCandidates(directory) {
  const direct = join(directory, SKILL_FILE)
  try {
    if ((await stat(direct)).isFile()) {
      return [{ path: directory, label: basename(directory), dir: '' }]
    }
  } catch {
    /* look one level down */
  }
  let entries = []
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return []
  }
  const candidates = []
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || JUNK_DIRS.has(entry.name)) continue
    try {
      if ((await stat(join(directory, entry.name, SKILL_FILE))).isFile()) {
        candidates.push({ path: join(directory, entry.name), label: entry.name, dir: entry.name })
      }
    } catch {
      /* not a skill directory */
    }
  }
  return candidates
}

async function installFromRepo(repo, skillPath, requestedBranch) {
  const resolved = await resolveRepo(repo, requestedBranch)
  const targetSkill = skillPath
    ? resolved.skills.find((entry) => entry.path.toLowerCase() === String(skillPath).toLowerCase())
      || resolved.skills.find((entry) => entry.dir === skillPath)
    : resolved.skills.length === 1
      ? resolved.skills[0]
      : null

  if (!targetSkill) {
    if (!skillPath && resolved.skills.length > 1) {
      return { needsChoice: true, repo, branch: resolved.branch, skills: resolved.skills }
    }
    if (!skillPath && resolved.skills.length === 0) {
      throw new Error('该仓库里没有找到 SKILL.md')
    }
    throw new Error('选择的技能路径不在仓库中')
  }

  const expectedSkillPath = targetSkill.dir ? `${targetSkill.dir}/SKILL.md` : 'SKILL.md'
  const skillNode = resolved.blobs.find((node) => node.path.toLowerCase() === expectedSkillPath.toLowerCase())
  if (!skillNode) throw new Error('仓库里找不到 SKILL.md')
  const rest = selectBlobs(resolved.blobs, targetSkill.dir)
    .filter((node) => node !== skillNode && (typeof node.size !== 'number' || node.size <= MAX_SINGLE_FILE))
  const files = [skillNode, ...rest].slice(0, MAX_SKILL_FILES)

  const warnings = []
  if (resolved.truncated) warnings.push('仓库文件树被 GitHub 截断，可能缺少部分文件')

  const buffers = await mapLimit(files, 5, async (node) => {
    if (node === skillNode) {
      try {
        return await downloadFile(resolved.repo, resolved.branch, node.path)
      } catch {
        return null
      }
    }
    try {
      return await downloadFile(resolved.repo, resolved.branch, node.path)
    } catch (error) {
      if (warnings.length < 8) warnings.push(`跳过 ${node.path}：${(error && error.message) || '下载失败'}`)
      return null
    }
  })

  const normalizedRaw = buffers[0]
  if (!normalizedRaw) throw new Error('无法下载 SKILL.md')
  const fallback = targetSkill.label || resolved.repo.split('/').pop()
  const normalized = normalizeSkillText(normalizedRaw.toString('utf8'), fallback)

  await mkdir(USER_SKILLS_ROOT, { recursive: true })
  const target = await uniqueSkillDir(normalized.name)
  const finalName = basename(target)
  const finalText = finalName === normalized.name ? normalized.text : renameSkillText(normalized.text, finalName)
  await mkdir(target, { recursive: true })

  let bytes = 0
  let written = 0
  for (let index = 0; index < files.length; index += 1) {
    const node = files[index]
    const buffer = buffers[index]
    if (!buffer) continue
    if (bytes + buffer.length > MAX_SKILL_BYTES) {
      warnings.push('技能体积超过上限，已截断部分文件')
      break
    }
    const relativePath = targetSkill.dir ? node.path.slice(targetSkill.dir.length + 1) : node.path
    if (!relativePath || relativePath.includes('..')) continue
    const destination = join(target, ...relativePath.split('/'))
    if (!destination.startsWith(target)) continue
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, /(^|\/)SKILL\.md$/i.test(node.path) ? finalText : buffer)
    bytes += buffer.length
    written += 1
  }

  if (written === 0) throw new Error('没有写入任何技能文件')
  const installed = await readSkillDirectory(target, 'user')
  return {
    installed,
    warnings,
    renamed: normalized.renamed || finalName !== normalized.name,
    sourceName: normalized.name,
    repo: resolved.repo,
    branch: resolved.branch,
    skillPath: targetSkill.path,
  }
}

async function searchMarket(query, refresh) {
  const key = String(query || '').trim().toLowerCase() || '__default__'
  const cached = marketCache.get(key)
  if (!refresh && cached && Date.now() - cached.at < MARKET_TTL) {
    return { ...cached.payload, cached: true }
  }
  const term = String(query || '').trim()
  const q = term ? `${term} skill` : 'novel writing skill'
  const payload = await githubJson(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=12`,
  )
  const items = (payload.items || []).map((item) => ({
    repo: item.full_name,
    description: item.description || '',
    stars: item.stargazers_count,
    updatedAt: item.updated_at,
    url: item.html_url,
    tags: Array.isArray(item.topics) ? item.topics.slice(0, 4) : [],
    archived: Boolean(item.archived),
  }))
  const result = { query: q, total: payload.total_count || 0, items, cached: false }
  marketCache.set(key, { at: Date.now(), payload: result })
  return result
}

/* ------------------------------------------------------------------ */
/* Skills route handling                                               */
/* ------------------------------------------------------------------ */

async function handleSkills(req, res, url, ctx) {
  const action = url.pathname.slice(ROUTE_PREFIX.length)

  if (action === '/skills' && req.method === 'GET') {
    const data = await listSkills(ctx)
    send(res, 200, { ok: true, ...data })
    return true
  }

  if (action === '/skills/import' && req.method === 'POST') {
    const body = await readJson(req)
    const kind = body.kind || 'folder'
    let result
    if (kind === 'folder') {
      const path = String(body.path || '').trim()
      if (!path) throw new Error('缺少文件夹路径')
      const info = await stat(path)
      if (!info.isDirectory()) throw new Error('该路径不是文件夹')
      const candidates = await localSkillCandidates(path)
      if (candidates.length === 0) throw new Error('文件夹里没有找到 SKILL.md')
      if (candidates.length > 1) {
        send(res, 200, {
          ok: true,
          needsChoice: true,
          kind: 'folder',
          skills: candidates.map((entry) => ({ path: entry.path, label: entry.label, dir: entry.dir })),
        })
        return true
      }
      result = await installDirectory(candidates[0].path, basename(path))
    } else if (kind === 'file') {
      const path = String(body.path || '').trim()
      if (!path) throw new Error('缺少文件路径')
      if (extname(path).toLowerCase() === '.zip') {
        const temporary = await extractZip(path)
        try {
          const candidates = await localSkillCandidates(temporary)
          if (candidates.length === 0) throw new Error('压缩包里没有找到 SKILL.md')
          result = await installDirectory(candidates[0].path, basename(path, '.zip'))
          if (candidates.length > 1) {
            result.warnings.push(`压缩包里有 ${candidates.length} 个技能，已导入 ${candidates[0].label}；其余请解压后逐个选择文件夹导入`)
          }
        } finally {
          await rm(temporary, { recursive: true, force: true })
        }
      } else {
        const raw = await readFile(path, 'utf8')
        result = await installSingleFile(raw, basename(path, extname(path)))
      }
    } else if (kind === 'url') {
      const input = String(body.url || '').trim()
      if (!input) throw new Error('缺少链接')
      const parsed = parseRepoInput(input)
      if (!parsed) throw new Error('无法识别的链接')
      if (parsed.directUrl) {
        const direct = String(parsed.directUrl)
        const directPath = (() => {
          try {
            return new URL(direct).pathname.toLowerCase()
          } catch {
            return ''
          }
        })()
        if (directPath.endsWith('.zip')) {
          const response = await fetchWithTimeout(direct, { headers: { 'user-agent': 'dsh-novel-assist' } }, 120_000)
          if (!response.ok) throw new Error(`下载失败 HTTP ${response.status}`)
          const buffer = Buffer.from(await response.arrayBuffer())
          const temporaryZip = join(tmpdir(), `novel-assist-url-${Date.now()}.zip`)
          const temporaryDirectory = await (async () => {
            await writeFile(temporaryZip, buffer)
            return extractZip(temporaryZip)
          })()
          try {
            const candidates = await localSkillCandidates(temporaryDirectory)
            if (candidates.length === 0) throw new Error('压缩包里没有找到 SKILL.md')
            result = await installDirectory(candidates[0].path, 'imported-skill')
          } finally {
            await rm(temporaryDirectory, { recursive: true, force: true })
            await rm(temporaryZip, { force: true })
          }
        } else {
          const response = await fetchWithTimeout(direct, { headers: { 'user-agent': 'dsh-novel-assist' } }, 60_000)
          if (!response.ok) throw new Error(`下载失败 HTTP ${response.status}`)
          result = await installSingleFile(await response.text(), 'imported-skill')
        }
      } else if (parsed.rawPath) {
        let text = null
        for (const url of rawUrlCandidates(parsed.repo, parsed.branch, parsed.rawPath)) {
          try {
            const response = await fetchWithTimeout(url, { headers: { 'user-agent': 'dsh-novel-assist' } }, 60_000)
            if (response.ok) {
              text = await response.text()
              break
            }
          } catch {
            /* try the next mirror */
          }
        }
        if (text === null) throw new Error('下载失败')
        result = await installSingleFile(text, 'imported-skill')
      } else {
        result = await installFromRepo(parsed.repo, parsed.subpath || '', parsed.branch)
      }
    } else {
      throw new Error('未知的导入方式')
    }
    send(res, 200, { ok: true, ...result })
    return true
  }

  if (action === '/skills/remove' && req.method === 'POST') {
    const body = await readJson(req)
    const target = resolve(String(body.dir || ''))
    const root = resolve(USER_SKILLS_ROOT)
    if (!target.toLowerCase().startsWith(`${root.toLowerCase()}${sep}`)) {
      throw new Error('只能移除用户技能库里的技能')
    }
    let info
    try {
      info = await stat(target)
    } catch {
      throw new Error('技能目录不存在')
    }
    if (!info.isDirectory()) throw new Error('技能目录不存在')
    try {
      await stat(join(target, SKILL_FILE))
    } catch {
      throw new Error('目录里没有 SKILL.md，拒绝移除')
    }
    await rm(target, { recursive: true, force: true })
    send(res, 200, { ok: true, removed: target })
    return true
  }

  if (action === '/skills/repo' && req.method === 'POST') {
    const body = await readJson(req)
    const repo = String(body.repo || '').trim()
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('仓库格式应为 owner/name')
    const result = await installFromRepo(repo, body.path ? String(body.path) : '', body.branch ? String(body.branch) : '')
    send(res, 200, { ok: true, repo, ...result })
    return true
  }

  if (action === '/skills/market' && req.method === 'GET') {
    const query = (url.searchParams.get('q') || '').trim()
    const refresh = url.searchParams.get('refresh') === '1'
    const curated = CURATED_REPOS.map((entry) => ({
      ...entry,
      curated: true,
      url: `https://github.com/${entry.repo}`,
    }))
    if (!query) {
      send(res, 200, { ok: true, curated, items: [], query: '', total: 0 })
      return true
    }
    try {
      const result = await searchMarket(query, refresh)
      send(res, 200, { ok: true, curated, items: result.items, query: result.query, total: result.total, cached: result.cached })
    } catch (error) {
      if (error && error.status === 403) {
        send(res, 200, {
          ok: false,
          code: 'rate-limited',
          error: 'GitHub 搜索接口限流（未登录约 10 次/分钟），请稍后再试',
          retryAt: Number(error.reset || 0) * 1000,
          curated,
        })
      } else {
        throw error
      }
    }
    return true
  }

  return false
}

/* ------------------------------------------------------------------ */
/* HTTP handler                                                        */
/* ------------------------------------------------------------------ */

async function handle(req, res, ctx) {
  const url = new URL(req.url || '/', 'http://localhost')
  const action = url.pathname.slice(ROUTE_PREFIX.length) || '/state'

  if (await handleRank(req, res, url, ctx)) return
  if (await handleSkills(req, res, url, ctx)) return

  if (action === '/state' && req.method === 'GET') {
    const state = await loadState()
    send(res, 200, { ok: true, state, storagePath: STORAGE_FILE })
    return
  }

  if (action === '/state' && (req.method === 'POST' || req.method === 'PUT')) {
    const body = await readJson(req)
    const saved = await saveState(body && body.state)
    send(res, 200, { ok: true, savedAt: saved.updatedAt, state: saved })
    return
  }

  if (action === '/scan' && req.method === 'POST') {
    const body = await readJson(req)
    const path = typeof body.path === 'string' ? body.path.trim() : ''
    if (!path) {
      send(res, 400, { ok: false, error: 'missing path' })
      return
    }
    const scan = await scanFolder(path)
    send(res, 200, { ok: true, scan })
    return
  }

  send(res, 404, { ok: false, error: 'unknown action' })
}

export function apply(ctx) {
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'prefix',
      path: ROUTE_PREFIX,
      handler: async (req, res) => {
        try {
          await handle(req, res, ctx)
        } catch (error) {
          send(res, 500, { ok: false, error: (error && error.message) || 'internal error' })
        }
      },
    }),
    'novel-assist: state, scan and skills routes',
  )
}
