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
