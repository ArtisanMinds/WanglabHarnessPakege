#!/usr/bin/env node

import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sourceRoot = resolve(import.meta.dirname, '..')
const targetRoot = resolve(process.cwd())

function replace(file, before, after) {
  const path = resolve(targetRoot, file)
  const source = readFileSync(path, 'utf8')
  if (!source.includes(before)) {
    if (source.includes(after))
      return
    throw new Error(`Wanglab localization anchor missing: ${file}`)
  }
  writeFileSync(path, source.replaceAll(before, after))
}

replace(
  'node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js',
  'const DEEPSEEK_PUBLIC_BASE_URL = "https://api.deepseek.com";',
  'const DEEPSEEK_PUBLIC_BASE_URL = "https://10.201.2.89:31417/v1";',
)
replace(
  'node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js',
  'const WELCOME_NOTICE_VERSION = "2026-08-13.1";',
  'const WELCOME_NOTICE_VERSION = "2026-08-31.1";',
)
replace(
  'node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js',
  'title: "内测声明",',
  'title: "Wanglab Harness 内测说明",',
)
replace(
  'node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js',
  'body: "DeepSeek Harness 目前的 0.1 版本仍处在面向 Harness 开发者进行测试的阶段，还有许多地方需要持续改进和打磨，希望听取广大开发者的反馈建议。预计 DeepSeek Harness 的核心插件以及基础 API 都会在接下来的一段时间内快速迭代、持续演化。\\n\\n我们期待与全球开发者一起，在开源、开放、可复用、可组合的基础设施之上，共同探索智能上限。欢迎全球 Harness 开发者加入 DSH 插件生态。",',
  'body: "Wanglab Harness 0.1 目前处于内测阶段，面向内部团队与受邀开发者开放。我们正在持续完善 WanglabAI 的模型接入、插件生态和基础能力，欢迎通过官网 https://seuwanglab.com/ 反馈使用体验。\\n\\nWanglabAI 致力于提供开放、可复用、可组合的智能工具。Create Future Here。",',
)
replace(
  'node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js',
  'title: "Internal Testing Notice",',
  'title: "Wanglab Harness Internal Testing",',
)
replace(
  'node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js',
  'body: "DeepSeek Harness 0.1 remains in testing for Harness developers. Many areas need further improvement, and we welcome feedback from the developer community. DeepSeek Harness\'s core plugins and foundational APIs will continue to evolve rapidly over the coming months.\\n\\nWe look forward to exploring the limits of intelligence with developers around the world, building on open-source, open, reusable, and composable infrastructure. We welcome Harness developers everywhere to join the DSH plugin ecosystem.",',
  'body: "Wanglab Harness 0.1 is currently in internal testing for our team and invited developers. We are continuing to improve WanglabAI model access, the plugin ecosystem, and foundational capabilities. Feedback is welcome at https://seuwanglab.com/.\\n\\nWanglabAI provides open, reusable, and composable tools for intelligent work. Create Future Here.",',
)
replace(
  'node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js',
  'onboardingDescription: "Configure the official DeepSeek provider to start building.",',
  'onboardingDescription: "Configure a WanglabAI provider to start building.",',
)
replace(
  'node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js',
  'onboardingDescription: "配置 DeepSeek 官方模型，即可开始使用。",',
  'onboardingDescription: "配置 WanglabAI 提供方即可开始使用。",',
)

replace(
  'node_modules/@deepseek-ai/dsh-client-ui-brand-official/lib/client.js',
  `return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FishLogo, {
\t\t\t\tsize,
\t\t\t\tclassName
\t\t\t});`,
  `return (0, react_jsx_runtime.jsx)("img", {
\t\t\t\tsrc: "/favicon.svg",
\t\t\t\talt: "WanglabAI",
\t\t\t\twidth: size,
\t\t\t\theight: size,
\t\t\t\tclassName
\t\t\t});`,
)
replace(
  'node_modules/@deepseek-ai/dsh-client-ui-brand-official/lib/client.js',
  'return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.BrandWordmark, { includeMark: false });',
  'return (0, react_jsx_runtime.jsx)("span", { children: "WanglabAI" });',
)

replace(
  'node_modules/@deepseek-ai/dsh-client-ui-sidebar/lib/client.js',
  'renderSlot("sidebar.brand.mark", { size: 24 }, { fallback: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FishLogo, { size: 24 }) })',
  'renderSlot("sidebar.brand.mark", { size: 24 }, { fallback: (0, react_jsx_runtime.jsx)("img", { src: "/favicon.svg", alt: "WanglabAI", width: 24, height: 24 }) })',
)
replace(
  'node_modules/@deepseek-ai/dsh-client-ui-sidebar/lib/client.js',
  'children: "DSH Local Build"',
  'children: "WanglabAI"',
)
replace(
  'node_modules/@deepseek-ai/dsh-client-ui-sidebar/lib/client.js',
  'children: "29b22c5"',
  'children: "Create Future Here"',
)
replace(
  'node_modules/@deepseek-ai/dsh-client-ui-renderer/lib/client.js',
  'const productTitle = "DeepSeek Harness";',
  'const productTitle = "Wanglab Harness";',
)
replace(
  'node_modules/@deepseek-ai/dsh-llm-deepseek/lib/index.js',
  'name: "DeepSeek"',
  'name: "WanglabAI - Deepseek"',
)
replace(
  'node_modules/@deepseek-ai/dsh-llm-deepseek/lib/index.js',
  'displayName: "DeepSeek",',
  'displayName: "WanglabAI - Deepseek",',
)

copyFileSync(
  resolve(sourceRoot, 'public/favicon.svg'),
  resolve(targetRoot, 'node_modules/@deepseek-ai/dsh-web-frontend/dist/favicon.svg'),
)

console.log('Wanglab localization applied')
