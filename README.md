# Camoufox MCP Server for NAS and Docker

This fork turns `camoufox-mcp` into a MCP server that can run as a long-lived Docker service on a NAS and be exposed as a remote MCP endpoint for clients such as Claude and ChatGPT.

It keeps the original `browse` tool, but adds a network-facing HTTP mode, a health endpoint, Docker Compose support, and runtime configuration via environment variables or CLI flags.

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
- Claude remote connectors are also reached from Anthropic's cloud, not from your desktop app directly.
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

If you explicitly want the old container-style stdio behavior, start it like this:

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
| `MCP_AUTH_TOKEN` | unset | Optional Bearer token for clients that can send static auth headers |

CLI examples:

```bash
node dist/index.js --transport http --host 0.0.0.0 --port 3000 --http-session-mode stateless
node dist/index.js --transport stdio
```

## Running modes

### Local stdio mode

Use this when the MCP client starts the server as a child process on the same machine.

```bash
npm run build
npm run start:stdio
```

For local non-Docker development, Node 20 LTS is the safest choice because Camoufox pulls in native dependencies.

### Local HTTP mode

Use this to test the remote MCP endpoint without Docker.

```bash
npm run build
npm run start:http
```

## Reverse proxy notes

If you place the service behind Nginx, Caddy, Traefik, Synology reverse proxy, or a tunnel, keep these points in mind:

- Expose the MCP endpoint over HTTPS
- Forward `Authorization` headers unchanged if you use `MCP_AUTH_TOKEN`
- If you run `MCP_HTTP_SESSION_MODE=stateful`, forward `mcp-session-id` headers unchanged
- Do not buffer streaming responses on the MCP endpoint
- In `stateless` mode, forwarding `POST` is enough
- In `stateful` mode, forward `GET`, `POST`, and `DELETE` to the same MCP path

If you are targeting Claude remote connectors, remember that Anthropic connects from its own cloud infrastructure. Your public endpoint must be reachable from there.

## Claude integration

For Claude remote connectors, use the public HTTPS MCP URL, for example:

```text
https://mcp.example.com/mcp
```

Current Anthropic guidance says:

- Remote MCP servers are added through `Customize > Connectors`
- Claude Desktop remote connectors are not configured through `claude_desktop_config.json`
- Connections originate from Anthropic's cloud infrastructure, so your server must be publicly reachable over HTTPS

If you are using the Claude API MCP connector, Anthropic also supports direct HTTP MCP servers from the Messages API.

## ChatGPT integration

For ChatGPT developer mode / apps, use the same public HTTPS MCP URL:

```text
https://mcp.example.com/mcp
```

Current OpenAI guidance says:

- ChatGPT developer mode supports remote MCP servers over SSE and streaming HTTP
- ChatGPT does not connect to local MCP servers directly
- For ChatGPT app-style integrations, OAuth is the recommended production auth model

### Important auth note

The built-in `MCP_AUTH_TOKEN` support in this fork is useful for:

- custom agents that can send a static Bearer token
- API-driven MCP clients
- reverse-proxy or gateway setups you control

For first-party Claude and ChatGPT UI integrations, the clean long-term approach is usually:

1. no auth while testing on a tightly controlled public endpoint, or
2. a proper MCP-compatible OAuth flow in front of the server

This fork does not implement a full OAuth provider yet.

## Example API usage

### Anthropic Messages API MCP connector

Anthropic's API docs support remote HTTP MCP servers. A minimal server definition looks like:

```json
{
  "type": "url",
  "url": "https://mcp.example.com/mcp",
  "name": "camoufox"
}
```

### OpenAI Responses API MCP tool

OpenAI's MCP docs support remote MCP servers in the `tools` array. A minimal tool entry looks like:

```json
{
  "type": "mcp",
  "server_label": "camoufox",
  "server_url": "https://mcp.example.com/mcp",
  "require_approval": "never"
}
```

## Development

```bash
npm install
npm run build
npm run start:stdio
```

## Troubleshooting

### The NAS container starts, but Claude or ChatGPT cannot connect

Usually this means one of these:

- the server is not publicly reachable over HTTPS
- the reverse proxy does not forward `GET`, `POST`, and `DELETE` to the MCP path
- the proxy strips the `Authorization` or `mcp-session-id` header
- the proxy buffers the response stream
- the firewall blocks traffic from the vendor cloud

### The service works locally, but not through the public URL

Check:

- TLS certificate is valid
- the public URL points to the same MCP path as `MCP_PATH`
- the reverse proxy does not rewrite `/mcp` unexpectedly
- the health endpoint works through the public hostname

### Token auth works in your own agent, but not in Claude or ChatGPT UI

That is expected in many setups. Their first-party remote connector flows are centered around no-auth or OAuth-based server onboarding, not arbitrary static Bearer headers.

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

This fork now defaults HTTP mode to `MCP_HTTP_SESSION_MODE=stateless`, which is the safest setting for ChatGPT-style remote MCP connectors.

If you previously deployed an older image or explicitly set stateful mode, switch back to:

```bash
MCP_HTTP_SESSION_MODE=stateless
```

Only use `stateful` if you know your client requires persistent MCP sessions and reliably sends `mcp-session-id` on all follow-up requests.

## License

MIT License. See `LICENSE`.
