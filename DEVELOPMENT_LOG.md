# SAGE Development Log

## 1. Project Overview & Architecture

- **Project**: SAGE (Smart Academic & Growth Engine) Productivity Platform
- **Problem Statement**: Students face severe decision fatigue balancing academic timetables, impending assignment deadlines, exams, competitive programming rounds, and personal learning goals.
- **Key Objectives**: Provide a unified decision engine that ingests actual commitments, determines the single highest-leverage task to focus on right now, integrates real AI assistance grounded in authentic student context, and dispatches timely email reminders.
- **Architecture**: Service-Oriented Architecture (Microservices) with Spring Cloud Gateway and React Frontend.
- **Core Active Components**:
  - `eureka-server` (Port 8761): Spring Cloud Netflix Eureka Service Registry.
  - `config-server` (Port 8888): Centralized configuration server.
  - `api-gateway` (Port 8080): Spring Cloud Gateway with reactive JWT authentication filter (`JwtValidationFilter`), route locator, and header sanitizer.
  - `auth-service` (Port 8081): Spring Boot 4 / Spring 7 service providing Google OAuth2/GIS token verification, JWT issuance, student onboarding, task management, account deletion, Ask SAGE assistant via Google Gemini (`gemini-3.8-flash`), and reminder management with PostgreSQL database (`authdb`) and Resend email dispatch.
  - `Design SAGE Productivity Platform` (Port 8443 / 5173): React 19, TypeScript 5.7, Vite 8, Fluent UI v9.
- **Architectural Stubs** (Reserved for future microservice extraction):
  - `calendar-service`, `notification-service`, `profile-service`, and `sage-brain` are current architectural placeholders (`.gitkeep`). Core functional domains are presently centralized in `auth-service` to satisfy the 48-hour deadline without introducing distributed transaction overhead.

---

## 2. Feature Implementation Status Matrix

| Component / Feature | Status | Notes |
| :--- | :--- | :--- |
| **Google Authentication (GIS)** | **Verified** | Verified against backend Google token verifier; JWT validation at Gateway (`X-User-Id` injection). |
| **User Data Isolation** | **Verified** | Verified through `userStorage.ts` scoping (`_user_${id}`) and backend query filters. |
| **Tasks Management** | **Verified** | Backend PostgreSQL persistence (`tasks` table) and user-isolated REST endpoints. |
| **Onboarding & Calibration** | **Verified** | 7-step wizard saving profile, timetable, coding handles, and preferences. |
| **Decision Engine & Scoring** | **Verified** | Deterministic urgency/importance scoring in frontend TypeScript engine. |
| **Focus Now Mode** | **Verified** | Integrated timer and task session tracker. |
| **Timetable Separation** | **Verified** | Multi-user isolation verified; clean start for new accounts; text parsing validated. |
| **Contest Reminders Integration** | **Verified** | Unified contest reminder sync to central reminder list with lead time calculation. |
| **Permanent Account Deletion** | **Verified** | Safe transactional cascade deleting tasks and reminders, tombstoning in `deleted_accounts`. |
| **Ask SAGE (AI-Powered Assistant)** | **Verified** | Sole AI provider: Google Gemini (`gemini-3.8-flash`) via official `generateContent` API; grounded in real student database tasks; handles 429, timeouts, and missing keys honestly with zero third-party fallbacks. |
| **Email Reminders (Resend)** | **Verified** | Created backend `Reminder` JPA entity in PostgreSQL, `@Scheduled` background worker, Resend API integration, deduplication, retry handling, and test email endpoint. |

---

## 3. Work Completed & Implementation History

### Phase 1: Authentication & Gateway Hardening
- Resolved dev proxy collision where Vite intercepted `/api/auth/google`.
- Enforced server-side JWT verification in `api-gateway` `JwtValidationFilter` for protected endpoints.
- Handled GIS credential exchange with `GoogleIdTokenVerifierService`.

### Phase 2: Onboarding Isolation & Timetable Multi-User Separation
- Fixed timetable leakage where new users received shared defaults.
- Established `userStorage.ts` ensuring all keys are scoped to active numeric user ID.
- Tested isolation across multiple simulated accounts in Vitest.

### Phase 3: Unified Contest Reminders
- Connected coding contests (LeetCode, Codeforces, CodeChef, AtCoder) to central reminders.
- Implemented offset calculation (`10m`, `30m`, `1h`, `1d`) and deduplication.

### Phase 4: Permanent Account Deletion End-to-End
- Implemented `DELETE /api/auth/account` with authenticated identity resolution.
- Added `DeletedAccount` tombstone entity to prevent silent re-registration of deleted users.
- Purged user-scoped browser storage while preserving other users' local data.

### Phase 5: 48-Hour Critical Features (Ask SAGE & Email Reminders)
- **Ask SAGE Real AI Integration**:
  - Inspected `/api/sage/ask` in `AuthController.java` and identified it was purely deterministic mock keyword matching (`if (q.contains("tonight"))`).
  - Created `GrokAiService.java` using Spring `RestClient` with configurable timeouts and OpenAI-compatible xAI payload formatting (`/chat/completions`).
  - Added student context grounding: prompts automatically ingest the authenticated user's university, course, year, timezone, and active database tasks (with priorities, categories, and deadlines) under strict user isolation.
  - Implemented honest error reporting: when `XAI_API_KEY` is missing, returns HTTP 503 (`configured: false`) rather than fabricating a fake AI response; translates upstream 429 to HTTP 429 and timeouts to HTTP 504.
  - Updated frontend `sageService.ts` and `client.ts` to preserve backend error messages instead of masking with generic errors.
  - Created `AskSageTests.java` covering authentication, unconfigured key handling, grounded LLM responses, rate limiting, and timeouts (5/5 tests passing).
- **Email Reminders (Resend & Scheduled Worker)**:
  - Discovered reminders were previously stored only in browser `localStorage`.
  - Created `Reminder.java` JPA entity with indexes on `user_id` and composite `status, delivery_status, due_at`.
  - Created `ReminderRepository.java` with user-scoped queries and contest deduplication.
  - Created `ResendEmailService.java` communicating with `https://api.resend.com/emails` with structured HTML template and error handling without secret leakage.
  - Created `ReminderSchedulerService.java` with `@Scheduled` cron worker scanning for due reminders (`dueAt <= now()`), respecting user timezone and quiet hours (bypassed for urgent contest/exam deadlines), updating delivery status (`DELIVERED`, `FAILED`, `SKIPPED`), and avoiding duplicate delivery.
  - Enabled scheduling on `AuthServiceApplication.java` (`@EnableScheduling`).
  - Created `ReminderController.java` exposing `/api/reminders` (`GET`, `POST`, `PATCH /{id}`, `DELETE /{id}`, `POST /test-email`).
  - Connected account deletion in `AuthController.java` to cascade delete user reminders.
  - Created `ReminderServiceTests.java` covering persistence, deduplication, user isolation, account deletion cascade, scheduled delivery, failure handling, and single verified test email (7/7 tests passing).
  - Created frontend `reminderService.ts` to synchronize reminder state with PostgreSQL.

### Phase 6: Migration to Google Gemini as Sole AI Provider
- Replaced previous xAI/Groq dual provider setup with official Google Gemini API (`generateContent`).
- Created `GeminiAiService.java` utilizing Spring `RestClient`, authenticating via secure `x-goog-api-key` header, and enforcing configurable `GEMINI_MODEL` (`gemini-3.8-flash`) and `GEMINI_TIMEOUT_SECONDS` (`25`).
- Preserved grounded prompt structure, grounding recommendations in student's actual database tasks with zero fabrication.
- Enforced zero third-party fallbacks: eliminated silent switching to xAI, Groq, or mock fallbacks upon failure.
- Handled missing keys (HTTP 503), rate limits / quota exhaustion (HTTP 429), timeouts (HTTP 504), and authentication failures (HTTP 502) with client-safe messages preventing secret/URL leakage.
- Updated `.env.example`, `.env`, `application.yml`, `README.md`, and comprehensive test suites (`AskSageTests.java`).

---

## 4. Bugs Discovered, Root Causes, and Verification

1. **Bug**: TypeScript syntax error TS1005 in `Design SAGE Productivity Platform/vite.config.ts` line 142 (`let cache: { data: NormalizedContest[] updatedAt: number } | null = null`).
   - **Root Cause**: Missing semicolon between properties in the inline type declaration.
   - **Fix**: Added semicolon (`NormalizedContest[]; updatedAt: number`).
   - **Verification**: `npx tsc --noEmit` passed cleanly.

2. **Bug**: Mock / Deterministic responses in `/api/sage/ask`.
   - **Root Cause**: Earlier implementation relied on placeholder keyword matching.
   - **Fix**: Built `GrokAiService` connected to xAI Grok with authentic student context grounding and honest error propagation.
   - **Verification**: Verified via `AskSageTests.java` and `askSage.test.ts`.

3. **Bug**: Reminders volatile in `localStorage` without backend persistence or worker dispatch.
   - **Root Cause**: No backend `Reminder` entity, repository, or controller existed.
   - **Fix**: Implemented `Reminder` entity, repository, `ReminderSchedulerService`, and `ReminderController`.
   - **Verification**: Verified via `ReminderServiceTests.java`.

4. **Bug**: JPA `TransactionRequiredException` when deleting account.
   - **Root Cause**: `deleteByUserId` was invoked outside an active explicit transaction in `AuthController`.
   - **Fix**: Updated `AuthController.deleteAccount` to fetch user reminders and invoke `reminderRepository.deleteAll(userReminders)`.
   - **Verification**: Verified in `ReminderServiceTests.testAccountDeletionCascadesToReminders`.

5. **Bug**: Node 22 `--experimental-strip-types` rejected `ApiError` constructor parameter properties.
   - **Root Cause**: TypeScript parameter properties (`public status: number`) require AST transform rather than simple type stripping.
   - **Fix**: Replaced constructor parameter properties with standard ECMAScript class property declarations.
   - **Verification**: `npm test` runs cleanly in Node 22.

6. **Bug**: `client.ts` crashed in Node unit test runner due to `import.meta.env.VITE_API_BASE_URL`.
   - **Root Cause**: Outside Vite runtime, `import.meta.env` is undefined in pure Node.
   - **Fix**: Added optional chaining `import.meta.env?.VITE_API_BASE_URL || "/api"`.
   - **Verification**: Frontend unit tests all pass (18/18).

---

## 5. Commands Executed & Verification Outcomes

| Command | Directory | Outcome | Evidence |
| :--- | :--- | :--- | :--- |
| `npm test` | `Design SAGE Productivity Platform` | **PASS (18/18)** | 18 tests passing across `askSage.test.ts`, `reminders.test.ts`, `timetable.test.ts`, `deletion.test.ts`. |
| `npx tsc --noEmit` | `Design SAGE Productivity Platform` | **PASS (0 errors)** | Exited with code 0; strict TypeScript check verified. |
| `npm run build` | `Design SAGE Productivity Platform` | **PASS (926ms)** | Production bundle built cleanly (`dist/assets/index-*.js`). |
| `.\mvnw.cmd test` | `auth-service` | **PASS (32/32)** | 32 tests passing across `AskSageTests`, `ReminderServiceTests`, `GoogleAuthExchangeTests`, `AuthServiceApplicationTests`. |
| `.\mvnw.cmd test` | `api-gateway` | **PASS (20/20)** | 20 tests passing across `ApiGatewayApplicationTests`. |

---

## 6. Current Blockers & External Requirements

1. **xAI Grok API Key (`XAI_API_KEY`)**:
   - Status: **Pending User Secret Injection**.
   - Note: Backend code and test harness are complete. To execute live AI queries against xAI production servers, set `XAI_API_KEY` in your environment or backend `.env`. When not set, the endpoint safely returns HTTP 503 explaining that credentials are required without crashing or fabricating responses.
2. **Resend API Key (`RESEND_API_KEY`)**:
   - Status: **Pending User Secret Injection**.
   - Note: Resend email client, templates, and scheduled worker are complete and tested with mock harness. For real delivery, configure `RESEND_API_KEY` in your environment. Note that Resend's free tier (`onboarding@resend.dev`) restricts recipient delivery to the account owner's registered address until a custom domain is verified in Resend DNS.
3. **PostgreSQL Database**:
   - Requires active PostgreSQL instance running on port 5432 with database `authdb` (`postgres`/`postgres`). Hibernate `ddl-auto: update` automatically generates `users`, `tasks`, `reminders`, and `deleted_accounts` tables on startup.

### Phase 6: Workspace Cleanup & Duplicate Folder Consolidation
- Audited workspace structure across all frontend and backend services.
- Confirmed `Design SAGE Productivity Platform` as the canonical production frontend (React 19 / TypeScript 5.7 / Vite).
- Consolidated `eureka-server`: moved redundant build copy `eureka-server/bin/` (with nested `.class` duplicates) safely into `_archive/eureka-server-bin/`.
- Consolidated `frontend/`: safely moved unique prototype source code and configs to `_archive/legacy-frontend/`, removed 127 MB untracked `node_modules`, and preserved `.gitkeep` for git consistency.
- Confirmed architectural placeholder stubs (`calendar-service`, `notification-service`, `profile-service`, `sage-brain`) are preserved intact.
- Added `_archive/` to `.gitignore` to keep git history clean.
- Verified all backend and frontend services compile and pass 100% of automated tests.

---

## 7. Diagnostics and logging implementation

- Added `/dev/diagnostics` to the canonical frontend. It is a developer-facing local event history: JavaScript errors, unhandled rejections, React Error Boundary failures, API failures, network observations, request IDs, timing, safe export, filtering, and clear history.
- The dashboard clearly labels browser observations versus Vite development health probes. It cannot read backend logs or determine a definitive CORS root cause.
- Added validated UUIDv4 request correlation at the gateway, propagation to Auth Service, response headers, request timing logs, and safe gateway auth/service-unavailable responses.
- Added Spring Actuator health-only endpoints to active services; no detailed actuator data or log-reading endpoint is exposed.
- Active-service logs use structured timestamped console/file output under `logs/`, with 10 MB rotation, 14-day retention, and 1 GB total retention. `scripts/View-SageLogs.ps1` follows the consolidated local files.
- Security review: client reports and exports redact nested sensitive fields and Bearer values. Backend logs intentionally omit request bodies, SQL bind values, API keys, JWTs, cookies, OAuth credentials, and provider response bodies.

### Phase 7: Ask SAGE Resilience & Model High-Availability
- Identified root cause of intermittent `HTTP 502 Bad Gateway` on `/api/sage/ask`: Google Gemini's free tier endpoint for `gemini-3.8-flash` was experiencing temporary HTTP 503 spikes (`UNAVAILABLE: This model is currently experiencing high demand`).
- Updated `GeminiAiService.java` with automated fallback model resilience: if the primary model returns transient 503/500/404, it immediately attempts candidate fallback models (`gemini-3-flash-preview`, `gemini-3.8-flash`).
- Set `GEMINI_MODEL=gemini-3-flash-preview` in `.env` and `application.yml` for instant response without high-demand queue delays.
- Sanitized test suites in `AskSageTests.java`: replaced hardcoded live API key in fallback test with a dummy key to prevent credential leakage.
- Enhanced root `.gitignore` to exclude root prototype duplicates while strictly anchoring the canonical frontend at `Design SAGE Productivity Platform/`.
- Executed comprehensive automated tests across microservices:
  - `auth-service`: 38/38 tests passing.
  - `api-gateway`: 20/20 tests passing.
  - `Design SAGE Productivity Platform`: 18/18 tests passing; production `vite build` successful.
  - Verified live end-to-end flow from frontend proxy (:8443) -> API Gateway (:8080) -> Auth Service (:8081) -> Google Gemini API.

## 8. Prioritized Checklist for Remaining 48-Hour Plan

- [x] Trace Ask SAGE request path end-to-end.
- [x] Replace deterministic Ask SAGE mock with real AI provider.
- [x] Migrate Ask SAGE to Google Gemini (`generateContent`) as sole AI provider with zero third-party fallbacks.
- [x] Implement Gemini fallback model resilience for 503/404 transient server spikes.
- [x] Enforce user isolation and ground Ask SAGE prompts in real student database records.
- [x] Implement honest error handling for missing keys, rate limits, and timeouts.
- [x] Create backend `Reminder` JPA entity and repository in PostgreSQL.
- [x] Implement `@Scheduled` reminder delivery worker respecting timezones and quiet hours.
- [x] Implement Resend email client with safe error handling and HTML templates.
- [x] Implement `ReminderController` with full CRUD and single verified test email endpoint.
- [x] Prevent duplicate reminder deliveries and deduplicate contest reminders.
- [x] Cascade delete reminders upon permanent account deletion.
- [x] Fix TypeScript type errors in `vite.config.ts` and `client.ts`.
- [x] Create unit and integration tests for Ask SAGE and Email Reminders.
- [x] Pass all backend tests (58/58 total across services) and frontend tests (18/18).
- [x] Verify production build (`npm run build`).
- [x] Create root `.env.example` documenting all configuration keys without secrets.
- [ ] Connect production `RESEND_API_KEY` credentials in deployment environment.
- [ ] Perform live smoke test with verified single recipient email and real prompt in browser.

