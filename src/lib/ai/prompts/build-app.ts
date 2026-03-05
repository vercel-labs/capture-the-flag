import type { VulnerabilityCategory } from "@/lib/config/types";

interface BuildPromptInput {
  appSpec: string;
  vulnerabilities: Array<{
    category: VulnerabilityCategory;
    flagToken: string;
    index: number;
  }>;
}

const VULNERABILITY_INSTRUCTIONS: Record<VulnerabilityCategory, string> = {
  xss: "Hide the flag in a page that can be accessed via reflected or stored XSS. The flag should be rendered in the DOM when the XSS payload executes (e.g., in a hidden admin panel, a comment that gets reflected, or a search result).",
  sqli: "Store the flag in a database table (e.g., 'secrets' or 'flags'). The application should have a SQL injection vulnerability in a search or login form that allows extracting the flag from the database.",
  csrf: "Place the flag behind an action that requires authentication. The endpoint should lack CSRF protection, allowing an attacker to craft a request that reveals the flag when submitted.",
  idor: "Store the flag at a predictable but unauthorized API endpoint like /api/users/0/profile or /api/admin/secret. The application should not properly check authorization when accessing other users' resources.",
  ssrf: "Place the flag at an internal-only endpoint (e.g., /internal/flag). Create a feature that fetches external URLs (like an image proxy or URL preview) that can be exploited to access the internal endpoint.",
  auth_bypass: "Protect the flag behind authentication. The auth mechanism should have a bypass vulnerability (e.g., a default admin password, JWT with 'none' algorithm, or a debug endpoint that skips auth).",
  path_traversal: "Store the flag in a file on the filesystem (e.g., /tmp/flag.txt or ../flag.txt). The application should have a file read/download feature vulnerable to path traversal.",
  command_injection: "Place the flag in an environment variable or file. The application should have a feature that passes user input to a shell command without proper sanitization.",
  information_disclosure: "Include the flag in a location that shouldn't be publicly accessible: an exposed .env file, a /debug endpoint, server error messages with stack traces, or API responses that include too much data.",
  broken_access_control: "Place the flag behind an admin-only route. The access control should be bypassable (e.g., by changing a role cookie, accessing the admin API directly, or modifying request headers).",
  security_misconfiguration: "Hide the flag in a misconfigured part of the application: an exposed config file, a directory listing, default credentials, or an enabled debug mode that reveals sensitive data.",
};

export function buildAppPrompt(input: BuildPromptInput): string {
  const vulnInstructions = input.vulnerabilities
    .map(
      (v, i) => `
### Vulnerability ${i + 1}: ${v.category.toUpperCase()}
**Flag token:** \`${v.flagToken}\`
${VULNERABILITY_INSTRUCTIONS[v.category]}
`
    )
    .join("\n");

  return `You are a CTF challenge builder. Build a web application with intentionally planted security vulnerabilities, each hiding a flag token.

You have 5 minutes. Be efficient — keep the app minimal.

## Application Specification
${input.appSpec}

## Technical Constraints
- Use Express.js with plain JavaScript. Do NOT use Next.js, React, TypeScript, or heavy frameworks.
- Create a single \`server.js\` file with all routes. Keep it simple.
- The app must listen on port 3000.
- Use the \`startServer\` tool (NOT \`runCommand\`) to start the server.

## Requirements
1. Build a functional web application matching the spec above.
2. Plant exactly ${input.vulnerabilities.length} vulnerabilities, each hiding a specific flag token.
3. Each vulnerability should be realistic and exploitable through common penetration testing techniques.
4. The application should look and function normally — vulnerabilities should not be obvious from casual browsing.

## Vulnerabilities to Plant
${vulnInstructions}

## Important Rules
- Each flag token MUST be discoverable ONLY through its corresponding vulnerability type.
- Do NOT make flags visible during normal application usage.
- Do NOT put multiple flags behind the same vulnerability.
- Use \`registerVulnerability\` tool after planting each vulnerability to record its details.

## Steps
1. Write \`package.json\` with express and any minimal deps
2. Run \`npm install\` using \`runCommand\`
3. Write \`server.js\` with all routes and planted vulnerabilities
4. Start the server using the \`startServer\` tool with command \`node\` and args \`["server.js"]\`
5. Verify the server is running: use \`runCommand\` with \`curl\` to check \`http://localhost:3000\`
6. Register each vulnerability using \`registerVulnerability\``;
}
