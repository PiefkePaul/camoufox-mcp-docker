import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { ALLOW_EVALUATE, ALLOW_UNSAFE_OPTIONS, CAPTCHA_AUTONOMOUS, DEFAULT_STEALTH_PROFILE, DEFAULT_WAIT_STRATEGY, SERVER_VERSION } from "./config.js";
import {
  anyOutputSchema,
  browseToolShape,
  consoleToolShape,
  findOutputSchema,
  findToolShape,
  formsOutputSchema,
  formsToolShape,
  linksOutputSchema,
  linksToolShape,
  networkSummaryOutputSchema,
  networkSummaryToolShape,
  outlineOutputSchema,
  outlineToolShape,
  screenshotToolShape,
  sequenceToolShape,
  sessionActionToolShape,
  sessionCloseToolShape,
  sessionNavigateToolShape,
  sessionResumeToolShape,
  sessionSnapshotToolShape,
  sessionStartToolShape,
  snapshotToolShape,
  statusOutputSchema,
  type BrowseToolInput,
  type ConsoleToolInput,
  type FindToolInput,
  type FormsToolInput,
  type LinksToolInput,
  type NetworkSummaryToolInput,
  type OutlineToolInput,
  type ScreenshotToolInput,
  type SequenceToolInput,
  type SessionActionToolInput,
  type SessionCloseToolInput,
  type SessionNavigateToolInput,
  type SessionResumeToolInput,
  type SessionSnapshotToolInput,
  type SessionStartToolInput,
  type SnapshotToolInput,
} from "./schemas.js";
import {
  handleBrowse,
  handleConsole,
  handleFind,
  handleForms,
  handleLinks,
  handleNetworkSummary,
  handleOutline,
  handleScreenshot,
  handleSequence,
  handleSnapshot,
  handleStatus,
} from "./tool-handlers.js";
import {
  handleSessionAction,
  handleSessionClose,
  handleSessionNavigate,
  handleSessionResume,
  handleSessionSnapshot,
  handleSessionStart,
} from "./sessions.js";

const readOnlyOpenWorld: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};
const nonReadOnlyOpenWorld: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};

function registerJsonTool<InputArgs extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: InputArgs,
  annotations: ToolAnnotations,
  handler: (input: z.infer<z.ZodObject<InputArgs>>) => Promise<unknown>,
  outputSchema: z.ZodTypeAny = anyOutputSchema,
): void {
  const registerTool = server.registerTool.bind(server) as unknown as (
    toolName: string,
    config: {
      description: string;
      inputSchema: InputArgs;
      outputSchema: z.ZodTypeAny;
      annotations: ToolAnnotations;
    },
    callback: (input: unknown) => Promise<unknown>,
  ) => void;

  registerTool(
    name,
    { description, inputSchema, outputSchema, annotations },
    async (input: unknown): Promise<unknown> => handler(input as z.infer<z.ZodObject<InputArgs>>),
  );
}

export function createCamoufoxServer(): McpServer {
  const server = new McpServer(
    { name: "camoufox-mcp-server", version: SERVER_VERSION },
    {
      capabilities: {
        extensions: {
          "camoufox-mcp": {
            policy: {
              unsafeOptionsAllowed: ALLOW_UNSAFE_OPTIONS,
              evaluateAllowed: ALLOW_EVALUATE,
              captchaAutonomous: CAPTCHA_AUTONOMOUS,
              defaultWaitStrategy: DEFAULT_WAIT_STRATEGY,
              defaultStealthProfile: DEFAULT_STEALTH_PROFILE,
            },
            tools: {
              browseSessionNavigateWaitStrategy: true,
            },
          },
        },
      },
    },
  );

  server.registerTool(
    "camoufox_status",
    {
      description: "Return server, browser, queue, session, and policy status without launching a page.",
      inputSchema: {},
      outputSchema: statusOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => handleStatus(),
  );

  registerJsonTool(server, "browse", "Navigate once and return bounded page content.", browseToolShape, readOnlyOpenWorld, async (input) => handleBrowse(input as BrowseToolInput));
  registerJsonTool(server, "browse_snapshot", "Navigate once and return visible text, ARIA snapshot, and interactive metadata.", snapshotToolShape, readOnlyOpenWorld, async (input) => handleSnapshot(input as SnapshotToolInput));
  registerJsonTool(server, "browse_sequence", "Navigate once, run bounded selector actions, then return final state.", sequenceToolShape, nonReadOnlyOpenWorld, async (input) => handleSequence(input as SequenceToolInput));
  registerJsonTool(server, "browse_links", "Navigate once and return only visible navigable links.", linksToolShape, readOnlyOpenWorld, async (input) => handleLinks(input as LinksToolInput), linksOutputSchema);
  registerJsonTool(server, "browse_forms", "Navigate once and return form fields and submit controls.", formsToolShape, readOnlyOpenWorld, async (input) => handleForms(input as FormsToolInput), formsOutputSchema);
  registerJsonTool(server, "browse_outline", "Navigate once and return page headings and landmarks.", outlineToolShape, readOnlyOpenWorld, async (input) => handleOutline(input as OutlineToolInput), outlineOutputSchema);
  registerJsonTool(server, "browse_find", "Navigate once, search visible text, and return bounded context matches.", findToolShape, readOnlyOpenWorld, async (input) => handleFind(input as FindToolInput), findOutputSchema);
  registerJsonTool(server, "browse_screenshot", "Navigate once and capture a bounded screenshot.", screenshotToolShape, readOnlyOpenWorld, async (input) => handleScreenshot(input as ScreenshotToolInput));
  registerJsonTool(server, "browse_console", "Navigate once and return bounded console diagnostics.", consoleToolShape, readOnlyOpenWorld, async (input) => handleConsole(input as ConsoleToolInput));
  registerJsonTool(server, "browse_network_summary", "Navigate once and return a bounded network diagnostic summary.", networkSummaryToolShape, readOnlyOpenWorld, async (input) => handleNetworkSummary(input as NetworkSummaryToolInput), networkSummaryOutputSchema);
  registerJsonTool(server, "browse_session_start", "Start an isolated short-lived browser session.", sessionStartToolShape, nonReadOnlyOpenWorld, async (input) => handleSessionStart(input as SessionStartToolInput));
  registerJsonTool(server, "browse_session_navigate", "Navigate an existing browser session.", sessionNavigateToolShape, nonReadOnlyOpenWorld, async (input) => handleSessionNavigate(input as SessionNavigateToolInput));
  registerJsonTool(server, "browse_session_action", "Run one bounded action in an existing browser session.", sessionActionToolShape, nonReadOnlyOpenWorld, async (input) => handleSessionAction(input as SessionActionToolInput));
  registerJsonTool(server, "browse_session_snapshot", "Read the current state of an existing browser session.", sessionSnapshotToolShape, readOnlyOpenWorld, async (input) => handleSessionSnapshot(input as SessionSnapshotToolInput));
  registerJsonTool(server, "browse_session_resume", "Resume a paused session after human action and return current state.", sessionResumeToolShape, nonReadOnlyOpenWorld, async (input) => handleSessionResume(input as SessionResumeToolInput));
  registerJsonTool(server, "browse_session_close", "Close an existing browser session.", sessionCloseToolShape, nonReadOnlyOpenWorld, async (input) => handleSessionClose(input as SessionCloseToolInput));

  return server;
}
