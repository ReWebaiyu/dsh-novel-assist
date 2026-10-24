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
    