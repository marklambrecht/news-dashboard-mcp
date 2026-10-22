# TH dependency and runtime security review — 22 October 2026

The production dependency audits for the frontend, Nest backend and MCP service now report **zero known vulnerabilities**. All high and critical findings in the complete dependency trees have been removed. This does not certify the deployed infrastructure or the embedded Electron runtime as patched.

## Results

Counts are affected packages (including parent packages), not distinct CVEs.

| Repository | Before: critical / high / moderate / low | After: critical / high / moderate / low | Production after |
| --- | --- | --- | --- |
| news-dashboard | 4 / 10 / 12 / 1 | 0 / 0 / 8 / 0 | 0 |
| news-dashboard-nest | 1 / 36 / 5 / 0 | 0 / 0 / 20 / 0 | 0 |
| news-dashboard-mcp | 1 / 9 / 2 / 1 | 0 / 0 / 0 / 0 | 0 |

Evidence: `docs/security-audit-2026-10-22.json` in each repository. Audits used the npm registry on 22 October, both with and without development packages. Before and after records are retained in those files.

## Urgent runtime findings

The installed shell originally ran Node **22.14.0**, older than even the backend's previous minimum. Node's [21 October security release](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases) fixes DNS/NUL handling, TLS hostname validation, keep-alive response confusion and a Brotli decoder out-of-bounds write permitting remote code execution (CVE-2026-111497). TH fetches untrusted RSS and article responses, making this a relevant runtime concern; a successful exploit against TH has not been demonstrated.

All three repositories now require Node **24.22.1**, pin it in `.nvmrc`, and use it in existing Node CI jobs. Tests and JavaScript builds were run with that version from an isolated temporary installation. The machine's global Node installation was not replaced. Use `nvm install && nvm use` in each repository. Vercel must provision a patched 24.x runtime on redeployment; package settings alone do not prove what a running deployment uses.

The [PHP Foundation's 21 October advisory](https://thephp.foundation/blog/2026/10/21/todays-php-security-release-and-how-were-strengthening-php-security/) concerns CVE-2026-109618 and CVE-2026-109619, critical PHP memory-corruption RCE vulnerabilities. These repositories use JavaScript/TypeScript and native Swift, with no PHP runtime declared in their manifests. There is no evidence of direct PHP exposure here. Any separately managed PHP infrastructure requires its own inventory and patch verification.

## Package fixes and exposure

- Updated the compatible dependency trees, including Axios and redirect handling, `proxy-addr`, DOMPurify, Sharp/libvips/librsvg, Nodemailer, Express, Multer, and the MCP SDK. The corresponding advisories include credential leakage, IP spoofing, unsafe input handling and denial of service. Their presence is not evidence they were exploited.
- Upgraded Vitest to **5.0.5** to remove vulnerable mock/worker dependencies, including the [Tinypool worker RCE gadget](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3). This primarily protects developer and CI execution.
- Upgraded Jest to **30.5.2**, its types and ts-jest, removing high-severity pattern-processing and test dependencies. Updated the integration-test CLI flag for Jest 30.
- The MCP HTTP server previously listened on all interfaces while using the configured user's backend token. It now binds to loopback, uses the SDK's Host validation and rejects foreign browser Origins. A live HTTP regression test covers those boundaries. Stdio behavior is unchanged.

## Remaining findings and upgrade decisions

The residual 8 frontend and 20 backend moderate findings all trace to [sprintf-js CVE-2026-97058](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), which currently has **no published patched version**. Frontend: electron-builder → @electron/get → global-agent → roarr → sprintf-js. Backend: Jest/ts-jest → Babel/Istanbul → js-yaml 3 → argparse → sprintf-js. These packages are development dependencies; production-only audits are clean. An attacker-controlled format string can cause a RangeError/denial of service. No request-facing TH path into these format strings was established. Recheck upstream patches and avoid untrusted build configuration. Do not apply npm's suggested Jest downgrade: it reintroduces older vulnerable tooling.

Electron was updated from 44.2.0 to **44.9.3**. The [official release table](https://releases.electronjs.org/) currently lists Node **24.22.0** inside both 44.9.3 and 45.0.0, preceding yesterday's Node fixes. Updating the system Node does not update Electron's embedded Node. The Electron shell disables Node integration, enables sandbox/context isolation, and uses Chromium networking, which reduces direct exposure; this is not proof of immunity. Monitor for a vendor release incorporating the fixes and rebuild Windows/Electron packages then. The regenerated Mac and iOS apps are Swift/WKWebView applications and do not embed Electron or Node. No Windows installer was regenerated in this change.

Larger non-security migrations remain separate work: React 19, MUI 9, Nest 12, Vite 8, ESLint 10, TypeScript 7 and newer AI SDK majors. The current compatible versions were updated and tested; those major migrations require focused API/UI validation and are not substitutes for runtime patching. Deprecated `fluent-ffmpeg` and its bundled FFmpeg installer should be evaluated for replacement and native-binary maintenance; npm audit does not establish FFmpeg/Chromium/OS binary safety.

## Validation and limits

Frontend regression, security tests, lint and production build pass. Backend regression and HTTP integration tests and TypeScript build pass. MCP build and live Host/Origin security test pass. Native widget/store and Mac bridge tests pass; iOS archive and signed universal Mac build succeed. Backend-wide ESLint already fails on the baseline (2,755 errors and 200 warnings), mostly formatting/type-rule debt; that existing cleanup is not included in this change.

Native deliverables are a SideStore IPA (keep THWidget and THShare) and a locally signed development Mac app/ZIP, not a notarized public release. Physical device widget scheduling, SideStore installation and live daily AI/email execution remain operational checks. The test suite mocks AI providers and email and does not send mail. No authenticated production runtime inventory or exploit investigation was performed. npm audit cannot detect every new advisory, compromised package, infrastructure problem or logic flaw.
