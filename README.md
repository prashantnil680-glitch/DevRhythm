
# DevRhythm – Coding Practice with Spaced Repetition

<div align="center">
  <img src="https://github.com/user-attachments/assets/91596b18-5c4b-401e-94da-fb1a957f5939" alt="DevRhythm Logo" style="width: 100%; max-width: 1200px; height: auto; display: block; margin: 0 auto;" />
</div>

<p align="center">
  <strong>Learn to code. Never forget.</strong><br/>
  DevRhythm combines LeetCode‑style problem solving with a spaced repetition system (SRS) to help you retain algorithms and data structures permanently.
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white" alt="Node.js" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white" alt="Express" /></a>
  <a href="#"><img src="https://img.shields.io/badge/MongoDB-6.x-47A248?logo=mongodb&logoColor=white" alt="MongoDB" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Redis-7.x-DC382D?logo=redis&logoColor=white" alt="Redis" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Next.js-16.x-000000?logo=next.js&logoColor=white" alt="Next.js" /></a>
  <a href="#"><img src="https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black" alt="React" /></a>
  <a href="#"><img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="#"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License" /></a>
  <a href="#"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" /></a>
</p>

---

## 📌 Project Overview

DevRhythm is a full‑stack platform for developers who want to master coding problems through deliberate practice and evidence‑based revision. It synchronises with LeetCode (and other OJ platforms), tracks your progress, and automatically schedules revisions using an SRS algorithm – exactly like Anki, but built for coding.

The platform includes:
- **Dashboard** with heatmaps, streaks, and weekly summaries.
- **Question library** with filtering by difficulty, pattern, platform, and search.
- **Code editor** with syntax checking and test case execution (via external providers).
- **Spaced repetition** – each solved problem generates revision tasks (1, 3, 7, 14, 30 days).
- **Goals & study plans** – daily, weekly, and custom planned goals.
- **Sheets** – collaborative problem lists (like “Blind 75” or “Neetcode 150”).
- **Community features** – follow users, study groups, leaderboards.
- **Activity feed** and detailed statistics.

---

## ✨ Key Features

| Category | Features |
|----------|----------|
| **🧠 Spaced Repetition** | Automatic revision scheduling (1,3,7,14,30 days), overdue tracking, confidence‑based progression |
| **📊 Progress Tracking** | Heatmap calendar, daily/weekly/monthly trends, mastery rate, time spent analytics |
| **💻 Code Practice** | Multi‑language support (Python, C++, Java, JS), test case runner, execution history, syntax validation |
| **🎯 Goals** | Daily / weekly solve goals, custom planned goals (specific question sets), automatic completion tracking |
| **📚 Sheets** | Create/share curated problem lists, track collective progress, join sheets with target dates |
| **👥 Social** | Follow other users, view public profiles, study groups with shared challenges and goals |
| **📈 Insights** | Pattern mastery dashboard, weakest/strongest patterns, revision recommendations |
| **🔔 Notifications** | Revision reminders, goal completions, new followers, weekly reports (in‑app + email) |
| **🔗 Platform Integration** | Fetch problems from LeetCode (title, description, test cases, starter code) |

---

## 🧰 Tech Stack

### Backend
- **Runtime**: Node.js 20.x
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Cache & Queues**: Redis (Redis Cloud) + Bull
- **Authentication**: Passport.js (Google, GitHub)
- **Code Execution**: external provider (e.g., onlinecompiler.io / Judge0) – *local sandbox also supported*
- **File Storage**: Cloudinary
- **Email**: Mailjet (pluggable)
- **Scheduling**: node-cron
- **Validation**: Joi
- **Logging**: Winston + Morgan
- **Security**: Helmet, CORS, express-rate-limit

### Frontend
- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Language**: TypeScript
- **Code Editor**: CodeMirror 6 (`@codemirror/lang-*`)
- **State & Data**: React Query (`@tanstack/react-query`), `react-hook-form` + Zod
- **Styling**: CSS Modules + CSS variables (light/dark theme via `next-themes`)
- **HTTP Client**: Axios
- **Charts**: Chart.js (`react-chartjs-2`)
- **Animations**: Framer Motion
- **Markdown**: `react-markdown` + `remark-gfm`
- **Syntax Highlighting**: `react-syntax-highlighter`
- **Date Handling**: `date-fns`, `react-datepicker`
- **Notifications**: `react-hot-toast`
- **Analytics & Monitoring**: `@vercel/analytics`, `@vercel/speed-insights`

### DevOps & Deployment
- **Hosting**: Railway (backend), Vercel (frontend)
- **Domain**: `devrhythm.space`
- **CI/CD**: Automatic deployments from GitHub branches

---

## 🏗️ System Architecture (High‑Level)

```
                        ┌─────────────────┐
                        │   Frontend      │
                        │  (Next.js on    │
                        │   Vercel)       │
                        └────────┬────────┘
                                 │ HTTPS
                                 ▼
                        ┌─────────────────┐
                        │   API Gateway   │
                        │  (Express)      │
                        │ on Railway      │
                        └────────┬────────┘
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
     ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
     │   MongoDB   │    │    Redis    │    │  Bull       │
     │   Atlas     │    │  Cloud      │    │  Queues     │
     └─────────────┘    └─────────────┘    └─────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ Code Execution  │
                        │ Provider        │
                        └─────────────────┘
```

---

## 🔧 Backend Architecture (Detailed)

### 1. Request Lifecycle
- HTTP request → Middleware chain (CORS, Helmet, compression, JSON, session, Passport, timezone, rate limiting, logging) → Route handler → Service layer → Database/queue → Formatted JSON response.

### 2. Database Layer (MongoDB)
- **Mongoose ODM** – 20+ models.
- **Indexing** – compound indexes for all query patterns.
- **Soft deletes** – `isActive` flag.
- **TTL indexes** – for ephemeral data (completed jobs, expired notifications).

### 3. Caching & Session Store (Redis)
- Session store (`express-session` + `connect-redis`).
- API response cache (dashboard, user lists, leaderboards) – TTL 15‑60 seconds.
- Redis‑backed rate limiting.
- Distributed locks for critical sections.
- Bull queue storage.

### 4. Background Processing (Bull Queues)
Three dedicated queues:

| Queue | Purpose | Concurrency |
|-------|---------|-------------|
| **Main queue** | Revision creation, goal completion, notifications, sheet imports | 10 |
| **Fast code exec** | Python, JavaScript submissions | 20 |
| **Slow code exec** | C++, Java submissions | 5 |

**Job types (examples):**
- `question.solved` – updates stats, pattern mastery, revision schedule, goals.
- `revision.completed` – increments revision count, confidence, heatmap.
- `goal.completed` – fires notifications.
- `pod.available` – sends Problem‑of‑the‑Day notifications.
- `sheet.import`, `sheet.create` – async sheet processing.
- `user.timezone_change` – updates all date fields across collections.

**Reliability:** Idempotent jobs, exponential backoff retries, stale job cleanup.

### 5. Scheduled Cron Jobs

| Job | Schedule | Responsibility |
|-----|----------|----------------|
| `dailyQuestionJob` | Every hour | Fetch LeetCode POD, queue notifications. |
| `leaderboardJobs` | Weekly & Monthly | Compute top 100 users, store snapshots. |
| `goalSnapshotJob` | Daily & Monthly | Aggregate goal completions for charts. |
| `expiredGoalsJob` | Daily 00:00 | Mark daily/weekly goals as failed. |
| `plannedGoalExpiryJob` | Daily 00:00 | Mark planned goals as failed. |
| `updateOverdueRevisionsJob` | Every hour | Advance revision indices past due dates. |
| `notificationJobs` | Various | Send revision reminders, weekly reports. |
| `digestEmailJob` | 17:00 daily | Send daily email digests. |
| `tempFileCleanupJob` | 02:00 daily | Remove stale temporary files. |
| `dualQueueCleanupJob` | Every minute | Remove stale code execution jobs. |

### 6. Authentication & Authorisation
- OAuth2 (Google, GitHub) via Passport.js.
- JWT access + refresh tokens (exchanged via one‑time code stored in Redis).
- Internal requests (localhost + header) bypass auth for cron/queue jobs.
- Admin endpoints protected by static API key.

### 7. Timezone Handling
- All dates stored in **UTC**.
- User timezone detected via IP (`geoip-lite`) on first login.
- Date calculations use `luxon` to convert to user’s local timezone.
- Revision schedules stored as UTC midnight of the target day in user’s timezone.

### 8. Code Execution Flow
1. User submits code + test cases.
2. Syntax validation (Python: `py_compile`, C++: compiler `-fsyntax-only`).
3. Metadata extraction from starter code (class, method, parameters, return type).
4. Language‑specific wrapper generator produces a self‑contained script that deserialises JSON input, calls the user’s method, and serialises the output.
5. Wrapper sent to external provider (onlinecompiler.io / Judge0).
6. Results compared (order‑insensitive, floating‑point tolerance).
7. On all tests passed: question marked solved, revision schedule created, execution history saved (keep last successful + last two failures).

### 9. Notification & Email System
- In‑app notifications stored in MongoDB, expire after 3 days.
- Email provider pluggable (currently Mailjet).
- Daily digest emails – one email per user containing all new notifications since last digest.

### 10. Observability & Health
- Winston + Morgan logging.
- Health check endpoint (`/api/v1/health`) reports DB/Redis/uptime.
- Admin queue monitoring endpoints.
- Central error handler returns consistent JSON.

---

## 🎨 Frontend Architecture (Detailed)

### 1. Routing & Pages
- Next.js App Router – folder‑based routes.
- Route groups: `(auth)` for unauthenticated, `(main)` for authenticated.
- Dynamic routes: `questions/[slug]`, `sheets/[slug]/progress/[username]`, `activity/[date]`.

### 2. State & Data Management
- **React Query** – server state caching, background refetching, mutations.
- **`react-hook-form` + Zod** – form handling and validation.
- **Zustand** – client‑side global state (theme, auth token, UI toggles).
- **Local state** – `useState`/`useReducer`.

### 3. Data Fetching & API Integration
- Axios instance with interceptors (JWT token, 401 handling, refresh logic).
- Feature‑specific service modules (`questionService.ts`, etc.).
- Custom React Query hooks (`useQuestions`, `useDashboard`, etc.).
- Server components for static pages – fetch via server‑side API client.

### 4. UI Component Architecture
- **Atoms** – `Button`, `Input`, `Card`, `Badge`, `Avatar`.
- **Molecules** – `SearchBar`, `FilterChip`, `ConfidenceStars`.
- **Organisms** – `Navbar`, `Heatmap`, `QuestionCard`.
- **Templates** – page‑level components.
- **Lazy loading** – `next/dynamic` + Suspense for editor, revision timeline, charts.
- **Theming** – CSS variables, light/dark toggled via `next-themes` and Zustand.
- **Animations** – Framer Motion for smooth transitions.

### 5. Authentication Flow
1. User clicks “Login” – redirected to backend OAuth.
2. After consent, backend redirects to `/auth/callback?code=`.
3. Frontend exchanges code for JWT tokens.
4. Tokens stored in Zustand (and optionally localStorage).
5. Axios interceptor attaches token to every request.
6. On 401, refresh token is used; if fails, logout.

### 6. Real‑time & Background Updates
- Polling (`refetchInterval`) for pending revisions and notification unread count.
- No WebSockets (simulated via React Query).

### 7. Code Editor & Execution
- **CodeMirror 6** editor with language support for Python, C++, Java, JS.
- Custom execution results panel with test case output.
- `useRunCode` hook – sync endpoint (or async with polling for long runs).
- On all tests passed, question status updates automatically (React Query invalidation).

### 8. Performance Optimisations
- Next.js Image optimisation.
- Route prefetching.
- Dynamic imports for large components (CodeMirror, charts).
- React Query aggressive caching + stale‑while‑revalidate.
- Debounced search.
- CSS Modules (scoped, small bundle).
- Bundle analyzer (`@next/bundle-analyzer`) integrated.

### 9. Folder Structure (Simplified)
```
frontend/
├── app/                    # Next.js App Router
├── features/               # Domain modules (auth, dashboard, question, revision, sheets, goal, activity, etc.)
├── shared/                 # Reusable components, hooks, lib, types, styles
├── providers/              # Context providers (Auth, Theme, React Query)
└── public/                 # Static assets
```

### 10. Key Design Decisions
- Feature‑first organisation – scalable.
- No external UI library – full control.
- React Query over Redux – server state is primary.
- CodeMirror over Monaco – smaller bundle, better Next.js compatibility.
- Zod + `react-hook-form` – type‑safe form handling.
- Framer Motion – adds polish without performance overhead.
- Server components for SEO – critical content delivered immediately.

---

## 💡 Core Functionality (How It Works)

### 1. Solving a Problem
- Write code in CodeMirror editor, run test cases.
- On all tests passed → problem marked **Solved**.
- Revision schedule created (1,3,7,14,30 days).
- Activity log, heatmap, stats, pattern mastery updated.
- If problem is LeetCode POD → special notification.

### 2. Revisions
- Dashboard shows pending revisions (on‑time + overdue).
- Mark revision completed after ≥20 minutes or passing all tests again.
- Revision count, confidence level, heatmap updated.
- May advance planned goals.

### 3. Goals
- **Daily/Weekly** – auto‑created, progress increments on any solve within the period.
- **Planned** – select a set of questions + deadline; track per‑question solve/revision.

### 4. Sheets
- Curated problem lists with target completion date.
- Join a sheet, mark problems as solved/revision completed.
- Progress charts (individual + group).
- Owner can edit; participants can leave.

### 5. Pattern Mastery
- Extracts problem patterns from tags.
- Computes solved count, mastered count, confidence level per pattern.
- Recommends weakest patterns for improvement.

---

## 📁 Folder Structure Overview

### Backend (`/backend`)
```
backend/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── services/
│   ├── jobs/
│   ├── utils/
│   └── scripts/
├── package.json
└── .env (not in repo)
```

### Frontend (simplified)
```
frontend/
├── app/
├── features/
├── shared/
├── providers/
└── public/
```

---

## 🔌 API Overview (High‑Level)

All endpoints under `/api/v1`. Authentication via JWT Bearer token.

| Resource       | Example Endpoints                                      |
|----------------|--------------------------------------------------------|
| **Auth**       | `/auth/google`, `/auth/github`, `/auth/exchange`      |
| **Users**      | `/users/me`, `/users/:username`, `/users` (list)      |
| **Questions**  | `/questions`, `/questions/:id/details`, `/questions/search-leetcode` |
| **Progress**   | `/progress/question/:questionId`, `/progress/attempt/:questionId` |
| **Revisions**  | `/revisions/today`, `/revisions/question/:questionId/complete` |
| **Goals**      | `/goals`, `/goals/current`, `/goals/planned`          |
| **Sheets**     | `/sheets`, `/sheets/:slug`, `/sheets/:slug/join`      |
| **Activity**   | `/activity`, `/activity/today`, `/activity/day/:date` |
| **Heatmap**    | `/heatmap`, `/heatmap/:year`                          |
| **Patterns**   | `/pattern-mastery`, `/pattern-mastery/weakest`        |
| **Leaderboard**| `/leaderboard/weekly`                                 |
| **Notifications** | `/notifications`                                  |

---

## ⚡ Performance Optimizations

- Database indexing (compound indexes).
- Redis caching (TTL 15‑60s).
- Bull queues (fast/slow split).
- Aggregation pipelines instead of multiple queries.
- Lazy loading + code splitting in frontend.
- Image optimisation (Next.js).
- Timezone‑aware pre‑computed snapshots.

---

## 🧠 Design Decisions

1. Spaced repetition built into core – every solve triggers a revision schedule.
2. UTC storage + local display – cron jobs respect user’s local day.
3. Two‑tier code execution queues – isolate slow languages.
4. Redis for caching and queues – single dependency.
5. Feature‑first frontend – scalable.
6. External code execution provider – security.
7. Own UI component library – full control.

---

## 🧪 Challenges & Learnings

| Challenge | Solution / Lesson |
|-----------|-------------------|
| Timezone complexities | Store UTC, convert with `luxon` for user boundaries. |
| Duplicate revision completions | Distributed locks + idempotency. |
| Automatic confidence scoring | Increment by 0.25 per solve/revision/time spent (cap at 5). |
| Heatmap performance | Pre‑generated `HeatmapData` with incremental updates. |
| CORS with custom domains | Exact `FRONTEND_URL` (no trailing slash). |
| Queue backpressure | Fast/slow queue split + cleanup jobs. |
| DNS blocking on Railway | Custom domain (`api.devrhythm.space`) + proper DNS. |

---

## 📸 Screenshots / Demo

> Screenshots will be added in a separate media folder.

Live demo: [https://devrhythm.space](https://devrhythm.space) (requires login)

---

## 🗺️ Future Roadmap

- [ ] AI‑powered hints (LLM).
- [ ] Mobile app (React Native).
- [ ] Import from Codeforces / HackerRank.
- [ ] Teams & organisations.
- [ ] Retention curves / predicted mastery dates.
- [ ] Local Docker sandbox for self‑hosted.
- [ ] OpenAPI specification.

---

## 🔒 Security Approach (High‑Level)

- OAuth2 only (no passwords).
- JWT access + refresh tokens (HTTP‑only cookie optional).
- CORS restricted to known origins.
- Redis‑backed rate limiting.
- Helmet security headers.
- Joi input validation.
- External code execution provider (no local sandbox in production).
- Secrets never committed; use platform environment variables.

---

## 📄 License

[MIT](LICENSE)

---

**Happy coding – and never forget what you learn!** 🚀

*DevRhythm – Turn practice into permanent knowledge.*


The logo now spans the full width of the container (up to 1200px max to avoid being too large on ultra‑wide screens) while remaining responsive and properly visible.
