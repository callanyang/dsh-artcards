window.__ModuleLoader__.load({
  id: "dsh-artcards",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let React = require("react");

    const inject = ['slots', 'connection']

    let lastMethodKey = null
    let methodsPromise = null

    function selectArtifacts(owner) {
      const data = owner.turn.data.get('deliverables')
      if (data === void 0 || data === null) return null
      const paths = []
      const seen = new Set()
      for (const produced of data.produced) {
        if (produced.seq > owner.seq || seen.has(produced.path)) continue
        seen.add(produced.path)
        paths.push(produced.path)
      }
      return paths.length === 0 ? null : paths
    }

    function baseName(path) {
      const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
      return at === -1 ? path : path.slice(at + 1)
    }

    function dirName(path) {
      const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
      if (at === -1) return ''
      return path.slice(0, at)
    }

    function badgeFor(path) {
      const base = baseName(path)
      const dot = base.lastIndexOf('.')
      if (dot <= 0 || dot === base.length - 1) return 'FILE'
      return base.slice(dot + 1).toUpperCase().slice(0, 4)
    }

    function fallbackMethods(canOpenPath) {
      if (canOpenPath === true) return [
        { key: 'finder', label: '在 Finder 中显示', category: 'system' },
        { key: 'default', label: '默认应用打开', category: 'system' }
      ]
      return [{ key: 'default', label: '默认应用打开', category: 'system' }]
    }

    function groupMethods(methods) {
      const labels = { system: '打开方式', markdown: 'Markdown 编辑器', ide: 'IDE', editor: '文本编辑器' }
      const groups = []
      const byCategory = new Map()
      for (const method of methods) {
        let group = byCategory.get(method.category)
        if (group === undefined) {
          group = { label: labels[method.category] ?? method.category, items: [] }
          byCategory.set(method.category, group)
          groups.push(group)
        }
        group.items.push(method)
      }
      return groups
    }

    function labelOf(methods, key) {
      for (const method of methods) if (method.key === key) return method.label
      return '默认应用打开'
    }

    async function fetchJson(route, params) {
      const query = new URLSearchParams()
      for (const key of Object.keys(params)) query.set(key, String(params[key] ?? ''))
      const res = await fetch(route + '?' + query.toString(), {
        headers: { 'X-Requested-With': 'artifact-open' }
      })
      if (!res.ok) {
        let message = 'HTTP ' + res.status
        try {
          const data = await res.json()
          if (data !== null && data !== undefined && typeof data.error === 'string' && data.error.length > 0) message = data.error
        } catch (e) {}
        throw new Error(message)
      }
      return res.json()
    }

    function ArtifactCard(props) {
      const path = props.path
      const openFile = props.openFile
      const sessionId = props.sessionId
      const canOpenPath = props.canOpenPath
      const [methods, setMethods] = React.useState(() => fallbackMethods(canOpenPath))
      const [methodKey, setMethodKey] = React.useState(() => (canOpenPath === true ? 'finder' : 'default'))
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [open, setOpen] = React.useState(false)
      const [dropUp, setDropUp] = React.useState(false)
      const wrapRef = React.useRef(null)
      const menuRef = React.useRef(null)

      React.useEffect(() => {
        if (canOpenPath !== true) return undefined
        let alive = true
        if (methodsPromise === null) {
          methodsPromise = fetchJson('/artifact-methods', {}).catch(() => null)
        }
        methodsPromise.then((res) => {
          if (!alive || res === null || res === undefined || res.ok !== true || !Array.isArray(res.methods)) return
          const list = res.methods
          setMethods(list)
          setMethodKey((current) => {
            if (list.some((m) => m.key === current)) return current
            if (lastMethodKey !== null && list.some((m) => m.key === lastMethodKey)) return lastMethodKey
            return list.some((m) => m.key === 'finder') ? 'finder' : 'default'
          })
        })
        return () => { alive = false }
      }, [canOpenPath])

      React.useEffect(() => {
        if (!open) return undefined
        const onDocDown = (event) => {
          if (wrapRef.current !== null && wrapRef.current.contains(event.target)) return
          setOpen(false)
        }
        const onKey = (event) => {
          if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onDocDown)
        document.addEventListener('keydown', onKey)
        return () => {
          document.removeEventListener('mousedown', onDocDown)
          document.removeEventListener('keydown', onKey)
        }
      }, [open])

      React.useLayoutEffect(() => {
        if (!open) return
        const wrap = wrapRef.current
        const menu = menuRef.current
        if (wrap === null || menu === null) return
        const rect = wrap.getBoundingClientRect()
        const height = menu.offsetHeight
        setDropUp(rect.bottom + 8 + height > window.innerHeight)
      }, [open])

      const onOpen = async () => {
        if (busy) return
        if (methodKey === 'default') {
          openFile(path)
          return
        }
        setBusy(true)
        setError(null)
        try {
          const res = await fetchJson('/artifact-open', {
            path,
            sessionId: typeof sessionId === 'string' ? sessionId : '',
            method: methodKey
          })
          if (res === null || res === undefined || res.ok !== true) {
            const message = res !== null && res !== undefined && typeof res.error === 'string' && res.error.length > 0 ? res.error : '打开失败'
            setError(message)
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setBusy(false)
        }
      }

      const pick = (key) => {
        lastMethodKey = key
        setMethodKey(key)
        setOpen(false)
      }

      const groups = groupMethods(methods)
      const menuClass = 'dsha-menu' + (dropUp ? ' dsha-menu-up' : '')
      return React.createElement('div', { className: 'dsha-card' },
        React.createElement('div', { className: 'dsha-row' },
          React.createElement('button', { type: 'button', className: 'dsha-main', title: path, onClick: () => openFile(path) },
            React.createElement('span', { className: 'dsha-badge' }, badgeFor(path)),
            React.createElement('span', { className: 'dsha-meta' },
              React.createElement('span', { className: 'dsha-name' }, baseName(path)),
              React.createElement('span', { className: 'dsha-path' }, dirName(path))
            )
          ),
          React.createElement('div', { className: 'dsha-actions' },
            React.createElement('div', { ref: wrapRef, className: 'dsha-select-wrap' },
              React.createElement('button', {
                type: 'button',
                className: 'dsha-select',
                'aria-haspopup': 'listbox',
                'aria-expanded': open ? 'true' : 'false',
                title: '选择打开方式',
                onClick: () => setOpen((value) => !value)
              }, labelOf(methods, methodKey)),
              open ? React.createElement('div', { ref: menuRef, className: menuClass, role: 'listbox' },
                groups.map((group) => React.createElement(React.Fragment, { key: group.label },
                  React.createElement('div', { className: 'dsha-menu-label' }, group.label),
                  group.items.map((method) => React.createElement('button', {
                    type: 'button',
                    role: 'option',
                    'aria-selected': method.key === methodKey ? 'true' : 'false',
                    className: 'dsha-menu-item' + (method.key === methodKey ? ' dsha-menu-selected' : ''),
                    key: method.key,
                    onClick: () => pick(method.key)
                  },
                    React.createElement('span', { className: 'dsha-menu-text' }, method.label),
                    method.key === methodKey ? React.createElement('span', { className: 'dsha-menu-check' }, '✓') : null
                  ))
                ))
              ) : null
            ),
            React.createElement('button', { type: 'button', className: 'dsha-open', onClick: onOpen, disabled: busy, title: '用所选方式打开' },
              busy ? '打开中…' : '打开'
            )
          )
        ),
        error !== null ? React.createElement('div', { className: 'dsha-error' }, error) : null
      )
    }

    function ArtifactPanel(props) {
      const paths = props.matched
      const hostCanOpenPath = typeof props.useHostDescription === 'function'
        ? props.useHostDescription((description) => description !== null && description !== undefined && description.canOpenPath === true)
        : false
      const canOpenPath = props.isLoopback === true && hostCanOpenPath
      return React.createElement('div', { className: 'dsha-root' },
        React.createElement('div', { className: 'dsha-header' },
          React.createElement('span', { className: 'dsha-title' }, '产物'),
          React.createElement('span', { className: 'dsha-count' }, paths.length + ' 个文件')
        ),
        paths.map((path) => React.createElement(ArtifactCard, {
          key: path,
          path,
          openFile: props.openFile,
          sessionId: props.sessionId,
          canOpenPath
        }))
      )
    }

    const CSS = '.dsha-root{display:flex;flex-direction:column;gap:8px;margin-top:16px;font-size:13px;line-height:20px}.dsha-header{display:flex;align-items:baseline;gap:8px}.dsha-title{font-size:12px;color:var(--dsw-alias-label-tertiary)}.dsha-count{font-size:12px;color:var(--dsw-alias-label-tertiary);opacity:.85}.dsha-card{display:flex;flex-direction:column;gap:6px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 12px;min-width:0}.dsha-card:hover{border-color:var(--dsw-alias-border-l2)}.dsha-row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}.dsha-main{display:flex;align-items:center;gap:10px;min-width:0;flex:1 1 auto;background:none;border:none;padding:0;margin:0;cursor:pointer;text-align:left;font:inherit;border-radius:6px}.dsha-badge{flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:22px;padding:0 6px;border-radius:6px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:600;letter-spacing:.02em}.dsha-meta{display:flex;flex-direction:column;gap:1px;min-width:0}.dsha-name{color:var(--dsw-alias-label-primary);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsha-path{color:var(--dsw-alias-label-tertiary);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsha-actions{display:flex;align-items:center;gap:8px;flex:none}.dsha-select-wrap{position:relative;display:inline-flex;min-width:0}.dsha-select{appearance:none;-webkit-appearance:none;display:block;width:144px;background:var(--dsw-alias-bg-layer-2);background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\' fill=\'none\'%3E%3Cpath d=\'M3 4.5L6 7.5L9 4.5\' stroke=\'%2381858C\' stroke-width=\'1.8\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E");background-position:right 8px center;background-repeat:no-repeat;background-size:12px 12px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;height:30px;padding:0 28px 0 10px;font:inherit;font-size:12.5px;cursor:pointer;text-align:left;text-overflow:ellipsis;white-space:nowrap;overflow:hidden;outline:none}.dsha-select:hover{border-color:var(--dsw-alias-border-l2)}.dsha-select:focus-visible{box-shadow:inset 0 0 0 2px var(--dsw-alias-border-l3)}.dsha-menu{position:absolute;top:calc(100% + 6px);right:0;z-index:100;width:max-content;min-width:196px;max-width:min(300px,calc(100vw - 32px));max-height:320px;overflow:auto;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;box-shadow:0 10px 28px rgba(0,0,0,.18);padding:5px;display:flex;flex-direction:column}.dsha-menu-up{top:auto;bottom:calc(100% + 6px)}.dsha-menu-label{padding:7px 10px 3px;font-size:11px;color:var(--dsw-alias-label-tertiary);flex:none}.dsha-menu-item{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;box-sizing:border-box;border:none;background:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;line-height:18px;text-align:left;margin:0;padding:6px 10px;border-radius:7px;cursor:pointer;flex:none}.dsha-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dsha-menu-selected{color:var(--dsw-alias-label-primary)}.dsha-menu-check{color:var(--dsw-alias-brand-primary);font-size:11px;flex:none}.dsha-open{height:30px;padding:0 14px;border:none;border-radius:8px;font:inherit;font-size:12.5px;font-weight:500;color:var(--dsw-alias-label-primary-foreground);background:var(--dsw-alias-button-primary-fill);cursor:pointer;white-space:nowrap;flex:none}.dsha-open:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}.dsha-open:active{filter:brightness(.94)}.dsha-open:disabled{opacity:.6;cursor:default}.dsha-open:focus-visible{box-shadow:inset 0 0 0 2px var(--dsw-alias-border-l3)}.dsha-error{color:var(--dsw-alias-state-error-primary);font-size:12px}'

    function apply(ctx) {
      const slots = ctx.get('slots')
      if (slots === undefined) return
      const connection = ctx.get('connection')
      ctx.effect(() => {
        if (typeof document === 'undefined') return undefined
        const tag = document.createElement('style')
        tag.setAttribute('data-plugin', 'dsh-artcards')
        tag.textContent = CSS
        document.head.appendChild(tag)
        return () => { tag.remove() }
      })
      slots.inject('conversation.chat.turnTail', () => slots.register({
        name: 'conversation.chat.turnTail',
        select: selectArtifacts,
        priority: -1,
        inject: () => ({
          isLoopback: connection !== undefined ? connection.isLoopback === true : false,
          hooks: connection !== undefined && connection.hostDescription !== undefined ? { hostDescription: connection.hostDescription } : {}
        })
      }, ArtifactPanel))
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})
