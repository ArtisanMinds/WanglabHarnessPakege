#!/usr/bin/env node
// Resolve the highest semver upstream GitHub Release version.
// Upstream tags are named dsh-v<version>; stdout contains <version>.
import {execFileSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import {compareSemver, maxSemver} from './resolve-latest-dsh-version.mjs'

function argument(name) {
  const prefix = `${name}=`
  const value = process.argv.find((arg) => arg.startsWith(prefix))
  return value?.slice(prefix.length)
}

function main() {
  const gh = process.platform === 'win32' ? 'gh.exe' : 'gh'
  const minimum = argument('--min-version')
  const output = execFileSync(gh, [
    'release', 'list', '--repo', 'deepseek-ai/deepseek-harness',
    '--limit', '100', '--json', 'tagName', '--jq', '.[].tagName',
  ], {encoding: 'utf8'})
  const versions = output.trim().split(/\r?\n/).map((tag) => tag.trim())
    .map((tag) => tag.replace(/^dsh-v/i, ''))
    .filter((version) => /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version))
  const candidates = minimum === undefined
    ? versions
    : versions.filter((version) => compareSemver(version, minimum) > 0)
  if (candidates.length === 0) {
    console.error(`[resolve-latest-github-release-version] no release newer than ${minimum ?? 'the available versions'}`)
    return
  }
  const winner = maxSemver(candidates)
  console.error(`[resolve-latest-github-release-version] picked ${winner} from ${candidates.length} upstream release(s)`)
  console.log(winner)
}

try {
  if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
} catch (error) {
  console.error(`[resolve-latest-github-release-version] failed: ${error.message}`)
  process.exit(1)
}
