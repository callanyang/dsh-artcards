import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { apply, inject } from '../lib/index.js'

function response() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value },
    end(body) { this.body = body }
  }
}

function hostFixture() {
  const routes = new Map()
  const commands = []
  const webServer = {
    register(route) {
      routes.set(route.path, route.handler)
      return () => routes.delete(route.path)
    }
  }
  const shell = {
    resolve(spec) { return spec },
    async run(spec) {
      commands.push(spec.command)
      if (spec.command.startsWith('ls -1 ')) {
        return { exitCode: 0, stdout: { text: 'Obsidian.app\nVisual Studio Code.app\n' } }
      }
      return { exitCode: 0, stdout: { text: '' }, stderr: { text: '' } }
    }
  }
  const services = {
    webServer,
    shell,
    fs: {
      async resolve(path, options) { return `${options.cwd}/${path}` },
      processPath(path) { return path }
    },
    sessions: { get() { return { header: { cwd: '/workspace' } } } }
  }
  const ctx = {
    get(name) { return services[name] },
    effect(callback) { callback() }
  }
  apply(ctx)
  return { commands, routes }
}

test('node half declares the services it uses', () => {
  assert.deepEqual(inject, ['webServer', 'shell', 'fs', 'sessions'])
})

test('artifact routes enforce the request marker and expose platform methods', async () => {
  const { routes } = hostFixture()
  const denied = response()
  await routes.get('/artifact-methods')({ headers: {} }, denied)
  assert.equal(denied.statusCode, 403)

  const allowed = response()
  await routes.get('/artifact-methods')({ headers: { 'x-requested-with': 'artifact-open' } }, allowed)
  assert.equal(allowed.statusCode, 200)
  const body = JSON.parse(allowed.body)
  assert.equal(body.ok, true)
  assert.equal(body.platform, process.platform)
  assert.ok(body.methods.some((method) => method.key === 'default'))
  if (process.platform === 'darwin') {
    assert.ok(body.methods.some((method) => method.key === 'app:Obsidian'))
  }
})

test('artifact-open resolves relative paths against the session cwd', async () => {
  const { commands, routes } = hostFixture()
  const res = response()
  await routes.get('/artifact-open')({
    headers: { 'x-requested-with': 'artifact-open' },
    url: '/artifact-open?path=notes%2Fresult.md&method=finder&sessionId=test-session'
  }, res)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body), { ok: true })
  assert.match(commands.at(-1), /result\.md|notes/)
})

test('browser half exports its service dependencies and shadows produced files', async () => {
  let definition
  globalThis.window = { __ModuleLoader__: { load(value) { definition = value } } }
  try {
    await import(`../lib/client.js?test=${Date.now()}`)
  } finally {
    delete globalThis.window
  }
  assert.equal(definition.id, 'dsh-artcards')
  const plugin = definition.factory((name) => {
    assert.equal(name, 'react')
    return {}
  })
  assert.deepEqual(plugin.inject, ['slots', 'connection'])

  let registration
  const slots = {
    inject(name, callback) {
      assert.equal(name, 'conversation.chat.turnTail')
      callback()
    },
    register(options) {
      registration = options
      return () => {}
    }
  }
  plugin.apply({
    get(name) {
      if (name === 'slots') return slots
      if (name === 'connection') return { isLoopback: true }
    },
    effect(callback) { callback() }
  })
  assert.equal(registration.priority, -1)
})

test('profile manifest helper is idempotent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-artcards-test-'))
  const manifest = join(dir, 'package.json')
  const helper = fileURLToPath(new URL('../scripts/profile-manifest.mjs', import.meta.url))
  const run = (action) => spawnSync(process.execPath, [helper, action, manifest, 'web'], { encoding: 'utf8' })

  assert.equal(run('init').status, 0)
  assert.equal(run('add').status, 0)
  assert.equal(run('add').status, 0)
  let value = JSON.parse(readFileSync(manifest, 'utf8'))
  assert.equal(value.dsh.profile.bundles.filter((name) => name === 'dsh-artcards').length, 1)

  assert.equal(run('remove').status, 0)
  assert.equal(run('remove').status, 0)
  value = JSON.parse(readFileSync(manifest, 'utf8'))
  assert.equal(value.dsh.profile.bundles.includes('dsh-artcards'), false)
})
