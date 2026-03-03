import { tool } from "ai";
import { z } from "zod";

export function createHttpTools() {
  return {
    httpRequest: tool({
      description:
        "Make an HTTP request to a URL. Use this to interact with web applications during penetration testing.",
      inputSchema: z.object({
        url: z.string().describe("The full URL to request"),
        method: z
          .enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
          .default("GET"),
        headers: z
          .record(z.string(), z.string())
          .optional()
          .describe("Request headers"),
        body: z.string().optional().describe("Request body (for POST/PUT/PATCH)"),
        followRedirects: z
          .boolean()
          .default(true)
          .describe("Whether to follow redirects"),
      }),
      execute: async ({ url, method, headers, body, followRedirects }) => {
        const response = await fetch(url, {
          method,
          headers,
          body: body || undefined,
          redirect: followRedirects ? "follow" : "manual",
        });

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        let responseBody: string;
        const contentType = response.headers.get("content-type") || "";
        if (
          contentType.includes("text") ||
          contentType.includes("json") ||
          contentType.includes("html") ||
          contentType.includes("xml")
        ) {
          responseBody = await response.text();
          // Truncate very large responses
          if (responseBody.length > 50000) {
            responseBody =
              responseBody.slice(0, 50000) + "\n... [truncated]";
          }
        } else {
          responseBody = `[Binary content: ${contentType}, ${response.headers.get("content-length") || "unknown"} bytes]`;
        }

        return {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: responseBody,
        };
      },
    }),
  };
}
