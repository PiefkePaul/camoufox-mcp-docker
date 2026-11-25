#!/usr/bin/env node
// Must stay first: it reserves stdout for the protocol before any dependency loads.
import { protocolStdout } from "./stdio-guard.js";
import "./sqlite-compat.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import chalk from "chalk";

import { closeActiveBrowsers, rejectPendingBrowses, setBrowserShuttingDown } from "./browser-runtime.js";
import { SHUTDOWN_DEADLINE_MS, assertNetworkSandboxPolicy, loadConfig } from "./config.js";
import { createCamoufoxServer } from "./createServer.js";
import { startHttpServer } from "./httpServer.js";
import { closeActiveSessions } from "./sessions.js";
import { describeError } from "./utils.js";

// Fork (Scholz/camoufox-mcp-docker): neben stdio auch ein HTTP-Transport (MCP_TRANSPORT=http)
// für den Docker-Betrieb auf der NAS. Der Shutdown-Ablauf folgt upstream src/index.ts.

type ShutdownHandler = () => Promise<void>;

async function startStdioServer(onPipeClosed: (reason: string) => void): Promise<ShutdownHandler> {
  const server = createCamoufoxServer();
  const transport = new StdioServerTransport(process.stdin, protocolStdout);

  // A client that goes away closes the pipes without sending a signal. An idle
  // server then exits on its own, but an open session or in-flight browse keeps
  // Node and the browser alive, so treat the closed pipe as the shutdown request.
  // Only in stdio mode: in HTTP mode stdin is usually /dev/null and ends at once.
  process.stdin.on("end", () => onPipeClosed("stdin end"));
  process.stdin.on("close", () => onPipeClosed("stdin close"));
  protocolStdout.on("error", () => onPipeClosed("stdout error"));
  process.stdout.on("error", () => onPipeClosed("stdout error"));

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

  let closing = false;
  let closeTransport: ShutdownHandler = async () => {};

  const stop = async (reason: string, exitCode = 0): Promise<void> => {
    if (closing) {
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
      return;
    }

    closing = true;
    setBrowserShuttingDown(true);
    console.error(chalk.yellow(`\n[Camoufox] Shutting down server after ${reason}...`));
    // Cleanup closes browsers over a pipe that may itself be wedged. Exit anyway.
    setTimeout(() => {
      console.error(chalk.red("[Camoufox] Shutdown cleanup exceeded its deadline; exiting."));
      process.exit(exitCode || 1);
    }, SHUTDOWN_DEADLINE_MS).unref();
    rejectPendingBrowses("Server is shutting down.");

    try {
      await closeActiveSessions();
      await closeActiveBrowsers();
      await closeTransport();
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

  closeTransport =
    config.transport === "http"
      ? (await startHttpServer(config)).close
      : await startStdioServer((reason) => {
          void stop(reason);
        });
}

main().catch((error) => {
  console.error(chalk.red("Fatal error running server:"), error);
  process.exit(1);
});
