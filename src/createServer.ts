import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import chalk from "chalk";
import { Camoufox } from "camoufox-js";
import { z } from "zod";

interface CamoufoxOptions {
  os?: string[];
  headless?: boolean | "virtual";
  humanize?: boolean;
  geoip?: boolean;
  ublock?: boolean;
  block_webgl?: boolean;
  block_images?: boolean;
  block_webrtc?: boolean;
  disable_coop?: boolean;
  locale?: string;
  viewport?: { width: number; height: number };
  proxy?: string | { server: string; username?: string; password?: string };
  enable_cache?: boolean;
  firefox_user_prefs?: Record<string, unknown>;
  exclude_addons?: string[];
  window?: [number, number];
  args?: string[];
}

export function createCamoufoxServer(): McpServer {
  const server = new McpServer({
    name: "camoufox-mcp-server",
    version: "1.5.0",
  });

  server.tool(
    "browse",
    {
      url: z
        .string()
        .describe(
          "The URL to navigate to and retrieve content from. Use this tool when users ask to visit, check, search, navigate, browse, fetch, or scrape websites. Must be a fully qualified URL (e.g., 'https://example.com').",
        ),
      os: z
        .enum(["windows", "macos", "linux"])
        .optional()
        .describe(
          "Optional OS to spoof. Can be 'windows', 'macos', or 'linux'. If not specified, will rotate between all OS types.",
        ),
      waitStrategy: z
        .enum(["domcontentloaded", "load", "networkidle"])
        .optional()
        .default("domcontentloaded")
        .describe(
          "Wait strategy for page load. 'domcontentloaded' waits for DOM, 'load' waits for all resources, 'networkidle' waits for network activity to finish.",
        ),
      timeout: z
        .number()
        .min(5000)
        .max(300000)
        .optional()
        .default(60000)
        .describe("Timeout in milliseconds for page load (5-300 seconds)."),
      humanize: z
        .boolean()
        .optional()
        .default(true)
        .describe(
          "Enable realistic cursor movements and human-like behavior for better stealth and anti-detection. Helps avoid bot detection by simulating natural user interactions.",
        ),
      locale: z.string().optional().describe("Browser locale (e.g., 'en-US', 'fr-FR')."),
      viewport: z
        .object({
          width: z.number().min(320).max(3840).default(1920),
          height: z.number().min(240).max(2160).default(1080),
        })
        .optional()
        .describe("Custom viewport dimensions."),
      screenshot: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "Capture a screenshot/image of the page after loading. Use when users ask to take a screenshot, capture an image, show them visually, or want to see how the page looks.",
        ),
      block_webrtc: z
        .boolean()
        .optional()
        .default(true)
        .describe(
          "Block WebRTC entirely for enhanced privacy and stealth. Use when users want private browsing, to hide their real IP, prevent WebRTC leaks, or browse in stealth mode.",
        ),
      proxy: z
        .union([
          z.string().describe("Proxy URL (e.g., 'http://proxy.example.com:8080')"),
          z.object({
            server: z.string().describe("Proxy server URL"),
            username: z.string().optional().describe("Proxy username for authentication"),
            password: z.string().optional().describe("Proxy password for authentication"),
          }),
        ])
        .optional()
        .describe(
          "Proxy configuration for anonymous browsing. Use when users want to browse through a proxy, hide their IP, browse anonymously, or access content via a specific server location.",
        ),
      enable_cache: z
        .boolean()
        .optional()
        .default(false)
        .describe("Cache pages, requests, etc. Uses more memory but improves performance when revisiting pages."),
      firefox_user_prefs: z.record(z.any()).optional().describe("Custom Firefox user preferences to set."),
      exclude_addons: z
        .array(z.string())
        .optional()
        .describe("List of default addons to exclude (e.g., ['ublock_origin'])."),
      window: z
        .preprocess(
          (argument) => {
            if (Array.isArray(argument) && argument.length === 0) {
              return undefined;
            }
            return argument;
          },
          z
            .tuple([z.number().min(320).max(3840), z.number().min(240).max(2160)])
            .optional(),
        )
        .describe(
          "Set fixed window size [width, height] instead of random generation. An empty array [] is accepted and treated as if the window parameter was not specified.",
        ),
      args: z.array(z.string()).optional().describe("Additional command-line arguments to pass to the browser."),
      block_images: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "Block all images for faster loading, reduced bandwidth, and lightweight browsing. Use when users want quick/fast browsing, text-only content, or to save bandwidth.",
        ),
      block_webgl: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "Block WebGL to prevent fingerprinting and tracking. Use for maximum privacy/stealth mode, but note it may cause detection on some sites that rely heavily on WebGL.",
        ),
      disable_coop: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "Disable Cross-Origin-Opener-Policy to allow interaction with iframes and cross-origin content. Use when users need to click elements in iframes or access embedded content.",
        ),
      geoip: z
        .boolean()
        .optional()
        .default(true)
        .describe("Automatically detect geolocation based on IP address."),
      headless: z
        .boolean()
        .optional()
        .describe("Run browser in headless mode. Auto-detects best mode for environment if not specified."),
    },
    async ({
      url,
      os,
      waitStrategy,
      timeout,
      humanize,
      locale,
      viewport,
      screenshot,
      block_webrtc,
      proxy,
      enable_cache,
      firefox_user_prefs,
      exclude_addons,
      window,
      args,
      block_images,
      block_webgl,
      disable_coop,
      geoip,
      headless,
    }) => {
      let browser;

      try {
        console.error(chalk.blue(`[Camoufox] Launching browser to browse: ${url}`));

        const isLinux = process.platform === "linux";
        const headlessMode = headless !== undefined ? headless : isLinux ? "virtual" : true;

        const osOptions = ["windows", "macos", "linux"];
        const selectedOS = os || osOptions[Math.floor(Math.random() * osOptions.length)];

        browser = await Camoufox({
          os: [selectedOS],
          headless: headlessMode,
          humanize,
          geoip,
          ublock: true,
          block_webgl,
          block_images,
          block_webrtc,
          disable_coop,
          locale,
          viewport: viewport
            ? {
                width: viewport.width,
                height: viewport.height,
              }
            : undefined,
          proxy,
          enable_cache,
          firefox_user_prefs,
          exclude_addons,
          window,
          args,
        } as CamoufoxOptions);

        const page = await browser.newPage();
        await page.goto(url, { waitUntil: waitStrategy, timeout });

        const pageContent = await page.content();

        let screenshotBase64: string | undefined;
        if (screenshot) {
          try {
            const screenshotBuffer = await page.screenshot({ type: "png" });
            screenshotBase64 = screenshotBuffer.toString("base64");
            console.error(chalk.green(`[Camoufox] Screenshot captured for ${url}.`));
          } catch (screenshotError) {
            console.error(
              chalk.yellow(
                `[Camoufox] Screenshot failed: ${
                  screenshotError instanceof Error ? screenshotError.message : String(screenshotError)
                }`,
              ),
            );
          }
        }

        const features = [
          `OS: ${selectedOS}`,
          `wait: ${waitStrategy}`,
          proxy ? "proxy: enabled" : null,
          block_webrtc ? "WebRTC: blocked" : null,
          block_images ? "images: blocked" : null,
          block_webgl ? "WebGL: blocked" : null,
          disable_coop ? "COOP: disabled" : null,
          !geoip ? "geoip: disabled" : null,
        ]
          .filter(Boolean)
          .join(", ");

        console.error(chalk.green(`[Camoufox] Successfully retrieved content from ${url} (${features}).`));

        const content: Array<
          { type: "text"; text: string } | { type: "image"; data: string; mimeType: string }
        > = [
          {
            type: "text",
            text: pageContent,
          },
        ];

        if (screenshotBase64) {
          content.push({
            type: "image",
            data: screenshotBase64,
            mimeType: "image/png",
          });
        }

        return { content };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`[Camoufox] Error during browsing: ${errorMessage}`));

        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to browse URL ${url}. Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      } finally {
        if (browser) {
          console.error(chalk.blue("[Camoufox] Closing browser."));
          await browser.close();
        }
      }
    },
  );

  return server;
}
