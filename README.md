<p align="center">
  <a href="https://github.com/hairyf/deepseek-harness-pkg">
    <img src="public/favicon.svg" width="112" alt="DeepSeek Harness Pkg" />
  </a>
</p>

<h1 align="center">DeepSeek Harness Pkg</h1>

<p align="center">
  <em>Prebuilt, cross-platform packages for <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> (<code>dsh</code>) — pinned, patched, and auto-synced from upstream, built by GitHub Actions.</em>
</p>

<p align="center">
  <strong>English</strong> · <a href="./README.zh.md">中文</a>
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/%40deepseek-ai%2Fdsh?style=flat-square&label=dsh" alt="dsh" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-black?style=flat-square" alt="Windows | macOS | Linux" />
  <img src="https://img.shields.io/badge/pnpm-11-4D6BFE?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm 11" />
  <img src="https://img.shields.io/badge/Node.js-22.19%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js 22.19+" />
</p>

> **Status: developer preview.** The upstream `dsh` is still iterating rapidly with compatibility-breaking changes; this repository tracks it closely and rebuilds automatically.

## What Is This?

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) is an open-source agent harness with a CLI, a web UI, and a plugin architecture. Setting it up normally means installing Node.js and pnpm and building from source.

This repository (inspired by [n8n-pkg](https://github.com/hairyf/n8n-pkg)) removes that friction: it pins an upstream npm release, patches the dependency closure, and publishes ready-to-run `node_modules` bundles for Windows, macOS (Apple Silicon + Intel), and Linux. Consumers just download a zip from the [Releases](https://github.com/hairyf/deepseek-harness-pkg/releases) page, unzip, and run `dsh web`.

## Features

| | |
| --- | --- |
| **Pinned & reproducible** | A pnpm workspace pins a single upstream version (`@deepseek-ai/dsh`), with patches recorded in `patches/` and a committed lockfile. |
| **Patched dependency closure** | `patchedDependencies` patches packages inside the dependency closure, including a LAN-access switch for `dsh web`. |
| **Cross-platform artifacts** | CI builds bundles for Windows, macOS (arm64 + x64), and Linux and publishes them as GitHub Releases. |
| **Auto-sync with upstream** | A scheduled workflow watches npm for new `dsh` versions and triggers a rebuild automatically. |
| **Self-contained output** | Each artifact is a plain npm project — unzip, run the `dsh` binary inside `node_modules`, done. |

## Quick Start

1. Download the artifact for your platform from the [Releases](https://github.com/hairyf/deepseek-harness-pkg/releases) page.
2. Unzip the archive.
3. Run:

```sh
# Windows
node_modules\.bin\dsh.cmd web

# macOS / Linux
./node_modules/.bin/dsh web
```

The web UI opens at `http://127.0.0.1:3080`. On first use, configure a model provider (API key) in the UI — see the [official DeepSeek Harness docs](https://github.com/deepseek-ai/deepseek-harness).

> Requirements: Node.js `^22.19.0` or `>=24.0.0`. The artifact is a plain npm project, so no global pnpm installation is needed.

## Repository Structure

```text
.
├── .github/workflows/
│   ├── release.yml                 # cross-platform build + release (manual or called by sync)
│   └── sync-release.yml            # scheduled upstream check that auto-triggers builds
├── scripts/
│   └── apply-dsh-web-app-patch.mjs # idempotent patch script (re-applies the LAN switch on version bumps)
├── patches/                        # pnpm patches (patchedDependencies, version-pinned & reproducible)
├── pnpm-workspace.yaml             # nodeLinker / build policy / patchedDependencies (pnpm 11 settings)
├── package.json                    # pinned @deepseek-ai/dsh version
└── pnpm-lock.yaml                  # lockfile
```

## Local Build

Requirements: Node.js `>=22.19` (recommended 24), pnpm `11.x` (the repo declares `packageManager: pnpm@11.7.0`).

```sh
pnpm install            # install dependencies and apply patches
pnpm start              # run dsh web directly (http://127.0.0.1:3080)
pnpm build              # produce the prod deployment directory build_dir/
```

## Release

Open the repository's Actions page and manually trigger **Build and Release DeepSeek Harness**:

- `dsh_version`: the dsh version to package, defaults to `0.1.0-rc.6` (must match the version targeted by `patches/`, otherwise the build fails on a patch mismatch).

The build creates a GitHub Release named `dsh-<version>-<run_id>` with four platform zips:

| Platform | Artifact |
| --- | --- |
| Windows | `deepseek-harness-pkg-windows.zip` |
| macOS (Apple Silicon) | `deepseek-harness-pkg-macos-arm64.zip` |
| macOS (Intel) | `deepseek-harness-pkg-macos-x64.zip` |
| Linux | `deepseek-harness-pkg-linux.zip` |

## Patches

### dsh-web-app: LAN access (default off)

Upstream `dsh web` rejects `--host 0.0.0.0` for security reasons (it would expose the remote-code-execution surface to the network). The `patches/dsh-web-app@0.1.0-rc.6.patch` patch turns this into an **explicit environment-variable switch**:

```sh
# still rejected by default
dsh web --host 0.0.0.0            # error

# allow explicitly after acknowledging the risk (dangerous: exposes local RCE to the network)
DSH_PKG_ALLOW_LAN=1 dsh web --host 0.0.0.0 --trusted-host <LAN-IP>:3080
```

> ⚠️ Security warning: `--host 0.0.0.0` lets any device on your LAN access your sessions and tool execution. Use it only in trusted networks and pair it with `--trusted-host` to restrict the `/api` trust domain.

### Adding or updating patches

```sh
pnpm patch @deepseek-ai/dsh-web-app   # edit, then pnpm patch-commit to produce a .patch
```

Then register the new entry under `patchedDependencies` in `pnpm-workspace.yaml` (the version must match what the lockfile resolves). When upgrading dsh, `patches/` must be updated accordingly.

## Auto-sync Upstream Releases

The built-in `sync-release.yml` workflow:

- **Trigger**: checks every 6 hours; can also be triggered manually from the Actions page (with an optional `version`, or `force=true` for a forced rebuild).
- **Sync signal**: upstream `deepseek-ai/deepseek-harness` does not publish GitHub Releases, so the npm `@deepseek-ai/dsh` `latest` version is the source of truth; when a new version is found, `release.yml` is invoked via `workflow_call` — no manual button, no PAT required.
- **Patch tolerance**: on version bumps, stale `patchedDependencies` entries are ignored (`allowUnusedPatches: true`), and `scripts/apply-dsh-web-app-patch.mjs` idempotently re-applies the LAN switch to the shipped `dsh-web-app` — as long as upstream keeps the `0.0.0.0` guard it adapts automatically; if upstream changes the relevant code, the script fails loudly with a message to update.
- **Release-age gate**: pnpm 11 rejects "too new" dependencies by default; `minimumReleaseAge: 0` in `pnpm-workspace.yaml` disables that so a fresh upstream publish can be synced immediately. `dangerouslyAllowAllBuilds: true` lets unknown native dependencies in new versions run their build scripts (same behavior as n8n-pkg's `allow-scripts=true` and npm's default); to tighten supply-chain security, switch back to an explicit `allowBuilds` allowlist.

Workflow reference:

```mermaid
flowchart LR
    N[npm @deepseek-ai/dsh latest] --> S[sync-release.yml every 6h]
    S -->|new version found| R[release.yml workflow_call]
    R --> W[Windows build]
    R --> M[macOS arm64 build]
    R --> I[macOS x64 build]
    R --> L[Linux build]
    W --> G[GitHub Release]
    M --> G
    I --> G
    L --> G
```

## Security Notes

- This project is for personal learning, research, and testing only — please do not use it commercially.
- `dsh` is an agent harness with **local code execution capability**. Run it only in a trusted, isolated environment, and never import untrusted configurations or plugins from unknown sources.
- The LAN-access patch (`DSH_PKG_ALLOW_LAN=1`) is dangerous by design — only enable it on trusted networks.
- The developers are not liable for any data loss or security issues arising from the use of this project.

## Related Projects

| Project | Purpose |
| --- | --- |
| [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) | The upstream `dsh` (CLI + web UI + plugin architecture) |
| [deepseek-harness-desktop](https://github.com/hairyf/deepseek-harness-desktop) | One-click desktop app that consumes these prebuilt bundles |
| [n8n-pkg](https://github.com/hairyf/n8n-pkg) | Reference packaging repository this project is based on |

## Acknowledgements

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — the upstream project
- [n8n-pkg](https://github.com/hairyf/n8n-pkg) — the packaging pattern
- [pnpm](https://pnpm.io/) — workspace, patching, and deploy tooling
- [GitHub Actions](https://github.com/features/actions) — cross-platform CI builds and releases
