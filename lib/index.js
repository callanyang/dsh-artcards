// dsh-artcards node half.
// Serves two guarded HTTP routes to the browser half over the webServer
// service: /artifact-methods (platform + installed editors/IDEs) and
// /artifact-open (open -R reveal / open -a <app>).

function quoteSh(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'"
}

function quotePowerShell(value) {
  return "'" + String(value).replace(/'/g, "''") + "'"
}

function sendJson(res, code, value) {
  res.statusCode = code
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(value))
}

const APP_TABLE = [
  ['Typora', 'Typora', 'markdown'],
  ['MacDown', 'MacDown', 'markdown'],
  ['MarkText', 'MarkText', 'markdown'],
  ['Obsidian', 'Obsidian', 'markdown'],
  ['iA Writer', 'iA Writer', 'markdown'],
  ['Ulysses', 'Ulysses', 'markdown'],
  ['Zettlr', 'Zettlr', 'markdown'],
  ['Bear', 'Bear', 'markdown'],
  ['Byword', 'Byword', 'markdown'],
  ['MWeb', 'MWeb', 'markdown'],
  ['PyCharm', 'PyCharm', 'ide'],
  ['WebStorm', 'WebStorm', 'ide'],
  ['GoLand', 'GoLand', 'ide'],
  ['CLion', 'CLion', 'ide'],
  ['PhpStorm', 'PhpStorm', 'ide'],
  ['Rider', 'Rider', 'ide'],
  ['RubyMine', 'RubyMine', 'ide'],
  ['DataGrip', 'DataGrip', 'ide'],
  ['DataSpell', 'DataSpell', 'ide'],
  ['IntelliJ IDEA', 'IntelliJ IDEA', 'ide'],
  ['Visual Studio Code', 'VS Code', 'ide'],
  ['Cursor', 'Cursor', 'ide'],
  ['Zed', 'Zed', 'ide'],
  ['Windsurf', 'Windsurf', 'ide'],
  ['Fleet', 'Fleet', 'ide'],
  ['Android Studio', 'Android Studio', 'ide'],
  ['Xcode', 'Xcode', 'ide'],
  ['Sublime Text', 'Sublime Text', 'editor'],
  ['TextMate', 'TextMate', 'editor'],
  ['BBEdit', 'BBEdit', 'editor'],
  ['Nova', 'Nova', 'editor'],
  ['CotEditor', 'CotEditor', 'editor']
]

export const inject = ['webServer', 'shell', 'fs', 'sessions']

export function apply(ctx) {
  const shell = ctx.get('shell')
  const fs = ctx.get('fs')
  const sessions = ctx.get('sessions')
  const webServer = ctx.get('webServer')
  if (webServer === undefined) return

  let platformCache = null
  let appsCache = null

  async function runCommand(command) {
    if (shell === undefined) throw new Error('shell service not available')
    const spec = shell.resolve({ command, timeoutMs: 15000, stdoutMaxBytes: 131072 })
    return shell.run(spec)
  }

  async function detectPlatform() {
    if (platformCache !== null) return platformCache
    if (typeof process !== 'undefined' && ['darwin', 'linux', 'win32'].includes(process.platform)) {
      platformCache = process.platform
      return platformCache
    }
    try {
      const result = await runCommand('uname -s 2>/dev/null')
      const out = String(result.stdout !== undefined ? result.stdout.text : '').trim().toLowerCase()
      if (out.startsWith('darwin')) platformCache = 'darwin'
      else if (out.startsWith('linux')) platformCache = 'linux'
      else if (out.indexOf('mingw') !== -1 || out.indexOf('msys') !== -1 || out.indexOf('cygwin') !== -1) platformCache = 'win32'
      else platformCache = 'unknown'
    } catch (error) {
      platformCache = 'unknown'
    }
    return platformCache
  }

  async function detectApps() {
    if (appsCache !== null) return appsCache
    appsCache = []
    try {
      const result = await runCommand('ls -1 /Applications /System/Applications ~/Applications 2>/dev/null')
      const seen = new Set()
      const lines = String(result.stdout !== undefined ? result.stdout.text : '').split('\n')
      for (const line of lines) {
        const entry = line.trim()
        if (!entry.endsWith('.app')) continue
        const name = entry.slice(0, -4)
        for (const pair of APP_TABLE) {
          const family = pair[0]
          if (name !== family && name.indexOf(family + ' ') !== 0) continue
          if (seen.has(name)) continue
          seen.add(name)
          appsCache.push({ name, label: name === family ? pair[1] : name, category: pair[2] })
          break
        }
      }
    } catch (error) {
      appsCache = []
    }
    return appsCache
  }

  async function resolveAbsolute(rawPath, sessionId) {
    let cwd
    if (sessions !== undefined && typeof sessionId === 'string' && sessionId.length > 0) {
      const session = sessions.get(sessionId)
      if (session !== undefined && session.header !== undefined) cwd = session.header.cwd
    }
    if (fs === undefined) return rawPath
    try {
      const target = await fs.resolve(rawPath, cwd !== undefined ? { cwd } : {})
      const processed = fs.processPath(target)
      if (typeof processed === 'string' && processed.length > 0) return processed
    } catch (error) {}
    return rawPath
  }

  function allowed(req) {
    if (req.headers['x-requested-with'] !== 'artifact-open') return false
    const origin = req.headers.origin
    if (typeof origin === 'string' && origin.length > 0) {
      try {
        const parsed = new URL(origin)
        if (parsed.host !== String(req.headers.host ?? '')) return false
      } catch (error) {
        return false
      }
    }
    return true
  }

  const disposers = []

  disposers.push(webServer.register({
    kind: 'exact',
    path: '/artifact-methods',
    handler: async (req, res) => {
      if (!allowed(req)) return sendJson(res, 403, { ok: false, error: 'forbidden' })
      try {
        const platform = await detectPlatform()
        const methods = []
        if (platform === 'darwin') methods.push({ key: 'finder', label: '在 Finder 中显示', category: 'system' })
        else if (platform === 'linux') methods.push({ key: 'finder', label: '在文件管理器中显示', category: 'system' })
        else if (platform === 'win32') methods.push({ key: 'finder', label: '在资源管理器中显示', category: 'system' })
        methods.push({ key: 'default', label: '默认应用打开', category: 'system' })
        if (platform === 'darwin') {
          const apps = await detectApps()
          const order = { markdown: 0, ide: 1, editor: 2 }
          const sorted = apps.slice().sort((a, b) => (order[a.category] ?? 3) - (order[b.category] ?? 3))
          for (const app of sorted) methods.push({ key: 'app:' + app.name, label: app.label, category: app.category })
        }
        sendJson(res, 200, { ok: true, platform, methods })
      } catch (error) {
        sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    }
  }))

  disposers.push(webServer.register({
    kind: 'exact',
    path: '/artifact-open',
    handler: async (req, res) => {
      if (!allowed(req)) return sendJson(res, 403, { ok: false, error: 'forbidden' })
      try {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const rawPath = url.searchParams.get('path') ?? ''
        const method = url.searchParams.get('method') ?? ''
        const sessionId = url.searchParams.get('sessionId') ?? ''
        if (rawPath.length === 0) return sendJson(res, 400, { ok: false, error: '文件路径为空' })
        if (shell === undefined) return sendJson(res, 500, { ok: false, error: '当前部署没有可用的 shell 服务' })
        const abs = await resolveAbsolute(rawPath, sessionId)
        const platform = await detectPlatform()
        let command = 'open'
        let argv = []
        if (method === 'finder') {
          if (platform === 'darwin') argv = ['-R', abs]
          else if (platform === 'win32') { command = 'explorer'; argv = ['/select,' + abs] }
          else if (platform === 'linux') {
            const slash = abs.lastIndexOf('/')
            command = 'xdg-open'
            argv = [slash <= 0 ? '/' : abs.slice(0, slash)]
          } else argv = ['-R', abs]
        } else if (method.startsWith('app:')) {
          const appName = method.slice(4)
          if (appName.length === 0 || !/^[A-Za-z0-9 .()\-]+$/.test(appName)) {
            return sendJson(res, 400, { ok: false, error: '无效的应用程序名称' })
          }
          if (platform !== 'darwin') return sendJson(res, 400, { ok: false, error: '指定应用程序打开仅支持 macOS' })
          argv = ['-a', appName, abs]
        } else {
          return sendJson(res, 400, { ok: false, error: '未知的打开方式: ' + method })
        }
        const quote = platform === 'win32' ? quotePowerShell : quoteSh
        const result = await runCommand(command + ' ' + argv.map(quote).join(' '))
        if (result.exitCode === 0) return sendJson(res, 200, { ok: true })
        const stderr = result.stderr !== undefined ? String(result.stderr.text).trim() : ''
        const stdout = result.stdout !== undefined ? String(result.stdout.text).trim() : ''
        const detail = stderr.length > 0 ? stderr : stdout
        sendJson(res, 200, { ok: false, error: detail.length > 0 ? detail : '退出码 ' + String(result.exitCode) })
      } catch (error) {
        sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    }
  }))

  ctx.effect(() => () => {
    for (const dispose of disposers) {
      try { dispose() } catch (error) {}
    }
  })
}
