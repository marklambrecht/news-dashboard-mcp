# TH security and migration review — 22 October 2026

All three complete npm dependency trees, including development packages, now report **zero known vulnerabilities**. The 28 moderate findings left by the first patch pass have been removed. Major migrations were tested before being accepted. Electron distribution remains blocked because the current vendor binary still contains an unpatched Node runtime.

## Audit results

Counts below are affected packages, including parent packages, rather than distinct CVEs.

| Repository | Original critical / high / moderate / low | After compatible patches | After migration, full tree | Production after migration |
| --- | --- | --- | --- | --- |
| news-dashboard | 4 / 10 / 12 / 1 | 8 moderate | 0 | 0 |
| news-dashboard-nest | 1 / 36 / 5 / 0 | 20 moderate | 0 | 0 |
| news-dashboard-mcp | 1 / 9 / 2 / 1 | 0 | 0 | 0 |

`security-audit-2026-10-22.json` retains the original audit, pre-migration results, final full-tree audit and production audit. These are registry advisory checks as of this review, not a certification that unknown vulnerabilities cannot exist.

## Accepted migrations

| Area | Validated version or change |
| --- | --- |
| Runtime | Node 24.22.1; npm 12.2.1; pinned Node CI jobs and package-manager metadata |
| Frontend | React/React DOM 19.3.1, MUI/icons 9.5.0, drag-and-drop 18.0.1 |
| Build | Vite 8.3.5, React plugin 6.1.2, Oxc JSX transform, explicit Safari 17 build target |
| UI tests | React Testing Library 16.3.3, jest-dom 7.0.1, user-event 14.6.8, jsdom 30.1.3 |
| Backend | Nest 12.2.0 and compatible Nest adapters, native ESM, TypeScript 6.0.3, ESLint 10.13.0 |
| AI clients | OpenAI 7.42.0, Anthropic 1.1.0; native-fetch wire contracts tested with isolated fixtures |
| Rendering | PDFKit 0.20.2, Chromium-min 153.0.0 with matching download URL, current Puppeteer |
| Audio | Obsolete fluent-ffmpeg and bundled FFmpeg installers removed; maintained FFmpeg 9.0.2 runtime |
| MCP | Express 5.3.0 and TypeScript 7.0.2; live Host/Origin boundary regression passes |
| Metrics | web-vitals 6.2.3, on* callbacks and INP in place of removed get*/FID callbacks |

Other available compatible package updates are included in the committed lockfiles. Search now explicitly declares its previously implicit date-fns dependency. MUI migrations replace removed input, label, dialog, tab and system props and renamed icons; digest settings remain labelled and editable.

Nest 12 publishes ESM. The backend now uses native ESM imports with explicit relative extensions, type-only imports where required by decorators, and ESM-aware Jest execution. Both Vercel entry points were imported successfully **with require(esm) disabled**. This preserves the earlier serverless-startup regression check instead of relying on a runtime interop flag. TypeScript 6's explicit root directories, test globals and error handling were addressed. Existing backend formatting/lint errors were cleaned up; lint has zero errors and 222 existing type-safety warnings. Unknown error values are handled without serialising credential-bearing objects.

## Removed sprintf-js finding

[sprintf-js CVE-2026-97058](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) has no published patched release. The vulnerable package was removed rather than hidden from audit:

- Frontend: the Electron downloader uses global-agent 4.1.3 through a scoped override, removing its old roarr/sprintf-js chain. Desktop build tooling still loads and its regression test passes.
- Backend: the scoped Istanbul loader override uses js-yaml 4, whose `load` API is compatible with the caller. This removes argparse 1/sprintf-js. All backend tests pass with that resolved tree.

Fresh `npm ci --ignore-scripts` installations of all three lockfiles succeeded in separate clean directories, with no audit findings or invalid root dependencies. npm 12 is pinned for consistent override resolution.

## Runtime and yesterday's security releases

The [Node.js 21 October advisory](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases) includes Brotli decoder RCE, DNS handling and TLS hostname-validation issues. Node 24.22.1 is used for the application checks. It and npm 12.2.1 are installed under `~/.local/share/th-node`, selected in `~/.zprofile`, and verified in a new login shell. The old root-owned `/usr/local/bin/node` file remains; previously running processes and software that hard-code that absolute path require restart or reconfiguration. The machine-wide inventory of unrelated services was not changed.

The [PHP Foundation's advisory](https://thephp.foundation/blog/2026/10/21/todays-php-security-release-and-how-were-strengthening-php-security/) describes CVE-2026-109618 and CVE-2026-109619. These repositories do not declare a PHP runtime. Separately managed PHP infrastructure still requires its own inventory; updating npm packages does not patch PHP.

### Electron: release blocked

The actual installed Electron **45.0.0** binary reports embedded Node **24.22.0**, matching the [official release table](https://releases.electronjs.org/), which predates the Node security fixes. A system Node update cannot replace that embedded runtime.

`npm run test:electron-runtime` and the `preelectron-pack` hook now inspect the real binary and reject unpatched supported branches. The rejection was verified against Electron 45.0.0. No Windows/Electron installer was generated. Once a vendor release contains the fixes, update Electron, run the runtime gate, rerun the migration suite and then package it. The app already disables renderer Node integration and enables sandbox/context isolation; those controls are not claimed to patch the vendor binary.

The native Mac and iPhone/iPad applications use Swift/WKWebView and do not embed Electron or Node. This migration changes hosted JavaScript/backend code; no Swift sources changed and the previously generated native packages remain compatible. Real iOS/iPadOS device testing has not been newly performed.

## Maintained audio runtime

Testing the newest ffmpeg-static wrapper revealed that it still downloaded FFmpeg 6.0 on this Mac. It was not retained. FFmpeg 9.0.2 was installed through Homebrew for local testing. Linux x64 builds use a retained month-end [BtbN build](https://github.com/BtbN/FFmpeg-Builds/releases/tag/autobuild-2026-09-30-13-08), pinned by **archive and executable SHA-256** in `scripts/ffmpeg-runtime.json`.

The provider retains this month-end artifact for two years; short-lived daily artifacts are not used. The installer verifies both digests, uses a private cache and bounded download, and extracts only the expected executable. The Linux artifact was downloaded and verified; the Mac host cannot execute Linux binaries. The added Ubuntu CI job installs that artifact and runs the actual WAV/MP3 audio regression. The local regression executes FFmpeg 9.0.2 and produces both formats. Vercel includes the generated `vendor/ffmpeg/ffmpeg` explicitly; the binary is not committed to Git. `FFMPEG_PATH` can select a maintained provisioned binary; unsupported platforms need FFmpeg on PATH. The app rejects runtimes older than 9.0.2 when audio is requested.

## Compatibility holds

Two newest major versions are outside their consumers' published peer ranges:

- Frontend ESLint stays on 9.39.5 because eslint-plugin-react 7.37.5 declares support through ESLint 9. The configuration was migrated to flat config and all frontend lint checks pass.
- Backend TypeScript stays on 6.0.3 because ts-jest requires TypeScript below 7 and typescript-eslint currently requires below 6.1. MCP has no such dependency and successfully migrated to TypeScript 7.0.2.

These are explicit compatibility decisions, with no current npm audit findings. They were not forced through `--legacy-peer-deps` or unsupported peer resolution. Deprecation notices on older transitive tooling are not treated as evidence of an unpatched CVE when the actual final audit is clean; they remain maintenance considerations.

## Validation

- Frontend: 114 tests, 21 security/build-tool checks, zero lint errors and production build pass.
- Real Chrome: authenticated news, settings, editable digest controls and a 390px layout pass with no browser runtime errors; screenshots inspected. API fixtures are isolated from the service worker.
- Offline browser check: cold launch and lazy App import work offline; 73 cached assets cover 51 manifest chunks. This is tested separately with the real service worker enabled.
- Backend: 93 tests across 15 suites, TypeScript production build, zero lint errors, AI SDK fixture contracts, maintained native audio conversion and serverless ESM startup pass. Native-module test fakes do not send email or make paid AI calls.
- MCP: build plus live localhost Host/Origin security test pass.
- Clean installs and full/production audits pass for every repository. CI migration workflows retain these checks, including Linux audio validation.
- Electron's runtime check intentionally fails until the vendor supplies a patched binary; it is not counted as a passing release check.

The pushed commits still need successful hosting deployment. Running production Node/Chromium versions, scheduled live AI/email delivery and CI completion were not independently verified through authenticated hosting APIs. Browser/mobile-layout checks do not replace physical iOS WidgetKit, SideStore, background scheduling or Apple signing tests.
