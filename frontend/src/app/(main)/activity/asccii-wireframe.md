/* ============================================================
   ACTIVITY DASHBOARD – FINAL WIREFRAMES (with improved Social Feed)
   Social Feed now features follower name + timeline of solved items.
   No "View All →" for Social Feed, Daily Trend, Monthly Trend.
   ============================================================ */


/* -------------------- DESKTOP (940px) ----------------------- */

+---------------------------------------------------------------------------+
|  HERO ACTIVITY SUMMARY (Today)                        grid-column: 1 / -1 |
| ┌─────────────────────────────────────────────────────────────────────────┐ |
| │ Tuesday, May 5, 2026                                    [ View All → ]  │ |
| │                                                                         │ |
| │  2               1               45 min           Goal 67%              │ |
| │ Problems Solved  Revisions       Study Time      ██████████████░░ (2/3) │ |
| │                                                                         │ |
| │  ✓ Goal Achieved                                                        │ |
| └─────────────────────────────────────────────────────────────────────────┘ |

+---------------------------------------------------------------------------+
|  DAILY TREND CHART (30 days)          |  DAY’S QUESTIONS & REVISIONS       |
|  grid-column: 1 / 9                   |  grid-column: 9 / -1               |
| ┌─────────────────────────────────────┐ ┌────────────────────────────────┐ |
| │ Multi‑line chart                    │ │ Solved today:                   │ |
| │ · Problems Solved (--accent-moss)   │ │  → Combinations (Medium) 15m    │ |
| │ · Revisions (--accent-sand)         │ │                                  │ |
| │ · Study Time (--text-muted)         │ │ Revisions done:                 │ |
| │ · Goal Completion Rate (dashed)     │ │  ↻ Binary Search (Easy)         │ |
| │ Labels: Apr 6 → May 5               │ │                                  │ |
| │                                     │ │ [ View All → ]                  │ |
| └─────────────────────────────────────┘ └────────────────────────────────┘ |

+---------------------------------------------------------------------------+
|  MONTHLY TREND CHART (12 months)      |  SOCIAL FEED                       |
|  grid-column: 1 / 8                   |  grid-column: 8 / -1              |
| ┌─────────────────────────────────────┐ ┌────────────────────────────────┐ |
| │ Bar chart + comparison line         │ │ John Doe (johndoe)              │ |
| │ · Problems Solved (bar, moss)       │ │ ╰─ Combinations (Medium) 15m    │ |
| │ · Goals Completed (bar, sand)       │ │    LeetCode · 10:30 AM         │ |
| │ · Global Avg (dashed line, muted)   │ │ ╰─ Binary Tree Inorder (Easy)   │ |
| │ May 2025 → Apr 2026                 │ │    LeetCode · 9:15 AM          │ |
| │                                     │ │                                │ |
| │                                     │ │ Anupam Debnath (anupam)         │ |
| │                                     │ │ ╰─ LRU Cache (Medium) 69m      │ |
| │                                     │ │    LeetCode · 1:50 PM          │ |
| │                                     │ │                                │ |
| │                                     │ │ ( timeline with dot connectors )│ |
| └─────────────────────────────────────┘ └────────────────────────────────┘ |

+---------------------------------------------------------------------------+
|  ALL ACTIVITY LOG (Grouped by action)                 grid-column: 1 / -1 |
| ┌─────────────────────────────────────────────────────────────────────────┐ |
| │ [ Solved | Revisions | Goals | Group ]                                   │ |
| │                                                                         │ |
| │ (Active tab – e.g. Solved)                                              │ |
| │  · Combinations (Medium) – solved at 10:30 AM                           │ |
| │  · Binary Tree Inorder (Easy) – solved at 9:15 AM                       │ |
| │  · ... (additional items from current page)                             │ |
| │                                                                         │ |
| │ [ ◀ Prev   Page 1 of 16   Next ▶ ]                                      │ |
| └─────────────────────────────────────────────────────────────────────────┘ |
+---------------------------------------------------------------------------+


/* -------------------- TABLET (768px) -------------------------- */

+---------------------------------------------------------------------------+
|  HERO ACTIVITY SUMMARY (Today)                        grid-column: 1 / -1 |
| ┌─────────────────────────────────────────────────────────────────────────┐ |
| │ Tuesday, May 5, 2026                                [ View All → ]      │ |
| │ 2 Problems · 1 Revision · 45 min · Goal 67% ██████████████░░ (2/3) ✓   │ |
| └─────────────────────────────────────────────────────────────────────────┘ |
+---------------------------------------------------------------------------+
|  DAILY TREND CHART                    |  DAY’S QUESTIONS & REVISIONS       |
|  grid-column: 1 / 5                   |  grid-column: 5 / -1               |
| ┌─────────────────────────────────────┐ ┌────────────────────────────────┐ |
| │ (compact line chart)                │ │ Solved: Combinations (M)        │ |
| │                                     │ │ Revisions: Binary Search (E)    │ |
| │                                     │ │ [ View All → ]                  │ |
| └─────────────────────────────────────┘ └────────────────────────────────┘ |
+---------------------------------------------------------------------------+
|  MONTHLY TREND CHART                  |  SOCIAL FEED                       |
|  grid-column: 1 / 5                   |  grid-column: 5 / -1               |
| ┌─────────────────────────────────────┐ ┌────────────────────────────────┐ |
| │ (compact bar chart)                 │ │ John Doe (johndoe)              │ |
| │                                     │ │ ╰─ Combinations (M) 15m        │ |
| │                                     │ │    LeetCode · 10:30 AM         │ |
| │                                     │ │ ╰─ Binary Tree Inorder (E)     │ |
| │                                     │ │    LeetCode · 9:15 AM          │ |
| │                                     │ │                                │ |
| │                                     │ │ Anupam Debnath (anupam)         │ |
| │                                     │ │ ╰─ LRU Cache (M) 69m           │ |
| │                                     │ │    LeetCode · 1:50 PM          │ |
| └─────────────────────────────────────┘ └────────────────────────────────┘ |
+---------------------------------------------------------------------------+
|  ALL ACTIVITY LOG                                     grid-column: 1 / -1 |
| ┌─────────────────────────────────────────────────────────────────────────┐ |
| │ [ Solved | Revisions | Goals | Group ]                                   │ |
| │ · Combinations (Medium) – 10:30 AM                                      │ |
| │ · Binary Tree Inorder (Easy) – 9:15 AM                                  │ |
| │ [ ◀ Prev   Page 1 of 16   Next ▶ ]                                      │ |
| └─────────────────────────────────────────────────────────────────────────┘ |
+---------------------------------------------------------------------------+


/* -------------------- MOBILE (480px) -------------------------- */

+---------------------------------------------------------------------------+
|  HERO ACTIVITY SUMMARY                                                     |
| ┌─────────────────────────────────────────────────────────────────────────┐ |
| │ May 5, 2026                                          [ View All → ]     │ |
| │ 2 Problems · 1 Revision · 45 min · Goal 67% ██████████████░░ (2/3) ✓   │ |
| └─────────────────────────────────────────────────────────────────────────┘ |
+---------------------------------------------------------------------------+
|  DAILY TREND CHART                                                          |
| ┌─────────────────────────────────────────────────────────────────────────┐ |
| │ (responsive line chart, compact height)                                  │ |
| └─────────────────────────────────────────────────────────────────────────┘ |
+---------------------------------------------------------------------------+
|  DAY’S QUESTIONS & REVISIONS                                                |
| ┌─────────────────────────────────────────────────────────────────────────┐ |
| │ Solved: Combinations (Medium) 15m                                        │ |
| │ Revisions: Binary Search (Easy)                                          │ |
| │ [ View All → ]                                                          │ |
| └─────────────────────────────────────────────────────────────────────────┘ |
+---------------------------------------------------------------------------+
|  MONTHLY TREND CHART                                                        |
| ┌─────────────────────────────────────────────────────────────────────────┐ |
| │ (compact bar chart)                                                      │ |
| └─────────────────────────────────────────────────────────────────────────┘ |
+---------------------------------------------------------------------------+
|  SOCIAL FEED                                                                |
| ┌─────────────────────────────────────────────────────────────────────────┐ |
| │ John Doe (johndoe)                                                       │ |
| │ ╰─ Combinations (M) 15m – LeetCode · 10:30 AM                           │ |
| │ ╰─ Binary Tree Inorder (E) – LeetCode · 9:15 AM                         │ |
| │                                                                          │ |
| │ Anupam Debnath (anupam)                                                  │ |
| │ ╰─ LRU Cache (M) 69m – LeetCode · 1:50 PM                               │ |
| └─────────────────────────────────────────────────────────────────────────┘ |
+---------------------------------------------------------------------------+
|  ALL ACTIVITY LOG                                                           |
| ┌─────────────────────────────────────────────────────────────────────────┐ |
| │ [ Solved | Revisions | Goals | Group ]                                  │ |
| │ · Combinations (Medium) – 10:30 AM                                      │ |
| │ · Binary Tree Inorder (Easy) – 9:15 AM                                  │ |
| │ [ ◀ Prev   Page 1 of 16   Next ▶ ]                                      │ |
| └─────────────────────────────────────────────────────────────────────────┘ |
+---------------------------------------------------------------------------+



+-----------------------------------------------------------------------------+
|  REVISION TIMELINE – Vertical Connector Line with Inline Status             |
+-----------------------------------------------------------------------------+

  Legend:
  ● = revision dot
  █ = filled portion of vertical line (solid)
  │ = unfilled/dotted portion of vertical line

─────────────────────────────────────────────────────────────────────────────

  [ INITIAL STATE – No Hover ]

      
      ●  May 14, 2026  [Pending Today]
      │
      ●  May 17, 2026  [Upcoming]
      │
      ●  May 21, 2026  [Upcoming]
      │
      ●  May 28, 2026  [Upcoming]
      │
      ●  Jun 13, 2026  [Upcoming]

─────────────────────────────────────────────────────────────────────────────

  [ HOVER OVER May 17 (second dot) – Line fills to that dot ]

      
      ●  May 14, 2026  [Pending Today]
      █
      █
      ●  May 17, 2026  [Upcoming]   ← hovered
      │
      ●  May 21, 2026  [Upcoming]
      │
      ●  May 28, 2026  [Upcoming]
      │
      ●  Jun 13, 2026  [Upcoming]

─────────────────────────────────────────────────────────────────────────────

  [ HOVER OVER May 21 (third dot) – Line fills to that dot ]

      
      ●  May 14, 2026  [Pending Today]
      █
      █
      ●  May 17, 2026  [Upcoming]
      █
      █
      ●  May 21, 2026  [Upcoming]   ← hovered
      │
      ●  May 28, 2026  [Upcoming]
      │
      ●  Jun 13, 2026  [Upcoming]

─────────────────────────────────────────────────────────────────────────────

  [ HOVER OVER May 14 (first dot) – Line fills to top ]

      
      ●  May 14, 2026  [Pending Today]   ← hovered
      │
      ●  May 17, 2026  [Upcoming]
      │
      ●  May 21, 2026  [Upcoming]
      │
      ●  May 28, 2026  [Upcoming]
      │
      ●  Jun 13, 2026  [Upcoming]

─────────────────────────────────────────────────────────────────────────────

  [ MOBILE RESPONSIVE – Stacked layout ]

      
      ●  May 14, 2026
         [Pending Today]
      │
      ●  May 17, 2026
         [Upcoming]
      │
      ●  May 21, 2026
         [Upcoming]

─────────────────────────────────────────────────────────────────────────────

  NOTES:
  - Status text appears inline after the date (no tooltip).
  - Colors: Pending Today = orange, Upcoming = gray, Overdue = red, Completed = green.
  - On hover, the vertical line fills from the top down to the hovered dot (smooth transition).
  - The line itself is the only connector; no extra sidebars.
  - CSS transition on height of pseudo-element (0.3s ease).
  - On mouse leave, fill returns to 0 (or to the last completed revision's height).




+-----------------------------------------------------------------------+
|  REVISION TIMELINE – Vertical Line Behind Dots, Fill on Hover         |
+-----------------------------------------------------------------------+

  Legend:
  ● = revision dot (circle) – sits on top of line
  │ = vertical line (dotted/unfilled)
  █ = vertical line (solid/filled)
  ▶ = animation direction (line fills downward from top)

─────────────────────────────────────────────────────────────────────────

  [ DESKTOP LAYOUT – Default State (no hover) ]

      ●   May 14, 2026   Pending Today
      │
      ●   May 17, 2026   Upcoming
      │
      ●   May 21, 2026   Upcoming
      │
      ●   May 28, 2026   Upcoming
      │
      ●   Jun 13, 2026   Upcoming

  Vertical line (│) runs behind all dots, from top to bottom.
  Dots are centered on the line (left-aligned text).

─────────────────────────────────────────────────────────────────────────

  [ ON HOVER – Mouse over "May 17" (second dot) ]

      ●   May 14, 2026   Pending Today
      █  ◀───┐
      █      │
      ●   May 17, 2026   Upcoming  ← hovered
      │
      ●   May 21, 2026   Upcoming
      │
      ●   May 28, 2026   Upcoming
      │
      ●   Jun 13, 2026   Upcoming

  ▶ Animation: the vertical line fills (becomes solid █) from the top
     down to the hovered dot. The line below remains dotted (│).

─────────────────────────────────────────────────────────────────────────

  [ ANATOMY – Where the line and dot are placed ]

                Container (position: relative)
   ┌────────────────────────────────────────────┐
   │                                            │
   │    ● ← dot (z-index: 2)                    │
   │    │                                       │
   │    │ ← vertical line (position: absolute)  │
   │    │   left: 19px, top: 0, width: 2px      │
   │    │   background: dotted/unfilled         │
   │    │                                       │
   │    ● ← dot                                 │
   │    │                                       │
   │    ●                                       │
   │                                            │
   └────────────────────────────────────────────┘

  The vertical line is behind the dots (lower z-index).
  Dots are relatively positioned so they sit on top.

─────────────────────────────────────────────────────────────────────────

  [ MOBILE RESPONSIVE – Stacked layout ]

      ●   May 14, 2026
          Pending Today
      │
      ●   May 17, 2026
          Upcoming
      │
      ●   May 21, 2026
          Upcoming

  On mobile, the status wraps below the date.
  The vertical line remains centered behind the dots.

─────────────────────────────────────────────────────────────────────────

  [ ANIMATION START ]

  The animation starts when the user hovers over any revision item
  (either the dot or the text area). It does NOT require clicking.

  On hover:
    - Calculate the distance from top of container to bottom of that dot.
    - Set line height to that distance (smooth CSS transition).
  On mouse leave:
    - Reset line height to the height of the last completed revision (or 0).

  No horizontal bars – only vertical line and dots.

─────────────────────────────────────────────────────────────────────────

  [ SUMMARY ]

  • Vertical line: absolute, behind dots, runs full container height.
  • Dots: relatively positioned, overlap line.
  • Animation: line fills from top down to hovered dot (height transition).
  • No horizontal connectors, no extra sidebars.
  • Works on mobile with stacked text.




UI should be exact same nothing compromise here : 

```
/*
  ALL ACTIVITY LOG (Solved tab) – Vertical Timeline with Hover Animation
  ----------------------------------------------------------------
  For each question, a vertical timeline of solves is displayed.
  On hover over any dot, the vertical progress bar (left track)
  animates its filled height from 0 to the hovered dot’s position,
  and a tooltip reveals timestamp & duration + first‑solve indicator.
  The animation uses CSS transitions on the pseudo‑element height.
*/

+---------------------------------------------------------------------------+
|  ALL ACTIVITY LOG (Grouped by action)                 grid-column: 1 / -1 |
| ┌─────────────────────────────────────────────────────────────────────────┐ |
| │ [ Solved | Revisions | Goals | Group ]                                   │ |
| └─────────────────────────────────────────────────────────────────────────┘ |
|                                                                           |
| ┌─ Combinations                                              LeetCode (M) │
| │  #Backtracking                                                          │ |
| │                                                                          │ |
| │  Timeline (vertical, left‑aligned bar)                                   │ |
| │    █                                                                     │ |
| │    █  ●  Apr 27, 7:24 AM  ·  15m                                        │ |
| │    █  │                                                                  │ |
| │    █  ●  Apr 25, 9:45 PM  ·  22m                                        │ |
| │    █  │                                                                  │ |
| │    █  ●  Apr 25, 9:21 PM  ·  18m  ⭐ first                                │ |
| │    █                                                                     │ |
| │  ( left bar: █ filled to hovered height )                                │ |
| │  ( dots: circle, hover changes bar height )                              │ |
| │                                                                          │ |
| │  Hover behaviour example:                                                │ |
| │    [hover over ● Apr 25, 9:45 PM]                                        │ |
| │    → bar fills from top to that dot (smooth height transition 0.3s)      │ |
| │    → tooltip: “Apr 25, 9:45 PM · 22 min”                                 │ |
| └─────────────────────────────────────────────────────────────────────────┘ |
|                                                                           |
| ┌─ Binary Tree Inorder Traversal                            LeetCode (E)  │ |
| │  #Stack                                                                 │ |
| │    █                                                                     │ |
| │    █  ●  Apr 26, 7:51 AM  ·  8m                                         │ |
| │    █  │                                                                  │ |
| │    █  ●  Apr 25, 11:06 AM  ·  12m  ⭐ first                               │ |
| │    █                                                                     │ |
| └─────────────────────────────────────────────────────────────────────────┘ |
|                                                                           |
| [ ◀ Prev   Page 1 of 5   Next ▶ ]                                        |
+---------------------------------------------------------------------------+
```

```
/*
  ALL ACTIVITY LOG — Vertical Timeline Design for all tabs
  --------------------------------------------------------
  Shared structure: Each card has a left vertical track with dots (●).
  Hovering any dot smoothly fills the track from the top to that dot
  (CSS height transition on ::before pseudo‑element, 0.3s ease).
  A tooltip appears showing the event details.
  Colours: track bg var(--bg-elevated), fill var(--accent-moss).
  Overdue/on‑time revision dots distinguished by colour (accent‑moss vs toast‑warning).
*/

+---------------------------------------------------------------------------+
|  ALL ACTIVITY LOG (Grouped by action)                 grid-column: 1 / -1 |
| ┌─────────────────────────────────────────────────────────────────────────┐ |
| │ [ Solved | Revisions | Goals | Group ]                                   │ |
| └─────────────────────────────────────────────────────────────────────────┘ |

/* =============================  REVISIONS TAB  =========================== */
|                                                                           |
| ┌─ Two Sum BSTs                                             LeetCode (M)  │ |
| │  #Two Pointers #BST                                                      │ |
| │                                                                          │ |
| │  ░░░░                               (unfilled track)                     │ |
| │  ░░░░ ●  May 3, 9:02 AM  24m  ⚠ overdue · scheduled Mar 23              │ |
| │  ░░░░ │                                                                  │ |
| │  ░░░░ ●  (no more revisions for this question)                           │ |
| │  ░░░░                                                                   │ |
| │                                                                          │ |
| │  Hover over second dot: track fills to that dot,                          │ |
| │  tooltip: “May 3, 2026 · 24 min · Overdue · Confidence: —”              │ |
| └─────────────────────────────────────────────────────────────────────────┘ |
|                                                                           |
| ┌─ Two Sum                                                    LeetCode (E)│
| │  #Array #Hash Table                                                      │ |
| │  ░░░░                                                                   │ |
| │  ░░░░ ●  May 1, 3:27 PM  0m  ⚠ overdue · scheduled Jan 15               │ |
| │  ░░░░ │                                                                  │ |
| │  ░░░░ ●  May 1, 2:32 PM  0m  ⚠ overdue · scheduled Jan 17               │ |
| │  ░░░░                                                                   │ |
| │  (dots in warning colour, overdueCompleted = true)                        │ |
| └─────────────────────────────────────────────────────────────────────────┘ |
|                                                                           |
| [ ◀ Prev   Page 1 of 3   Next ▶ ]                                        |

/* =============================  GOALS TAB  ============================== */
|                                                                           |
| ┌─ Completed Goals                                                        │ |
| │                                                                          │ |
| │  ░░░░                                                                   │ |
| │  ░░░░ ●  Apr 25, 11:06 AM  "1 problem goal"                              │ |
| │  ░░░░ │   ██████████ 100%  (1/1) · Start: Apr 25 · End: Apr 25          │ |
| │  ░░░░                                                                   │ |
| │  Hover: tooltip shows full details + list of questions                   │ |
| └─────────────────────────────────────────────────────────────────────────┘ |
|                                                                           |
| ┌─ Failed Goals                                                            │ |
| │  ░░░░                                                                   │ |
| │  ░░░░ ○  Apr 29  (failed)  "3 problems daily"                             │ |
| │  ░░░░ │   ████░░░░░░ 0%  (0/3) · Start: Apr 29 · End: Apr 29            │ |
| │  ░░░░                                                                   │ |
| │  (hollow circle for failed, tooltip indicates failure)                    │ |
| └─────────────────────────────────────────────────────────────────────────┘ |
|                                                                           |
| [ ◀ Prev   Page 1 of 1   Next ▶ ]                                        |

/* =============================  GROUP TAB  ============================== */
|                                                                           |
| ┌─ StudyGroup (id: 698322c1...) – all events sorted by time               │ |
| │                                                                          │ |
| │  ░░░░                                                                   │ |
| │  ░░░░ ●  May 5, 2:49 PM  Goal progress +20% (now 40/50)                 │ |
| │  ░░░░ │                                                                  │ |
| │  ░░░░ ●  May 5, 10:12 AM  Goal progress +15% (now 60/100)               │ |
| │  ░░░░ │                                                                  │ |
| │  ░░░░ ●  May 4, 8:33 AM   Challenge progress +25% (now 75%)             │ |
| │  ░░░░ │                                                                  │ |
| │  ░░░░ ●  May 2, 7:20 PM   Challenge completed: “Weekly Coding Sprint”    │ |
| │  ░░░░                                                                   │ |
| │                                                                          │ |
| │  Each dot: icon distinguishes goal/challenge/completed.                    │ |
| │  Hover: tooltip with metadata (delta, newProgress, target).               │ |
| └─────────────────────────────────────────────────────────────────────────┘ |
|                                                                           |
| [ ◀ Prev   Page 1 of 2   Next ▶ ]                                        |
+---------------------------------------------------------------------------+
```


Questions
─────────────────────────────────────────────────────────────

● ╰─ Two Sum
│   Easy  •  LeetCode
│     #array
│     ◯ Solved  ◯ Revision  •  1/1 participants solved
│
●  ╰─ Valid Parentheses
│   Easy  •  LeetCode
│     #stack
│     ◯ Solved  ◯ Revision  •  0/3 participants solved
│
●  ╰─ Binary Search
│   Medium  •  LeetCode
│     #binary-search  #array
│     ✓ Solved  ✓ Revision  •  3/3 participants solved
│
●  ╰─ Koko Eating Bananas
    Medium  •  LeetCode
      #binary-search
      ✓ Solved  ◯ Revision  •  2/4 participants solved