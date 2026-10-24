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
    