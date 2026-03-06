# Pitfalls

A catalog of every bug fix from this project's commit history, organized by category. Each entry explains what went wrong, why, and how to avoid it in the future.

---

## 1. Vercel Workflow Runtime Pitfalls

### 1.1 Step timeouts from monolithic workflow steps

**Commit:** `38f308c`

**Problem:** Building all player apps in a single workflow step caused the step to exceed Vercel's execution time limit. Same issue for running all attacks in one step.

**Root cause:** `buildAllApps` and `runAttackPhase` iterated over every player sequentially inside one `step.run()`. With multiple players, each doing AI-driven builds or attacks, the wall-clock time blew past the step timeout.

**Fix:** Refactored into a dispatch pattern: a thin "start" step sets status, then the workflow body dispatches individual `buildPlayerApp` / `attackPlayerApp` calls as separate steps. Added `vercel.json` with `maxDuration: 800` for the step route.

**Takeaway:** Never put unbounded loops or fan-out work inside a single workflow step. Dispatch each unit of work as its own step so it gets its own execution budget and can be retried independently.

---

### 1.2 `EventTarget is not defined` from bundled Node.js dependencies

**Commits:** `0a05d6b`, `d9de255`

**Problem:** Invoking `/ctf start` crashed immediately with `EventTarget is not defined` inside the Vercel Workflow runtime.

**Root cause:** The workflow VM isolate does not provide browser/Node globals like `EventTarget`. The `@upstash/redis` package has a `Subscriber` class that extends `EventTarget`. When the workflow file imported modules that transitively imported `@upstash/redis`, the bundler pulled ~33K lines of Redis client code into the VM bundle, triggering the crash on load.

**Fix (attempt 1):** Added `@upstash/redis` to `serverExternalPackages` in `next.config.ts` to exclude it from the bundle. This worked partially but didn't cover all import paths.

**Fix (attempt 2 - final):** Moved all `db`, `redis`, and `drizzle-orm` imports out of `ctf-match.ts` entirely. Any DB/Redis work in the catch block was extracted into a dedicated `forceFailMatch` step function in `cleanup.ts`. Reverted the `serverExternalPackages` hack since it was no longer needed.

**Takeaway:** Workflow files are bundled into a VM isolate with a minimal global environment. Never import heavy server-side SDKs (database drivers, Redis clients, ORMs) in the workflow orchestration file. Keep the workflow file as a thin dispatcher that only calls `step.run()` functions defined in separate modules.

---

### 1.3 Catch-block code running in the wrong context

**Commit:** `d9de255`

**Problem:** The workflow's top-level `try/catch` block called `failMatch()` directly, which used `db` and `redis` imports. This code ran in the workflow VM context where those modules crashed (see 1.2).

**Root cause:** Code in a workflow catch block still runs inside the VM isolate. Direct calls to DB/Redis aren't wrapped in `step.run()`, so they execute in the restricted VM environment.

**Fix:** Extracted the fallback logic into a `forceFailMatch` step function that runs via `step.run()`, which executes in the full Node.js server context.

**Takeaway:** Everything in a Vercel Workflow file runs in the VM isolate unless wrapped in `step.run()`. This includes catch blocks. If your error-handling logic needs server-side APIs, wrap it in a step.

---

## 2. AI SDK / Agentic Loop Pitfalls

### 2.1 AI terminates after one tool call (missing `stopWhen`)

**Commits:** `a5e2bc9`, `aa0bf33`

**Problem:** The AI attacker submitted zero flag captures. The AI builder created incomplete apps that failed health checks.

**Root cause:** `generateText` without `stopWhen` executes only a single round of tool calls. The AI would call one tool, get a result, and then stop — never continuing to the next logical step (e.g., reading the response, extracting a flag, submitting it).

**Fix:** Added `stopWhen: stepCountIs(30)` to the attacker and `stopWhen: stepCountIs(20)` to the builder, allowing multi-turn agentic loops.

**Takeaway:** When using the AI SDK for agentic workflows, always set `stopWhen` to allow multiple tool-call rounds. Without it, `generateText` defaults to a single round trip. Choose a step count that gives the AI enough room to complete multi-step tasks.

---

### 2.2 Breaking API changes across AI SDK versions

**Commit:** `3ebae76`

**Problem:** Build failed after upgrading AI SDK with errors about unknown properties.

**Root cause:** AI SDK v6 renamed several options:
- `parameters` → `inputSchema` (tool definitions)
- `maxTokens` → `maxOutputTokens`
- `timeout` → `{ totalMs }`

Additionally, Chat SDK changed its Modal/TextInput from JSX components to function-call API.

**Fix:** Renamed all affected properties across tool definitions, `generateText` calls, and bot UI code. Converted `.tsx` bot file to `.ts` with function-call API.

**Takeaway:** Pin AI SDK versions and read the changelog before upgrading. The SDK has made breaking renames between major versions. Search the codebase for old property names after any upgrade.

---

### 2.3 Vague prompts causing malformed AI output

**Commit:** `85504ac`

**Problem:** AI attackers submitted uppercase hex strings and incorrectly formatted flags that failed validation.

**Root cause:** The attack prompt didn't specify the exact flag format constraints. The AI guessed at the format and submitted variations that didn't match the `^[a-f0-9]{64}$` pattern.

**Fix:** Updated the attack prompt to explicitly state: lowercase hex, 64 characters, exact format example.

**Takeaway:** Be explicit and precise in AI prompts, especially for structured output. Include exact format specifications, regex patterns, and concrete examples. Never assume the AI will infer format constraints from context.

---

## 3. Sandbox API Pitfalls

### 3.1 Double `https://` from misunderstanding `domain()` return value

**Commit:** `d3deb12`

**Problem:** Sandbox health checks failed with malformed URLs like `https://https://sb-xxx.vercel.run`.

**Root cause:** `sandbox.domain()` already returns a full URL including the `https://` scheme. The code wrapped it with `` `https://${sandbox.domain()}` ``, producing a double-protocol URL.

**Fix:** Used `sandbox.domain()` directly without prepending the scheme.

**Takeaway:** Check what SDK methods actually return before wrapping them. Read the return type — if it says "URL" it likely includes the scheme. A quick `console.log` during development catches this instantly.

---

### 3.2 `snapshot()` returns an object, not a string

**Commit:** `02f3ae5`

**Problem:** The snapshot creation script stored an `[object Object]` string as the snapshot ID.

**Root cause:** `sandbox.snapshot()` returns a `Snapshot` object with a `.snapshotId` property. The code assigned the whole object to a string variable.

**Fix:** Access `.snapshotId` on the returned object.

**Takeaway:** Always check the return type of SDK methods, especially when they wrap complex operations. Destructure or access the specific property you need rather than assuming a primitive return.

---

### 3.3 Unrealistic build complexity and missing `startServer` tool

**Commit:** `499ba3b`

**Problem:** AI-driven sandbox builds timed out consistently.

**Root cause:** Two issues compounded:
1. The default app spec was a full Next.js e-commerce app with 10 vulnerabilities — far too complex for an AI to build within the time budget.
2. There was no tool for starting a long-running server process. The AI had no way to launch `node server.js` without the build step blocking on it.

**Fix:** Simplified defaults to an Express.js API with 5 vulnerabilities. Added a `startServer` tool with `detached: true` so the AI can start a background server process. Added snapshot-based sandbox creation to skip `npm install`. Fixed invalid default model IDs.

**Takeaway:** Design AI tasks to be achievable within time and complexity constraints. Provide tools for every operation the AI needs to perform — if it needs to start a background process, give it an explicit tool for that. Test with realistic constraints before shipping.

---

## 4. Environment & Configuration Pitfalls

### 4.1 Redis env var naming mismatch

**Commit:** `dfe0bf3`

**Problem:** Redis client failed to connect in production. No errors locally because `.env.local` had the right values.

**Root cause:** The code referenced `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, but Vercel's KV integration provisions `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Different naming conventions for the same service.

**Fix:** Updated the Redis client to use the `KV_REST_API_*` env vars that Vercel actually sets.

**Takeaway:** When using Vercel integrations, check the actual env var names provisioned in the Vercel dashboard — don't assume they match the provider's documentation. Vercel KV uses `KV_REST_API_*`, not Upstash's native `UPSTASH_REDIS_REST_*` names.

---

### 4.2 `drizzle-kit` not loading `.env.local`

**Commit:** `7e5bc57`

**Problem:** `drizzle-kit push` and `drizzle-kit generate` failed with "DATABASE_URL not found."

**Root cause:** `drizzle-kit` runs outside of Next.js, so it doesn't automatically load `.env.local`. The `DATABASE_URL` was defined there but invisible to the CLI tool.

**Fix:** Added `dotenv-cli` as a dev dependency and prefixed all drizzle-kit scripts with `dotenv -e .env.local --` to explicitly load the env file.

**Takeaway:** CLI tools outside the Next.js runtime don't load `.env.local`. Use `dotenv-cli` or similar to explicitly load environment files for standalone scripts and tools.

---

## 5. Data Integrity & Error Handling Pitfalls

### 5.1 Timeline not copied to DB on match failure

**Commit:** `d7dde95`

**Problem:** When a match failed, all timeline events were lost. The match detail page showed an empty timeline.

**Root cause:** `failMatch` was not copying the Redis timeline to the database before marking the match as failed. `cleanupMatch` was also dropping the `timestamp` field when inserting events into the DB.

**Fix:** Created a shared `copyTimelineToDb` helper used by both `failMatch` and `cleanupMatch`. The helper maps event `timestamp` to the DB's `createdAt` column. Added try/catch around `failMatch` with a last-resort DB update to prevent matches from getting stuck in LIVE status.

**Takeaway:** Always persist ephemeral data (Redis, in-memory) to durable storage before cleanup, especially in failure paths. Failure paths are the most important place to preserve diagnostic data.

---

### 5.2 `buildAllApps` calling wrong function, skipping events

**Commit:** `50755fd`

**Problem:** Build events never appeared in the timeline. The frontend couldn't map deploy results to players.

**Root cause:** `buildAllApps` called `buildApp` directly instead of `buildPlayerApp`, bypassing all event emission and DB status updates. Deploy events were also missing the `playerId` field.

**Fix:** Changed `buildAllApps` to call `buildPlayerApp`. Added `playerId` to deploy event payloads. Set `buildStatus` to `"live"` for successful builds.

**Takeaway:** When you have a public function that wraps a lower-level one with side effects (events, logging, DB writes), always call through the public function. Direct calls to internals silently skip critical side effects.

---

### 5.3 No failure reason stored for invalid flags

**Commit:** `0261b1b`

**Problem:** Operators couldn't tell why flag submissions were rejected. The flag log just showed "invalid" with no explanation.

**Root cause:** The `flag_captures` table had no column for storing the validation error message. Invalid submissions were recorded with status only.

**Fix:** Added a `failure_reason` column to `flag_captures`. The validation logic now stores the specific error (wrong format, unknown flag, already captured, etc.). The `FlagLog` component displays the reason.

**Takeaway:** Always store the "why" alongside the "what" for failures. A boolean `isValid` flag is not enough — capture and display the specific validation error to aid debugging and operator visibility.

---

## 6. TypeScript & Build Pitfalls

### 6.1 Loose JSONB typing failing strict mode

**Commit:** `f5cb24f`

**Problem:** Vercel build failed with TypeScript errors on the match detail page.

**Root cause:** The Drizzle `jsonb` column returns `Record<string, unknown>` by default. Accessing specific properties on this type fails under strict TypeScript without a proper cast.

**Fix:** Cast the jsonb `config` field to the proper typed interface (`MatchConfig`) at the point of use.

**Takeaway:** Always define and apply TypeScript interfaces for JSONB columns. Don't rely on the ORM's default `unknown` type — cast early at the query boundary to get type safety throughout the component.

---

### 6.2 Eager client initialization failing at build time

**Commit:** `3ebae76`

**Problem:** Next.js build failed because DB, Redis, and Chat bot clients tried to initialize at import time, when environment variables weren't available.

**Root cause:** Module-level `const db = drizzle(...)` and `const redis = new Redis(...)` execute during the build's static analysis phase. At build time, `DATABASE_URL` and `KV_REST_API_*` aren't set, causing initialization errors.

**Fix:** Changed all clients to lazy initialization — export a getter function or use a module-level `let` with an `init()` guard that runs on first access.

**Takeaway:** Never initialize external clients at module scope in Next.js. Use lazy initialization patterns so clients are only created when actually needed at runtime, not during the build.

---

## 7. Frontend / Event Contract Pitfalls

### 7.1 Backend/frontend key mismatch (`score` vs `totalScore`)

**Commit:** `7ca521b`

**Problem:** The sandbox arena component didn't display scores after a match completed.

**Root cause:** The backend's `scoring_completed` event emitted a `score` field, but the frontend component looked for `totalScore`. No shared type enforced the contract.

**Fix:** Updated the frontend to handle both `score` and `totalScore` keys. Enriched all event payloads with additional context fields.

**Takeaway:** Define shared TypeScript types for event payloads used across backend and frontend. If both sides reference the same type, key mismatches become compile-time errors instead of silent runtime bugs.

---

### 7.2 Sparse event payloads missing display context

**Commits:** `7ca521b`, `85504ac`

**Problem:** Timeline events showed minimal information. Vulnerability events lacked descriptions, attack events lacked category info, and scoring events lacked point breakdowns.

**Root cause:** Event payloads were designed with only the minimum fields needed for processing, not for display. The frontend had no way to show rich context because the data wasn't there.

**Fix:** Enriched event payloads across the board:
- `vulnerability_registered`: added `description`, `modelId`
- `flag_captured`: added `vulnerabilityCategory`, `vulnerabilityDescription`
- `scoring_completed`: added `playerId`, `capturePoints`, `firstBloodBonus`, `defensePoints`
- Made app URLs clickable anchor tags in the sandbox arena

**Takeaway:** Design event payloads for consumers, not just producers. Include enough context for the UI to render meaningful information without needing to join data from other sources. Think about what the frontend needs to display at event design time.
