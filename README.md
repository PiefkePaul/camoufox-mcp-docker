# Camoufox MCP Server for NAS and Docker

This fork turns `camoufox-mcp` into an MCP server that can run as a long-lived Docker service on a NAS and be exposed as a remote MCP endpoint for clients such as Claude and ChatGPT.

It keeps the upstream browser automation tools and security policy, and adds a network-facing HTTP mode, a health endpoint, Docker Compose support, and runtime configuration through environment variables or CLI flags.

## Quick Install

Use the published npm package unless you are developing this repository locally.

### Tell your LLM

```bash
Install camoufox-mcp and the skill using this URL: https://raw.githubusercontent.com/whit3rabbit/camoufox-mcp/refs/heads/main/llms.txt
```

### Claude Code CLI

```bash
claude mcp add camoufox -- npx -y camoufox-mcp-server@latest
```

For a shared project-scoped Claude Code config:

```bash
claude mcp add --scope project camoufox -- npx -y camoufox-mcp-server@latest
```

Verify with `/mcp` inside Claude Code.

### Codex CLI

```bash
codex mcp add camoufox -- npx -y camoufox-mcp-server@latest
```

Codex stores MCP servers in `~/.codex/config.toml` by default. Verify with `/mcp` inside Codex.

### Agent Skill and Plugin Bundle

Use these when you want the `camoufox` skill plus the packaged MCP server config. If you only need the MCP server, use the Claude Code or Codex MCP commands above. Bare `npx -y camoufox-mcp-server@latest` remains safe by default. The packaged plugin bundle enables `CAMOUFOX_MCP_ALLOW_UNSAFE_OPTIONS=1` so the skill can use `firefox_user_prefs`, `args`, and `exclude_addons` for hard-site tuning.

#### OpenClaw

Register the MCP server directly. This works today with no registry publish (`--arg`
is singular and repeatable; the `--env` flag enables the unsafe-option tuning):

```bash
openclaw mcp add camoufox --command npx --arg -y --arg camoufox-mcp-server@latest --env CAMOUFOX_MCP_ALLOW_UNSAFE_OPTIONS=1
openclaw mcp list
```

OpenClaw exposes the tools with provider-safe names such as `camoufox__browse`.

Or install the published ClawHub bundle (skill + MCP config in one step):

```bash
openclaw plugins install clawhub:@whit3rabbit/camoufox-mcp
openclaw plugins inspect camoufox
openclaw plugins doctor
openclaw gateway restart
```

#### Claude Code

Install the plugin from this repo's marketplace:

```text
/plugin marketplace add whit3rabbit/camoufox-mcp
/plugin install camoufox@camoufox-mcp
```

Restart Claude Code or start a new session after installing.

#### Codex

Install the plugin from this repo's marketplace:

```bash
codex plugin marketplace add whit3rabbit/camoufox-mcp
codex plugin add camoufox@camoufox-mcp
```

Restart Codex or start a new thread after installing.

#### Hermes

Two commands: install the skill, then register the MCP server (Hermes skill installs do
**not** auto-register MCP servers).

```bash
hermes skills install whit3rabbit/camoufox-mcp/plugins/camoufox/skills/camoufox
printf "Y\n" | hermes mcp add camoufox --command npx --env CAMOUFOX_MCP_ALLOW_UNSAFE_OPTIONS=1 --args -y camoufox-mcp-server@latest
```

> **Hermes TTY Gotcha:** `hermes mcp add` interactively prompts `"Enable all 17 tools? [Y/n/select]"`. On a non-TTY (piped/scripted inputs), the default response is `"n"` (canceled). Pipe `Y\n` as shown above to enable tools automatically.

Do **not** run `hermes plugins install …` for this repo. Hermes plugins are Python
packages with a root `plugin.yaml`; this repo has neither, so it clones but is rejected
as "not a valid plugin." Use the two commands above.

Hermes treats `--args` as plain argv tokens and it must be the last option. Do not pass a
JSON array string there. In `~/.hermes/config.yaml`, `env` must be a **mapping**
(`KEY: "value"`), not a list. Verify with:

```bash
hermes mcp list
hermes mcp test camoufox
```

First `browse` on a fresh machine needs the browser binary once (~780MB); if a call
reports it is missing, run `npx -y camoufox-js@0.10.2 fetch` and retry (do not omit the `@0.10.2` version pin).

Restart Hermes from a separate terminal after changing MCP config. Hermes namespaces MCP
tools as `mcp_camoufox_<tool>` (single underscore, e.g. `mcp_camoufox_browse`,
`mcp_camoufox_camoufox_status`; some setups show the double-underscore form
`mcp__camoufox__browse`) — use whatever your tool list shows, and confirm
`mcp_camoufox_camoufox_status` reports `unsafeOptionsAllowed: true`. `browser_navigate` is
Hermes' own built-in browser tool, not Camoufox.

For local-clone installs and additional hosts, see [Configuration for AI assistants](docs/configuration.md#installable-agent-skill-and-plugin-bundle).

### opencode

Add this to `opencode.json` in your project or to `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "camoufox": {
      "type": "local",
      "command": ["npx", "-y", "camoufox-mcp-server@latest"],
      "enabled": true
    }
  }
}
```

Verify with:

```bash
opencode mcp list
```

### Pi Coding Agent

Install the MCP adapter, then add Camoufox to `.mcp.json` or `~/.config/mcp/mcp.json`:

```bash
pi install npm:pi-mcp-adapter
```

```json
{
  "mcpServers": {
    "camoufox": {
      "command": "npx",
      "args": ["-y", "camoufox-mcp-server@latest"]
    }
  }
}
```

## Try Camoufox

Once configured, ask your assistant for browser work in plain language:

```text
Use Camoufox to browse https://example.com and return metadata only.
```

```text
Use Camoufox to inspect the interactive elements on https://example.com.
```

```text
Use Camoufox to open https://example.com, take a screenshot, and summarize the visible page.
```

```text
Use Camoufox to browse https://developer.mozilla.org with images blocked and WebRTC blocked.
```

## Features

- Advanced anti-detection: rotating OS fingerprints, realistic cursor movements, and browser fingerprint spoofing.
- Enhanced parameters: configurable wait strategies, timeouts, viewport dimensions, diagnostics, and screenshots.
- Cross-platform: works on Windows, macOS, and Linux, including Docker.
- Privacy controls: SSRF protections, WebRTC blocking, WebGL blocking, image blocking, proxy support, and bounded output.
- Session tools: short-lived isolated browser sessions with challenge pause/resume support.
- Docker/NAS deployment: HTTP MCP endpoint, health endpoint, optional Bearer token auth, and stateless HTTP mode by default.

## What changed in this fork

- Added dual transport support:
  - `stdio` for local desktop clients
  - `http` for remote MCP clients and container deployments
- Added MCP HTTP endpoint at `/mcp` with stateless mode by default and optional stateful sessions
- Added health endpoint at `/health`
- Added optional Bearer token protection with `MCP_AUTH_TOKEN`
- Reworked the Docker image for long-running NAS usage
- Added `docker-compose.yml` and `.env.example`
- Removed the hardcoded `linux/amd64` Docker platform pin so the image can build for the active Docker target platform

## Important for Claude and ChatGPT

Running the server on your NAS is only one half of the setup. For Claude and ChatGPT to connect to it as a remote MCP server, the endpoint must also be reachable over public HTTPS.

- ChatGPT only supports remote MCP servers, not local ones.
- Claude remote connectors are reached from Anthropic's cloud, not from your desktop app directly.
- A NAS endpoint that is only available inside your LAN will not be enough for those remote connectors.

In practice, you usually want one of these setups:

1. NAS + reverse proxy + public domain + HTTPS
2. NAS + tunnel service + public HTTPS URL
3. NAS behind a firewall that explicitly allows the vendor IP ranges and exposes the service publicly

## Quick start on a NAS

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Edit `.env`.

If you want the simplest first test, leave `MCP_AUTH_TOKEN` empty and expose the server only through a trusted HTTPS endpoint.

3. Build and start the service:

```bash
docker compose up -d --build
```

4. Verify the container locally on the NAS:

```bash
curl http://127.0.0.1:3000/health
```

You should get a JSON response with `"status": "ok"`.

## Docker usage

### Docker Compose

The included `docker-compose.yml` is the recommended NAS setup.

```yaml
services:
  camoufox-mcp:
    build:
      context: .
    ports:
      - "3000:3000"
    environment:
      MCP_TRANSPORT: http
      MCP_HOST: 0.0.0.0
      MCP_PORT: 3000
      MCP_PATH: /mcp
      MCP_HEALTH_PATH: /health
      MCP_HTTP_SESSION_MODE: stateless
```

### Plain Docker

```bash
docker build -t camoufox-mcp .
docker run -d \
  --name camoufox-mcp \
  --restart unless-stopped \
  -p 3000:3000 \
  -e MCP_TRANSPORT=http \
  -e MCP_HOST=0.0.0.0 \
  -e MCP_PORT=3000 \
  camoufox-mcp
```

If you explicitly want stdio behavior in a container, start it like this:

```bash
docker run -i --rm -e MCP_TRANSPORT=stdio camoufox-mcp
```

## Configuration

The server can be configured through environment variables or CLI flags.

| Variable | Default | Description |
| --- | --- | --- |
| `MCP_TRANSPORT` | `stdio` locally, `http` in Docker | `stdio` or `http` |
| `MCP_HOST` | `0.0.0.0` in HTTP mode | Bind host for HTTP mode |
| `MCP_PORT` | `3000` | Bind port for HTTP mode |
| `MCP_PATH` | `/mcp` | MCP endpoint path |
| `MCP_HEALTH_PATH` | `/health` | Health endpoint path |
| `MCP_ENABLE_JSON_RESPONSE` | `true` | Enables JSON responses for compatible MCP clients |
| `MCP_HTTP_SESSION_MODE` | `stateless` | HTTP session mode: `stateless` for ChatGPT/most remote clients, `stateful` only if a client requires persistent MCP sessions |
| `MCP_DEBUG_LOCALE` | `false` | Logs requested and effective browser locale data for each browser operation |
| `MCP_AUTH_TOKEN` | unset | Optional Bearer token for clients that can send static auth headers |
| `CAMOUFOX_MCP_NETWORK_SANDBOX` | `0` | Declare that container, VM, or firewall egress controls are configured |
| `CAMOUFOX_MCP_REQUIRE_NETWORK_SANDBOX` | `0` | Refuse startup unless network sandboxing is declared |

CLI examples:

```bash
node dist/index.js --transport http --host 0.0.0.0 --port 3000 --http-session-mode stateless
node dist/index.js --transport http --debug-locale true
node dist/index.js --transport stdio
```

## Running modes

### Local stdio mode

Use this when the MCP client starts the server as a child process on the same machine.

```bash
npm run build
npm run start:stdio
```

### Local HTTP mode

Use this to test the remote MCP endpoint without Docker.

```bash
npm run build
npm run start:http
```

## Versioning

`camoufox-js` (0.10.2) and `playwright-core` (1.59.0) are pinned, fetching the Camoufox 135.0.1-beta.24 browser build. `playwright-core` is a **direct** pinned dependency (not just an `overrides` entry) because npm `overrides` only bind the root project: without a direct pin, `npx`/global installs let `camoufox-js`'s peer float `playwright-core` to the latest, and `playwright-core` 1.60+ is incompatible with the Camoufox browser (1.60 breaks a navigation guard; 1.61 sends an `isMobile` viewport option Firefox/Camoufox rejects). The pins are the newest combination that passes the full test suite. Run `npm run doctor` to check them end-to-end, and do not loosen them without re-running `npm run test:all`.

## Documentation

- [Configuration for AI assistants](docs/configuration.md)
- [Usage examples](docs/examples.md)
- [Tool parameters](docs/tool-parameters.md)
- [Server policy](docs/server-policy.md)
- [Development](docs/development.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Privacy and security](docs/privacy-security.md)

## Reverse proxy notes

If you place the service behind Nginx, Caddy, Traefik, Synology reverse proxy, or a tunnel, keep these points in mind:

- Expose the MCP endpoint over HTTPS
- Forward `Authorization` headers unchanged if you use `MCP_AUTH_TOKEN`
- If you run `MCP_HTTP_SESSION_MODE=stateful`, forward `mcp-session-id` headers unchanged
- Do not buffer streaming responses on the MCP endpoint
- In `stateless` mode, forwarding `POST` is enough
- In `stateful` mode, forward `GET`, `POST`, and `DELETE` to the same MCP path

## Troubleshooting

### The NAS container starts, but Claude or ChatGPT cannot connect

Usually this means one of these:

- the server is not publicly reachable over HTTPS
- the reverse proxy does not forward the required methods to the MCP path
- the proxy strips the `Authorization` or `mcp-session-id` header
- the proxy buffers the response stream
- the firewall blocks traffic from the vendor cloud

### ChatGPT says the `browse` schema is invalid

If ChatGPT rejects the connector with an error mentioning `window` and `items`, you are most likely running an older image that still exposes `window` as a tuple array.

Use the updated image and pass `window` like this:

```json
{
  "window": {
    "width": 1280,
    "height": 720
  }
}
```

### ChatGPT or another remote client works once, then the tool disappears

That usually points to session handling on the remote client side rather than the browser automation itself.

This fork defaults HTTP mode to `MCP_HTTP_SESSION_MODE=stateless`, which is the safest setting for ChatGPT-style remote MCP connectors.

### Debugging locale mismatches

If a client claims it sent `de-DE` or `fr-FR`, but the page reports something else, enable:

```bash
MCP_DEBUG_LOCALE=true
```

Each browser operation will then log the raw requested locale and the effective browser locale values reported by the page.

## License

MIT License - see [LICENSE](LICENSE) file for details.
