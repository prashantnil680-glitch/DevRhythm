# Frontend Developer Handoff: Activity Dashboard

Below are precise instructions for implementing the **Activity Dashboard** page, based on the final wireframes and specifications. Follow the existing project conventions (Next.js App Router, TypeScript, React Query, CSS Modules with custom properties).

---

## 1. Page route & Data fetching

- **Route:** `/app/activity/page.tsx` (server component wrapper) → `ActivityDashboard.tsx` (client component).
- Use **React Query** (`@tanstack/react-query`) for all API calls.
- API endpoints (all `GET`):
  - `/api/v1/trends/daily?days=30` → daily trend chart.
  - `/api/v1/trends/monthly?months=12&includeComparison=true` → monthly trend chart.
  - `/api/v1/activity/today` → hero summary + day’s questions/revisions.
  - `/api/v1/activity/feed/today-grouped?page=1&limit=10` → social feed.
  - `/api/v1/activity/?page=1&limit=10&action=<tab>` → all activity log (tab-dependent).
- Each query should have a `staleTime: 5 * 60 * 1000` to avoid refetching too often.

### Data flow patterns

- **Hero & Day’s questions:** Fetch `today` once. Pass the data down.
- **Charts:** Fetch daily/monthly data; client‑side charts will use processed arrays.
- **Social Feed:** Fetch grouped feed (no pagination on the wireframe; use default limit=10).
- **All Activity Log:** Use a state variable for `activeTab` (one of `'question_solved'`, `'revision_completed'`, `'goal_achieved'`, `'group_goal_progress'`). When tab changes, fetch the endpoint with `action=<tab>` and page. Implement pagination with `useState` for `page`.

---

## 2. Grid system (CSS)

Create a component shell: `DashboardGrid.module.css`.

```css
.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 16px;
  max-width: 940px;
  margin: 0 auto;
  padding: 24px 16px;
}

/* Tablet: 8 columns */
@media (max-width: 768px) {
  .grid {
    grid-template-columns: repeat(8, 1fr);
    gap: 12px;
    max-width: 100%;
    padding: 16px;
  }
}

/* Mobile: single column */
@media (max-width: 480px) {
  .grid {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 12px;
  }
}
```

**Card base styles:** Create a `Card.module.css` using theme variables:

```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  box-shadow: 0 2px 8px var(--shadow);
}
```

Apply `.card` to every section block. For each block, assign a specific grid column span via a utility class or inline style. Example:

```tsx
<div className={styles.card} style={{ gridColumn: '1 / -1' }}>
```

---

## 3. Section components (Desktop 940px grid assignments)

| Section | Grid Column Span |
|---------|------------------|
| Hero Summary | `1 / -1` (full width) |
| Daily Trend Chart | `1 / 9` |
| Day’s Questions & Revisions | `9 / -1` |
| Monthly Trend Chart | `1 / 8` |
| Social Feed | `8 / -1` |
| All Activity Log | `1 / -1` |

Tablet (768px) and Mobile (480px) use the breakpoints shown in the wireframes.

---

## 4. Theming – Light / Dark modes

- The `<body>` tag receives class `"light"` or `"dark"` (toggled by a button in the navbar – already existing).
- All colours **must** reference the CSS custom properties from `variables.css`, `light.css`, and `dark.css`. **Never use hardcoded hex values.**
- For heatmap or chart colours: use the existing `--heat-*` variables or define new ones under `:root` (ideally inside a `dashboard-theme.css` if needed, but try to reuse).
- Example:

```css
.statValue {
  color: var(--text-primary);
  font-family: var(--font-heading);
  font-weight: 300;
}
.difficultyMedium {
  color: var(--accent-moss);
}
```

---

## 5. Animations (CSS only)

All animations must be lightweight and production‑safe (no JS animation libraries).

### a. Card entry
```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.card {
  animation: fadeInUp 0.4s ease-out both;
}
/* Stagger each card with nth-child delays */
.card:nth-child(1) { animation-delay: 0s; }
.card:nth-child(2) { animation-delay: 0.05s; }
...
```

### b. Chart lines (draw effect)
For SVG‑based charts, use:
```css
.chartPath {
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  animation: drawLine 1s ease-in-out forwards;
}
@keyframes drawLine {
  to { stroke-dashoffset: 0; }
}
```

### c. Social Feed timeline hover
```css
.timelineItem {
  transition: transform 0.2s ease;
}
.timelineItem:hover {
  transform: translateX(4px);
}
```

### d. Pulse on “Goal Achieved” badge (optional)
```css
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(var(--accent-moss-rgb), 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(var(--accent-moss-rgb), 0); }
  100% { box-shadow: 0 0 0 0 rgba(var(--accent-moss-rgb), 0); }
}
.badge {
  animation: pulse 2s infinite;
}
```

---

## 6. Component details

### a. Hero Summary
- Data from `/activity/today`.
- Display: date, day of week, big numbers for `problemsSolved`, `revisionsCompleted`, `studyTimeMinutes`, progress bar for goal (`goalCompletion`% with target/current).
- Show `✓ Goal Achieved` badge if `goalAchieved === true`.
- **No date picker.**
- “View All →” links to `/activity?view=overview` or a dedicated full‑page view.

### b. Daily Trend Chart
- Use **Recharts** (or Chart.js). Use an area/line chart with four series:
  1. Problems Solved (stroke `var(--accent-moss)`)
  2. Revisions Completed (stroke `var(--accent-sand)`)
  3. Study Time (stroke `var(--text-muted)`)
  4. Goal Completion Rate (dashed, `var(--text-secondary)`)
- X‑axis: `labels` from API (format: `YYYY-MM-DD`), show abbreviated day/month.
- **No “View All” link**.

### c. Day’s Questions & Revisions
- Derived from the same `today` API response.
- Show two sections: “Solved today” and “Revisions done” as a list.
- Each item: question title (linked to `/questions/<platformQuestionId>`), difficulty pill, platform icon, time spent.
- “View All →” links to `/activity/today-details` or a modal.

### d. Monthly Trend Chart
- Bar chart with two datasets:
  - Problems Solved (bars, `var(--accent-moss)`)
  - Goals Completed (bars, `var(--accent-sand)`)
- Line overlay: Global Avg Goals Completed (dashed, `var(--text-muted)`). Use boolean `userAhead` to show a small indicator (e.g., checkmark) next to each month when ahead.
- X‑axis: month labels (`May 2025` … `Apr 2026`).
- **No “View All” link**.

### e. Social Feed
- Data: `/activity/feed/today-grouped`.
- Structure:
  - For each user in `data.users`:
    - **Follower name & username** (`userInfo.displayName` / `username`) as a heading.
    - Below it, a vertical timeline of their `solvedToday` items.
  - Each timeline item: dot connector (like `╰─`), question title, platform, time spent, timestamp.
- Styling: use a left‑bordered container for the timeline, similar to the existing `QuestionsList.module.css` but simpler.
- **No “View All” link**.

### f. All Activity Log
- Data: `/activity/` with `action` query param.
- Tabs: “Solved” (`question_solved`), “Revisions” (`revision_completed`), “Goals” (`goal_achieved`), “Group” (`group_goal_progress`).
- Active tab is highlighted with an underline (`border-bottom: 2px solid var(--accent-moss)`).
- Content:
  - **Solved tab:** list of `question_solved` entries; show title, platform, timestamp.
  - **Revisions tab:** separate lists for `on_time` and `overdue` with a small ratio indicator (use the `ratio` object from API).
  - **Goals tab:** separate completed/failed sections, each with pagination (`goal_achieved.completed` and `failed` arrays, plus pagination object). Show partial progress bars.
  - **Group tab:** list of `group_goal_progress` entries with delta and new progress.
- Pagination: Use `<button>` controls at bottom. Show “Page X of Y” and Prev/Next. On click, update page state and refetch with `page` param. **No “View All” or “Load More” link.**

### g. Empty & Loading States
- For every fetch, use React Query’s `isLoading` and `isError`.
- Loading: show `SkeletonLoader` (existing component) matching the card shape.
- Error: show `NoRecordFound` (existing) with a friendly message and retry button.
- Empty data (e.g., `users` object empty): render a subtle “No activity from followed users today” text.

---

## 7. Accessibility & Semantic HTML

- Use `<section>` for each card, with `aria-labelledby` referencing the title.
- Title of each card: `<h2>`.
- All interactive elements: `<button>` or `<a>` with proper `aria-label`.
- Pagination controls: `aria-label="Previous page"`, `aria-current="page"` on current page.
- Charts: include a table fallback for screen readers (use `aria-hidden` on canvas and a visually hidden table).

---

## 8. TypeScript Types

Based on the API responses, define types in `shared/types/activity.ts`. Use the structure from the sample responses. Ensure strict typing to prevent runtime errors.

---

## 9. Performance Considerations

- The dashboard should load fast: prefetch `today` and `daily` trend data on the server (using `React Query`'s `prefetchQuery` in a server component) and pass via `HydrationBoundary`.
- Lazy‑load charts with `next/dynamic` (`ssr: false`) to avoid heavy bundles.
- Pagination for All Activity Log: keep previous pages cached with React Query’s built‑in cache.

---

## 10. File Structure (suggestion)

```
src/
  app/
    activity/
      page.tsx               // server component, wraps HydrationBoundary
      ActivityDashboard.tsx   // client component, main grid
  features/
    activity/
      components/
        HeroSummary.tsx
        DailyTrendChart.tsx
        DayQuestionsRevisions.tsx
        MonthlyTrendChart.tsx
        SocialFeed.tsx
        AllActivityLog.tsx
      hooks/
        useActivityData.ts    // custom hooks for queries
      styles/
        DashboardGrid.module.css
        HeroSummary.module.css
        ...
  shared/
    types/
      activity.ts
```

---

By following these instructions, the developer will produce a pixel‑perfect, animated, dark/light‑themed activity dashboard consistent with the wireframes and the existing design system.