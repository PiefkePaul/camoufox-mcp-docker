export type ServerTransportMode = "stdio" | "http";

export interface AppConfig {
  transport: ServerTransportMode;
  host: string;
  port: number;
  mcpPath: string;
  healthPath: string;
  authToken?: string;
  enableJsonResponse: boolean;
}

type CliValue = string | boolean;

function parseCliArgs(argv: string[]): Map<string, CliValue> {
  const args = new Map<string, CliValue>();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      continue;
    }

    const normalized = argument.slice(2);
    const equalsIndex = normalized.indexOf("=");

    if (equalsIndex >= 0) {
      const key = normalized.slice(0, equalsIndex);
      const value = normalized.slice(equalsIndex + 1);
      args.set(key, value);
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(normalized, next);
      index += 1;
      continue;
    }

    args.set(normalized, true);
  }

  return args;
}

function parseBoolean(value: string | boolean | undefined, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }

  switch (value.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      return fallback;
  }
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    return fallback;
  }

  return parsed;
}

function normalizePath(value: string | undefined, fallback: string): string {
  const source = value?.trim() || fallback;
  if (source === "/") {
    return source;
  }

  const prefixed = source.startsWith("/") ? source : `/${source}`;
  return prefixed.replace(/\/+$/, "");
}

function normalizeTransport(value: string | undefined): ServerTransportMode {
  return value?.trim().toLowerCase() === "http" ? "http" : "stdio";
}

export function loadConfig(argv = process.argv.slice(2), env = process.env): AppConfig {
  const args = parseCliArgs(argv);

  const transport = normalizeTransport(
    (args.get("transport") as string | undefined) ?? env.MCP_TRANSPORT,
  );

  const host =
    (args.get("host") as string | undefined) ??
    env.MCP_HOST ??
    (transport === "http" ? "0.0.0.0" : "127.0.0.1");

  const port = parsePort(
    (args.get("port") as string | undefined) ?? env.MCP_PORT ?? env.PORT,
    3000,
  );

  const explicitJsonResponse = args.has("json-response")
    ? args.get("json-response")
    : args.has("no-json-response")
      ? "false"
      : undefined;

  return {
    transport,
    host,
    port,
    mcpPath: normalizePath(
      (args.get("mcp-path") as string | undefined) ?? env.MCP_PATH,
      "/mcp",
    ),
    healthPath: normalizePath(
      (args.get("health-path") as string | undefined) ?? env.MCP_HEALTH_PATH,
      "/health",
    ),
    authToken:
      ((args.get("auth-token") as string | undefined) ?? env.MCP_AUTH_TOKEN)?.trim() || undefined,
    enableJsonResponse: parseBoolean(
      explicitJsonResponse ?? env.MCP_ENABLE_JSON_RESPONSE,
      true,
    ),
  };
}
