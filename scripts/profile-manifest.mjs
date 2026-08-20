import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const [action, manifestPath, profile = 'web'] = process.argv.slice(2)

if (!action || !manifestPath) {
  console.error('usage: profile-manifest.mjs <init|add|remove|has> <package.json> [profile]')
  process.exit(2)
}

function readManifest() {
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    return null
  }
}

function writeManifest(manifest) {
  mkdirSync(dirname(manifestPath), { recursive: true })
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
}

function bundlesOf(manifest) {
  manifest.dsh ??= {}
  manifest.dsh.profile ??= {}
  manifest.dsh.profile.bundles ??= []
  return manifest.dsh.profile.bundles
}

if (action === 'init') {
  if (profile !== 'web') throw new Error('dsh-artcards only supports the web profile')
  if (readManifest() === null) {
    writeManifest({
      name: 'dsh-profile-web',
      private: true,
      dependencies: {},
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] } }
    })
  }
  process.exit(0)
}

const manifest = readManifest()
if (manifest === null) {
  if (action === 'has') process.exit(1)
  throw new Error(`profile manifest does not exist: ${manifestPath}`)
}

if (action === 'has') {
  process.exit(Object.hasOwn(manifest.dependencies ?? {}, 'dsh-artcards') ? 0 : 1)
}

const bundles = bundlesOf(manifest)
if (action === 'add') {
  if (!bundles.includes('dsh-artcards')) bundles.push('dsh-artcards')
} else if (action === 'remove') {
  manifest.dsh.profile.bundles = bundles.filter((name) => name !== 'dsh-artcards')
} else {
  throw new Error(`unknown action: ${action}`)
}
writeManifest(manifest)
