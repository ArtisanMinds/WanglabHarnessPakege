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
    throw new Error(`Wanglab localization anchor missing: ${file}: ${before.slice(0, 120)}`)
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
  'const WELCOME_NOTICE_VERSION = "2026-09-01.1";',
)
replace(
  'node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js',
  'welcomeTitle: "内测声明",',
  'welcomeTitle: "Wanglab Harness 内测",',
)
replace(
  'node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js',
  'welcomeBody: "DeepSeek Harness 目前的 0.1 版本仍处在面向 Harness 开发者进行测试的阶段，还有许多地方需要持续改进和打磨，希望听取广大开发者的反馈建议。预计 DeepSeek Harness 的核心插件以及基础 API 都会在接下来的一段时间内快速迭代、持续演化。\\n\\n我们期待与全球开发者一起，在开源、开放、可复用、可组合的基础设施之上，共同探索智能上限。欢迎全球 Harness 开发者加入 DSH 插件生态。",',
  'welcomeBody: "Wanglab is affiliated with School of Mechanical Engineering, Southeast University , Nanjing, China. Founded by Prof. Qianqian Wang, the lab is dedicated to the interdisciplinary robotics research at small scales, ranging from fundamental science and physics to technologies and solutions for a series of applications. Our team aims to investigate novel robotics solutions with a highly interest in both academic research and down-to-earth solution development, and we are always welcome worldwide collaborators to join our collaboration network.\\n\\nWe are creating the future here！",',
)
replace(
  'node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js',
  'welcomeTitle: "Internal Testing Notice",',
  'welcomeTitle: "Wanglab Harness Internal",',
)
replace(
  'node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js',
  'welcomeBody: "DeepSeek Harness 0.1 remains in testing for Harness developers. Many areas need further improvement, and we welcome feedback from the developer community. DeepSeek Harness\'s core plugins and foundational APIs will continue to evolve rapidly over the coming months.\\n\\nWe look forward to exploring the limits of intelligence with developers around the world, building on open-source, open, reusable, and composable infrastructure. We welcome Harness developers everywhere to join the DSH plugin ecosystem.",',
  'welcomeBody: "Wanglab is affiliated with School of Mechanical Engineering, Southeast University , Nanjing, China. Founded by Prof. Qianqian Wang, the lab is dedicated to the interdisciplinary robotics research at small scales, ranging from fundamental science and physics to technologies and solutions for a series of applications. Our team aims to investigate novel robotics solutions with a highly interest in both academic research and down-to-earth solution development, and we are always welcome worldwide collaborators to join our collaboration network.\\n\\nWe are creating the future here！",',
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
  'return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FishLogo, { size });',
  `return (0, react_jsx_runtime.jsx)("img", {
\t\t\t\tsrc: "/favicon.svg",
\t\t\t\talt: "WanglabAI",
\t\t\t\twidth: size,
\t\t\t\theight: size
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
  'children: t("brand.localBuild")',
  'children: "WanglabAI"',
)
replace(
  'node_modules/@deepseek-ai/dsh-client-ui-sidebar/lib/client.js',
  'children: buildVersion',
  'children: "Create Future Here"',
)
replace(
  'node_modules/@deepseek-ai/dsh-client-ui-layout/lib/client.js',
  'productTitle: "DeepSeek Harness",',
  'productTitle: "Wanglab Harness",',
)
replace(
  'node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js',
  '"hero.headline": "探索未至之境",',
  '"hero.headline": "Create Future Here",',
)
replace(
  'node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js',
  '"hero.headline": "Into the Unknown",',
  '"hero.headline": "Create Future Here",',
)
replace(
  'node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js',
  '"hero.preview": "预览版",',
  '"hero.preview": "内测",',
)
replace(
  'node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js',
  '"hero.preview": "Preview",',
  '"hero.preview": "Internal",',
)
replace(
  'node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js',
  'fallback: (0, react_jsx_runtime.jsx)(HeroFish, { hovering })',
  'fallback: (0, react_jsx_runtime.jsx)("img", { src: "/favicon.svg", alt: "WanglabAI", width: 34, height: 34, className: HeroShell_module_css_default.fish })',
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
replace(
  'node_modules/@deepseek-ai/dsh-web-search-deepseek/lib/index.js',
  'const DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com/anthropic/v1";',
  'const DEEPSEEK_DEFAULT_BASE_URL = "https://10.201.2.89:31417/anthropic/v1";',
)
replace(
  'node_modules/@deepseek-ai/dsh-web-search-deepseek/lib/index.js',
  'const USER_AGENT = "deepseek-harness/0.0.1";',
  'const USER_AGENT = "wanglab-harness/0.2.0";',
)
replace(
  'node_modules/@deepseek-ai/dsh-web-search-deepseek/lib/index.js',
  'const DEFAULT_API_KEY_ENV = "DEEPSEEK_API_KEY";',
  'const DEFAULT_API_KEY_ENV = "WANGLABAI_DEEPSEEK_API_KEY";',
)
replace(
  'node_modules/@deepseek-ai/dsh-web-search-deepseek/lib/index.js',
  '?? "https://api.deepseek.com/anthropic/v1",',
  '?? "https://10.201.2.89:31417/anthropic/v1",',
)

copyFileSync(
  resolve(sourceRoot, 'public/favicon.svg'),
  resolve(targetRoot, 'node_modules/@deepseek-ai/dsh-web-frontend/dist/favicon.svg'),
)

console.log('Wanglab localization applied')
