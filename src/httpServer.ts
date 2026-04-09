import { randomUUID, timingSafeEqual } from "node:crypto";

import express, { type NextFunction, type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import chalk from "chalk";

import type { AppConfig } from "./config.js";
import { createCamoufoxServer } from "./createServer.js";

interface SessionContext {
  server: ReturnType<typeof createCamoufoxServer>;
  transport: StreamableHTTPServerTransport;
}

export interface HttpServerHandle {
  close: () => Promise<void>;
}

function sendJsonRpcError(res: Response, status: number, code: number, message: string): void {
  res.status(status).json({
    jsonrpc: "2.0",
    error: {
      code,
      message,
    },
    id: null,
  });
}

function compareToken(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

function readBearerToken(req: Request): string | undefined {
  const header = req.header("authorization");
  if (!header) {
    return undefined;
  }

  const [scheme, token] = header.split(" ", 2);
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return undefined;
  }

  return token.trim();
}

export async function startHttpServer(config: AppConfig): Promise<HttpServerHandle> {
  const app = express();
  const sessions = new Map<string, SessionContext>();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb" }));

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (error instanceof SyntaxError && "body" in error) {
      sendJsonRpcError(res, 400, -32700, "Invalid JSON body.");
      return;
    }

    next(error);
  });

  app.get("/", (_req, res) => {
    res.json({
      name: "camoufox-mcp-server",
      transport: "http",
      endpoints: {
        health: config.healthPath,
        mcp: config.mcpPath,
      },
      auth: config.authToken ? "bearer" : "none",
      jsonResponse: config.enableJsonResponse,
    });
  });

  app.get(config.healthPath, (_req, res) => {
    res.json({
      status: "ok",
      transport: "http",
    });
  });

  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!config.authToken) {
      next();
      return;
    }

    const providedToken = readBearerToken(req);
    if (!providedToken || !compareToken(config.authToken, providedToken)) {
      res
        .status(401)
        .set("WWW-Authenticate", 'Bearer realm="camoufox-mcp"')
        .json({
          error: "Unauthorized",
        });
      return;
    }

    next();
  };

  app.use(config.mcpPath, requireAuth);

  app.options(config.mcpPath, (_req, res) => {
    res.set("Allow", "GET, POST, DELETE, OPTIONS").status(204).end();
  });

  async function cleanupSession(sessionId: string | undefined): Promise<void> {
    if (!sessionId) {
      return;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return;
    }

    sessions.delete(sessionId);
    console.error(chalk.blue(`[Camoufox] Closed MCP session ${sessionId}.`));
  }

  async function createSession(): Promise<SessionContext> {
    const server = createCamoufoxServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: config.enableJsonResponse,
      onsessioninitialized: (sessionId) => {
        sessions.set(sessionId, { server, transport });
        console.error(chalk.blue(`[Camoufox] Created MCP session ${sessionId}.`));
      },
    });

    transport.onclose = () => {
      void cleanupSession(transport.sessionId);
    };

    await server.connect(transport);

    return { server, transport };
  }

  function requireExistingSession(req: Request, res: Response): SessionContext | undefined {
    const sessionId = req.header("mcp-session-id");
    if (!sessionId) {
      sendJsonRpcError(res, 400, -32000, "Missing MCP session ID.");
      return undefined;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      sendJsonRpcError(res, 404, -32001, "Unknown or expired MCP session ID.");
      return undefined;
    }

    return session;
  }

  app.post(config.mcpPath, async (req, res) => {
    try {
      const sessionId = req.header("mcp-session-id");
      if (sessionId) {
        const existingSession = sessions.get(sessionId);
        if (!existingSession) {
          sendJsonRpcError(res, 404, -32001, "Unknown or expired MCP session ID.");
          return;
        }

        await existingSession.transport.handleRequest(req, res, req.body);
        return;
      }

      if (!isInitializeRequest(req.body)) {
        sendJsonRpcError(res, 400, -32000, "Initialization request required for new HTTP sessions.");
        return;
      }

      const session = await createSession();
      await session.transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error(chalk.red("[Camoufox] Error handling MCP POST request:"), error);
      if (!res.headersSent) {
        sendJsonRpcError(res, 500, -32603, "Internal server error.");
      }
    }
  });

  app.get(config.mcpPath, async (req, res) => {
    const session = requireExistingSession(req, res);
    if (!session) {
      return;
    }

    try {
      await session.transport.handleRequest(req, res);
    } catch (error) {
      console.error(chalk.red("[Camoufox] Error handling MCP GET request:"), error);
      if (!res.headersSent) {
        sendJsonRpcError(res, 500, -32603, "Internal server error.");
      }
    }
  });

  app.delete(config.mcpPath, async (req, res) => {
    const session = requireExistingSession(req, res);
    if (!session) {
      return;
    }

    try {
      await session.transport.handleRequest(req, res);
    } catch (error) {
      console.error(chalk.red("[Camoufox] Error handling MCP DELETE request:"), error);
      if (!res.headersSent) {
        sendJsonRpcError(res, 500, -32603, "Internal server error.");
      }
    }
  });

  const listener = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const server = app.listen(config.port, config.host, () => resolve(server));
    server.once("error", reject);
  });

  console.error(
    chalk.yellow(
      `[Camoufox] HTTP MCP server listening on http://${config.host}:${config.port}${config.mcpPath}`,
    ),
  );

  if (config.authToken) {
    console.error(chalk.yellow("[Camoufox] Bearer authentication is enabled for the MCP endpoint."));
  }

  return {
    close: async () => {
      for (const session of sessions.values()) {
        await session.transport.close();
      }
      sessions.clear();

      await new Promise<void>((resolve, reject) => {
        listener.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}
