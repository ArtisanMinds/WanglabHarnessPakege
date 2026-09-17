#!/usr/bin/env node
// 发布前的体积预算闸门。
//
// 背景：0.1.6-alpha.1 -> 0.1.6-alpha.2 的上传体积是 37 -> 147 MiB（Windows）、
// 37.7 -> 93 MiB（Linux），合计 ~156 -> ~534 MiB。膨胀来自上游
// `dsh-web-app@0.1.6-alpha.2` 新增的硬依赖 `dsh-office-to-pdf` ->
// `@deepseek-ai/libreoffice-kit`：Windows 上是 325 MiB 的解压后原生引擎
// （Prebuilt LibreOfficeKit），Linux 回退到 185 MiB 的 wasm 引擎。
// 体积暴涨把 GitHub Release 资产上传推到了 `Headers Timeout Error`
// （undici 5 分钟响应头超时），所以这里加一道显式闸门。
//
// 预算按「已观测的真实基准」标定，而不是按当时的现状贴边设：
//   - 0.1.6-alpha.1（npm 部署产物）：单包 ~37 MiB、合计 ~156 MiB
//   - 源码构建 pre-release（2026-09-06 实测）：单包 ~46 MiB、合计 ~183 MiB
// 默认单包 64 MiB / 合计 256 MiB ≈ 基准的 1.7x / 1.6x，给正常增长留了余量，
// 而上面那次 4x 膨胀会直接被拦下（147 > 64、534 > 256）。
// 如果哪天真要发布大引擎，请显式调高预算并写清原因，别让闸门默默失效。
//
// 用法:
//   node scripts/check-artifact-size.mjs                 # 检查 ./artifacts/**/*.zip
//   node scripts/check-artifact-size.mjs --dir=./artifacts
//   node scripts/check-artifact-size.mjs --max-file-mib=64 --max-total-mib=256
//
// 提交结论前的排查：`node scripts/zip-footprint.mjs <产物.zip>` 会列出解压后
// 最大的包与扩展名，能直接把体积来源定位到某个依赖。
import { readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const argValue = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const dir = resolve(argValue('dir', 'artifacts'))
const maxFileMiB = Number(argValue('max-file-mib', '64'))
const maxTotalMiB = Number(argValue('max-total-mib', '256'))

const MiB = 1024 * 1024
const mib = (bytes) => (bytes / MiB).toFixed(1)

function collectZips(root) {
  const found = []
  const walk = (d) => {
    let entries
    try {
      entries = readdirSync(d, { withFileTypes: true })
    } catch (err) {
      console.error(`[check-artifact-size] 无法读取 ${d}: ${err.message}`)
      process.exit(1)
    }
    for (const entry of entries) {
      const full = join(d, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile() && entry.name.endsWith('.zip')) found.push(full)
    }
  }
  walk(root)
  return found
}

const zips = collectZips(dir)
if (zips.length === 0) {
  console.error(`[check-artifact-size] ${dir} 下没有找到任何 .zip，无法发布`)
  process.exit(1)
}

const rows = zips
  .map((path) => ({ path, size: statSync(path).size }))
  .sort((a, b) => b.size - a.size)

const total = rows.reduce((sum, row) => sum + row.size, 0)

console.log(`[check-artifact-size] ${rows.length} 个产物（上传体积），合计 ${mib(total)} MiB`)
for (const row of rows) {
  const over = row.size > maxFileMiB * MiB ? '  <-- 超过单包预算' : ''
  console.log(`  ${mib(row.size).padStart(9)} MiB  ${row.path}${over}`)
}
// 基准（供以后重标定）：alpha.1 单包 ~37 MiB / 合计 ~156 MiB；alpha.2 因上游
// 引入 LibreOfficeKit 引擎变为 93~154 MiB / ~534 MiB（已超预算，属预期报警）。
console.log(
  `[check-artifact-size] 预算：单包 <= ${maxFileMiB} MiB，合计 <= ${maxTotalMiB} MiB（上传体积）`,
)

const breached = []
for (const row of rows) {
  if (row.size > maxFileMiB * MiB) {
    breached.push(`${row.path} = ${mib(row.size)} MiB > ${maxFileMiB} MiB`)
  }
}
if (total > maxTotalMiB * MiB) {
  breached.push(`合计 ${mib(total)} MiB > ${maxTotalMiB} MiB`)
}

if (breached.length > 0) {
  console.error('[check-artifact-size] 体积超出预算：')
  for (const line of breached) console.error(`  - ${line}`)
  console.error(
    '[check-artifact-size] 排查方式：用 `node scripts/zip-footprint.mjs <产物.zip>` 直接看解压后的' +
    '体积构成（会列出最大的包与扩展名）；build job 里的 "Report deploy footprint" 步骤也会打印' +
    'deploy 后的真实构成。确认来源后收紧瘦身规则，或按实际情况调整 --max-file-mib / --max-total-mib。',
  )
  process.exit(1)
}

console.log('[check-artifact-size] 体积在预算内')
