# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript-based MCP (Model Context Protocol) server that provides browser automation capabilities using Camoufox (a privacy-focused Firefox fork). The server exposes a single `browse` tool that allows AI models to navigate to URLs and retrieve HTML content with extensive privacy controls and anti-detection features.

## Commands

### Development
- `npm run build` - Clean and compile TypeScript to dist/
- `npm run dev` - Watch mode for TypeScript compilation
- `npm start` - Run the compiled server
- `npm test` - Build and run Python test client locally
- `npm run test:camoufox` - Run Camoufox-specific tests
- `npx eslint src/` - Run ESLint for code quality checks

### Docker
- `./publish_docker.sh` - Build and publish multi-architecture Docker images (AMD64/ARM64)
- `./tests/run_tests.sh` - Run tests using Docker container
- `./tests/run_tests_local.sh` - Run tests against local server

### Testing Individual Components
- Run Python test client directly: `python tests/test_client.py` (supports --mode docker|local)
- Test server in Docker: `docker run --rm followthewhit3rabbit/camoufox-mcp`
- `camoufox_status` is a cheap liveness check but does not launch a browser; `browserAvailable: true` does not guarantee a `browse` will launch. Confirm an actual `browse` works before trusting the browser.
- Smoke-test the server without an MCP host via raw JSON-RPC against `node dist/index.js` (see `plugins/camoufox/skills/camoufox/references/json-rpc-debug.md`): send `initialize`, then a `browse` `tools/call`.

## Dependency & Browser Pinning
- Verified-good triple (full local suite, macOS arm64): `camoufox-js` 0.10.2 + `playwright-core` 1.59.0 + browser binary 135.0.1-beta.24. Run `npm run doctor` to confirm it end-to-end (it drives a real `browse`).
- **`playwright-core` MUST be a direct pinned dependency, not just an `overrides` entry.** npm `overrides` only bind the root project, so they do NOT pin `playwright-core` when this package is installed as a dependency (`npx camoufox-mcp-server@latest`, global install, or as someone else's dep). In those paths `camoufox-js`'s peer `playwright-core: *` floats to the newest release, which is incompatible with the Camoufox Juggler — this shipped a broken server to npx users until `playwright-core` was added to `dependencies`. Keep both: the direct `dependencies` pin holds every install path; the `overrides` entry dedupes the transitive copy. Do not loosen either.
- `playwright-core` ceiling: 1.59.0 is the newest that passes the full suite. 1.60.0 breaks the "delayed private navigation" **security guard** (`TypeError: Cannot read properties of undefined (reading 'url')` from a changed Playwright response-event payload). 1.61.0 sends `isMobile` in `Browser.setDefaultViewport`, which the Camoufox Juggler rejects (`... isMobile ... not described in this scheme`) — confirmed still rejected by the 150 build too. `isMobile` is unsupported in Firefox and has no replacement; the fix is matching pw to the Camoufox build, not a new option (see daijro/camoufox#612). Do not bump pw without re-running the full suite.
- Newest stable Camoufox binary is 135.0.1-beta.24. `camoufox-js` 0.11.x fetches newer alpha builds (0.11.1 pulls 152.0.4-alpha.25; Linux + macOS only, no Windows build) and was evaluated and **not adopted**. It launches and non-screenshot browsing works (~3s warm), but it **breaks all screenshots**: `page.screenshot` fails with `Protocol error (Page.screenshot): can't access property "document", win is undefined` in both headless and headed modes. Verified upstream — reproduces with a bare `camoufox-js` + `playwright-core@1.59.0` script (no MCP server), so it is a Camoufox 152 Juggler regression, not ours; pw is already pinned and cannot be moved (1.60+ break navigation/isMobile). It also does NOT fix `isMobile`. Camoufox flags these post-146 builds as experimental. Do not adopt 0.11.x until upstream ships a build with working screenshots; 0.11.1 fails the full suite at the screenshot cases (`npm run test:all`).
- If you change the pinned triple, also update the `EXPECTED` const in `scripts/doctor.mjs` (it mirrors this section).
- Always wipe the cache before changing binary versions (overlaying a new build onto an old bundle corrupts it, e.g. `Library not loaded: @rpath/libmozglue.dylib`). Reset: `rm -rf ~/Library/Caches/camoufox/Camoufox.app ~/Library/Caches/camoufox/version.json && npx -y camoufox-js@0.10.2 fetch`

## Release & Versioning

Releases are tag-driven. `.github/workflows/ci.yml` runs tests on every push/PR; pushing a `v*` tag additionally publishes to NPM (Trusted Publishing / OIDC), builds and pushes Docker images (Docker Hub + GHCR), and creates a GitHub Release.

The version string lives in seven files and **must stay in sync** (the test suite asserts `camoufox_status.version` == `package.json` version, and `SERVER_VERSION` feeds that response):
- `package.json` (`version`)
- `src/config.ts` (`SERVER_VERSION`)
- `.claude-plugin/marketplace.json` (top-level `version`)
- `plugins/camoufox/.claude-plugin/plugin.json` (`version`)
- `plugins/camoufox/.codex-plugin/plugin.json` (`version`)
- `plugins/camoufox/package.json` (`version` — the `@whit3rabbit/camoufox-mcp` OpenClaw bundle)
- `plugins/camoufox/openclaw.plugin.json` (`version`)

Release steps:
1. Bump all seven version strings to the new version.
2. Move the `[Unreleased]` entries in `CHANGELOG.md` under a new `## [x.y.z] - YYYY-MM-DD` heading; leave a fresh empty `[Unreleased]`.
3. Run `npm run test:all` (or at least `npm run build` + `npm run test:unit`) and commit.
4. Tag `vX.Y.Z` and push the tag. CI handles NPM, Docker, and the GitHub Release; the release body links `CHANGELOG.md`.

SemVer: new tools/params or additive capabilities → minor; behavior changes to defaults are called out in the changelog `Changed` section.

## Architecture

### Core Server (`src/index.ts`)
The main MCP server implementation:
- Uses stdio transport for communication
- Implements single `browse` tool with comprehensive parameter set
- Automatically detects environment (Docker/Linux vs local) for headless mode selection
- Handles graceful shutdown on SIGINT/SIGTERM
- Returns HTML content with optional screenshot capture
- Enhanced error handling with detailed debugging information

### Browser Integration
- Uses `camoufox-js` for browser automation
- Supports OS spoofing (Windows 11, macOS, Linux) with automatic rotation
- Implements configurable headless modes:
  - Standard headless for local development
  - Virtual display (Xvfb) for Linux/Docker environments
  - User-configurable headless option
- Enhanced privacy controls:
  - WebRTC blocking
  - Image blocking for faster loading
  - WebGL blocking (anti-fingerprinting)
  - Cross-Origin-Opener-Policy control
  - Proxy support with authentication
  - Custom Firefox preferences
  - Addon exclusion control

### Docker Architecture
Multi-stage build process:
1. Builder stage: Compiles TypeScript and fetches Camoufox browser
2. Runtime stage: Minimal Alpine image with Node.js and required dependencies
3. Uses Xvfb for headless operation in containers

## Browse Tool Parameters

The `browse` tool supports extensive configuration options:

### Core Parameters
- `url` (required): Target URL to navigate to
- `waitStrategy`: Page load strategy (domcontentloaded, load, networkidle)
- `timeout`: Page load timeout (5-300 seconds)
- `screenshot`: Capture PNG screenshot after loading

### Privacy & Anti-Detection
- `os`: OS spoofing (windows, macos, linux) - auto-rotates if not specified
- `humanize`: Enable realistic cursor movements (default: true)
- `geoip`: Auto-detect geolocation from IP (default: true)
- `block_webrtc`: Block WebRTC entirely for privacy
- `block_images`: Block images for faster loading
- `block_webgl`: Block WebGL to prevent fingerprinting
- `disable_coop`: Disable Cross-Origin-Opener-Policy

### Browser Configuration
- `locale`: Browser locale setting
- `viewport`: Custom viewport dimensions
- `headless`: Headless mode control (auto-detects if not specified)
- `proxy`: Proxy configuration (string or object with auth)
- `enable_cache`: Enable browser caching
- `firefox_user_prefs`: Custom Firefox preferences
- `exclude_addons`: Exclude default addons
- `window`: Fixed window size
- `args`: Additional browser arguments

## Key Implementation Details

- The server validates tool calls using comprehensive Zod schemas
- Browser instances are created per request (not persisted)
- Error handling includes detailed error messages for debugging
- Process lifecycle is managed with proper cleanup on exit
- Cross-platform support with architecture-specific browser fetching
- Screenshot capture returns base64-encoded PNG data
- Enhanced logging with colored output for better debugging