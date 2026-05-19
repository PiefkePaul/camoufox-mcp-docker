#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import chalk from "chalk";

import { closeActiveBrowsers, rejectPendingBrowses, setBrowserShuttingDown } from "./browser-runtime.js";
import { assertNetworkSandboxPolicy, loadConfig } from "./config.js";
import { createCamoufoxServer } from "./createServer.js";
import { startHttpServer } from "./httpServer.js";
import { closeActiveSessions } from "./sessions.js";
import { describeError } from "./utils.js";

type ShutdownHandler = () => Promise<void>;

async function startStdioServer(): Promise<ShutdownHandler> {
  const server = createCamoufoxServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error(chalk.yellow("Camoufox MCP Server is running on stdio..."));

  return async () => {
    await server.close();
  };
}

async function main(): Promise<void> {
  assertNetworkSandboxPolicy();
  const config = loadConfig();
  if (config.debugLocale) {
    process.env.MCP_DEBUG_LOCALE = "true";
  }

  const shutdown =
    config.transport === "http"
      ? (await startHttpServer(config)).close
      : await startStdioServer();

  let closing = false;
  const stop = async (reason: string, exitCode = 0): Promise<void> => {
    if (closing) {
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
      return;
    }

    closing = true;
    setBrowserShuttingDown(true);
    console.error(chalk.yellow(`[Camoufox] Shutting down server (${reason})...`));
    rejectPendingBrowses("Server is shutting down.");

    try {
      await closeActiveSessions();
      await closeActiveBrowsers();
      await shutdown();
    } catch (shutdownError) {
      console.error(chalk.red("[Camoufox] Shutdown cleanup failed: " + describeError(shutdownError)));
      process.exitCode = 1;
    } finally {
      process.exit(exitCode);
    }
  };

  process.on("SIGINT", () => {
    void stop("SIGINT");
  });

  process.on("SIGTERM", () => {
    void stop("SIGTERM");
  });

  process.on("uncaughtException", (error) => {
    console.error(chalk.red("[Camoufox] Uncaught exception:"), error);
    void stop("uncaughtException", 1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error(chalk.red("[Camoufox] Unhandled rejection at:"), promise, "reason:", reason);
    void stop("unhandledRejection", 1);
  });
}

main().catch((error) => {
  console.error(chalk.red("Fatal error running server:"), error);
  process.exit(1);
});
