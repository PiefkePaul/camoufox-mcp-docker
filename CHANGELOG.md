# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.3.0] - 2026-07-06

### Added
- CI now publishes the OpenClaw/ClawHub bundle (`@whit3rabbit/camoufox-mcp`) on tagged releases via a `publish-clawhub` job (`clawhub package validate` + `publish --family bundle-plugin` from a clean staging dir), using OIDC trusted publishing with a `CLAWHUB_TOKEN` fallback. Previously the bundle was never published, so `openclaw plugins install clawhub:@whit3rabbit/camoufox-mcp` could not resolve. Requires a one-time trusted-publisher setup on ClawHub for scope `@whit3rabbit`.
- `llms.txt` at the repo root: a link-style install index with per-host commands (Claude Code, Codex, OpenClaw, Hermes, opencode, Pi) for coding agents.

### Fixed
- A `browse`/`snapshot`/`sequence` call on a machine without the Camoufox binary now fails fast with an actionable message naming the fix command (`npx -y camoufox-js fetch`) instead of a generic launch error. npx installs do not prefetch the ~780MB binary.
- Rewrote the OpenClaw and Hermes install docs (README, `docs/configuration.md`): OpenClaw leads with the registry-free `openclaw mcp add …` path that works today (ClawHub install marked as post-publish); Hermes documents the two-step skill + `hermes mcp add` flow with an explicit warning not to use `hermes plugins install` (this repo has no root `plugin.yaml`, so it is rejected as an invalid plugin). Corrected the Hermes tool-name prefix to `mcp__camoufox…`.

## [2.2.0] - 2026-07-04

### Fixed
- Pinned `playwright-core` as a direct dependency (`1.59.0`), not only via `overrides`. npm `overrides` bind the root project only, so `npx camoufox-mcp-server@latest` and global installs previously let `camoufox-js`'s `playwright-core: *` peer float to the latest release (1.61+), which the Camoufox Juggler rejects (`Browser.setDefaultViewport ... isMobile ... not described in this scheme`) — the published server failed to launch a browser on those install paths. The direct pin holds `playwright-core` at 1.59.0 for every install path; the `overrides` entry remains for transitive dedupe.

### Added
- `npm run doctor` preflight (`scripts/doctor.mjs`, no new deps): checks Node >=22, the exact `camoufox-js` pin, that `playwright-core` is a direct pin at the expected version, that the cached browser build matches, then drives a real `browse` to prove the browser launches. Prints the exact fix (including the cache-wipe command) for each failure.
- Skill/docs coverage for bringing the server up and troubleshooting: a local bring-up flow in `SKILL.md`, and troubleshooting entries for corrupt/mismatched browser cache, `better-sqlite3` native-module rebuilds, and `playwright-core` drift under `npx @latest`.

## [2.1.6] - 2026-07-03

### Fixed
- Eliminated `better-sqlite3` NODE_MODULE_VERSION/ABI mismatch failures when the gateway spawns the server with a different Node version than the one that installed dependencies (for example Hermes launching Node 25 via nvm against an npx cache installed under Node 22). On Node 22.15+ the server now redirects camoufox-js's `better-sqlite3` import to a shim backed by the built-in `node:sqlite` module, so the native binary is never loaded. Set `CAMOUFOX_MCP_NO_SQLITE_SHIM=1` to opt out.
- Native module ABI errors that still occur (shim opted out or unavailable) now include an actionable hint in tool error output: the runtime Node version and path, the npx cache location (`~/.npm/_npx`), and rebuild guidance.

### Changed
- Corrected troubleshooting and skill docs that claimed `better-sqlite3` errors come from the host or gateway dependency tree — it is a transitive dependency of this server via `camoufox-js`. Documented the npx cache pitfall and added a troubleshooting entry for Cloudflare challenge pages.

## [2.1.0] - 2026-06-18

### Added
- Advertised server policy in the `initialize` response under `capabilities.extensions["camoufox-mcp"].policy` (`unsafeOptionsAllowed`, `evaluateAllowed`, `captchaAutonomous`, default wait strategy and stealth profile), so clients can inspect posture without launching a browser.
- Logged a stderr warning naming the rejected option family when unsafe browser options are sent without `CAMOUFOX_MCP_ALLOW_UNSAFE_OPTIONS=1`.
- Added opt-in `clickMode: "auto"` for click actions, `CAPTCHA_AUTONOMOUS=true` for LLM-assisted challenge context and provider playbooks, and network sandbox posture reporting in `camoufox_status`.

### Changed
- Defaulted `waitStrategy` to `domcontentloaded` (was `load`) across `browse` and session navigation, avoiding hangs on sites with long-lived connections. Centralized the default and the default stealth profile as config constants.
- Corrected the plugin marketplace manifest to the current schema (top-level `description`/`version`) and documented the `/plugin marketplace add` + install flow.

### Fixed
- Bounded `browse_sequence` with a cumulative action timeout policy and graceful fatal shutdown cleanup.

## [2.0.5] - 2026-05-13

### Fixed
- Preserved blocked private-navigation errors when a page starts navigating during final content extraction.
- Avoided flaky selector screenshot stability waits under Node 24 CI.

## [2.0.4] - 2026-05-13

### Changed
- Switched the NPM release job to npm Trusted Publishing with GitHub Actions OIDC.
- Normalized the package binary path for NPM publish metadata.
- Removed and ignored the generated `repomix-output.xml` artifact.

## [2.0.3] - 2026-05-12

### Fixed
- Removed Playwright's low-level click path from `browse_sequence` click actions to avoid CI virtual display timeouts.

## [2.0.2] - 2026-05-12

### Fixed
- Made `browse_sequence` click actions stable under CI virtual display environments.

## [2.0.1] - 2026-05-12

### Fixed
- Updated the MCP server-reported version to match the package version.
- Made `browse_sequence` click actions avoid waiting for anchor-triggered navigations before the post-action safety guard runs.

## [2.0.0] - 2026-05-12

### Changed
- Raised the minimum supported Node.js version to 22.
- The default `browse` wait strategy is now `load` so JavaScript verification pages have time to complete before content extraction.
- Updated the README install quick start.
- Updated runtime and test dependencies.

### Security
- Bumped transitive `form-data` dependency to 4.0.4.
- Bumped transitive `tar-fs` dependency to 2.1.4.

## [1.5.0] - 2026-05-11

### Added
- Bounded JSON browse responses with text, HTML, and metadata output modes.
- CSS selector extraction and configurable output character limits.
- Server policy controls for unsafe browser options, concurrency, queue length, and screenshot limits.
- Initial URL, redirect, final URL, and browser request SSRF protections for local, private, link-local, and reserved address space.
- Local and Docker regression tests for blocked localhost targets and unsafe browser options.

### Changed
- Docker publishing targets `linux/amd64`.
- The default browse response returns visible text instead of raw HTML.

### Fixed
- CI now fails on local test failures.
- Local test runner now executes from the repository root.

## [1.1.0] - 2025-01-10

### Added
- Enhanced anti-detection features with OS auto-rotation
- Configurable wait strategies (domcontentloaded, load, networkidle)
- Custom timeout parameter (5-300 seconds)
- Humanize option for realistic cursor movements
- Locale configuration support
- Custom viewport dimensions
- Screenshot capture capability
- Comprehensive parameter validation with Zod
- Multi-architecture Docker support (amd64/arm64)
- NPM package configuration with executable binary
- GitHub Actions CI/CD pipeline

### Changed
- Upgraded from basic browse tool to enhanced parameter support
- Improved error handling and logging
- Better TypeScript type safety

### Fixed
- Docker container headless mode detection
- Browser cleanup on process termination

## [1.0.0] - 2025-01-09

### Added
- Initial release
- Basic browse tool with URL parameter
- MCP server implementation
- Docker support
- Camoufox browser integration
