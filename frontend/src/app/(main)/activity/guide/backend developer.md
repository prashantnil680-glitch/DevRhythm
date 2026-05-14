## Activity Dashboard – Required Frontend APIs

This document lists all backend endpoints that the frontend will consume for the dedicated **Activity Dashboard** page. Each endpoint includes its method, parameters, description, and a complete sample response (no placeholders). All responses follow the standard `{ success, statusCode, message, data, meta, error }` format.

---

### 1. Daily Trend (30‑day line chart)

**Endpoint:** `GET /api/v1/trends/daily`  
**Query parameters:** `days` (optional, default 30, max 90)  
**Description:** Returns daily aggregated counts for problems solved, revisions completed, study time (minutes), and goal completion percentage for the last N days.

**Sample request:**  
`GET /api/v1/trends/daily?days=30`

**Sample response:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Daily trends retrieved successfully",
  "data": {
    "labels": [
      "2026-04-06", "2026-04-07", "2026-04-08", "2026-04-09", "2026-04-10",
      "2026-04-11", "2026-04-12", "2026-04-13", "2026-04-14", "2026-04-15",
      "2026-04-16", "2026-04-17", "2026-04-18", "2026-04-19", "2026-04-20",
      "2026-04-21", "2026-04-22", "2026-04-23", "2026-04-24", "2026-04-25",
      "2026-04-26", "2026-04-27", "2026-04-28", "2026-04-29", "2026-04-30",
      "2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05"
    ],
    "problemsSolved": [2, 1, 0, 3, 1, 0, 0, 2, 1, 1, 2, 0, 1, 0, 2, 3, 0, 1, 2, 0, 1, 1, 0, 2, 1, 0, 2, 1, 0, 1],
    "revisionsCompleted": [1, 2, 1, 0, 1, 2, 0, 1, 2, 1, 0, 1, 2, 0, 1, 2, 1, 0, 1, 2, 0, 1, 2, 1, 0, 1, 2, 1, 0, 2],
    "studyTimeMinutes": [45, 30, 15, 60, 30, 20, 0, 45, 30, 30, 45, 15, 30, 0, 45, 60, 15, 30, 45, 20, 30, 30, 15, 45, 30, 15, 50, 30, 10, 40],
    "goalCompletionRate": [100, 50, 0, 100, 33, 0, 0, 100, 50, 50, 100, 0, 33, 0, 100, 100, 0, 33, 100, 0, 50, 33, 0, 100, 50, 0, 100, 50, 0, 50]
  },
  "meta": {
    "period": "30 days",
    "timezone": "Asia/Kolkata",
    "timestamp": "2026-05-05T14:22:10.123Z"
  },
  "error": null
}
```

---

### 2. Monthly Trend (12‑month line/bar chart)

**Endpoint:** `GET /api/v1/trends/monthly`  
**Query parameters:** `months` (default 12, max 60), `includeComparison` (default true)  
**Description:** Returns monthly aggregates (problems solved, goals completed, revision completion rate) and optional global average comparison.

**Sample request:**  
`GET /api/v1/trends/monthly?months=12&includeComparison=true`

**Sample response:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Monthly trends retrieved successfully",
  "data": {
    "labels": ["May 2025", "Jun 2025", "Jul 2025", "Aug 2025", "Sep 2025", "Oct 2025", "Nov 2025", "Dec 2025", "Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026"],
    "problemsSolved": [18, 22, 15, 20, 25, 30, 28, 35, 40, 38, 45, 50],
    "goalsCompleted": [6, 8, 5, 7, 9, 10, 9, 11, 12, 11, 13, 15],
    "revisionCompletionRate": [82, 78, 85, 80, 88, 90, 85, 92, 95, 93, 96, 98],
    "comparison": {
      "avgGoalsCompletedGlobal": [5.2, 5.8, 4.9, 6.1, 6.5, 6.9, 6.8, 7.2, 7.5, 7.3, 7.9, 8.2],
      "userAhead": [true, true, true, true, true, true, true, true, true, true, true, true]
    }
  },
  "meta": {
    "period": "12 months",
    "timezone": "Asia/Kolkata",
    "includeComparison": true,
    "timestamp": "2026-05-05T14:22:11.456Z"
  },
  "error": null
}
```

---

### 3. Today’s Detailed Activity

**Endpoint:** `GET /api/v1/activity/today`  
**Description:** Returns detailed breakdown of today’s activity, including solved questions list and completed revisions list.

**Sample response:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Today's activity retrieved successfully",
  "data": {
    "date": "2026-05-05",
    "dayOfWeek": "Tuesday",
    "problemsSolved": 2,
    "revisionsCompleted": 1,
    "studyTimeMinutes": 45,
    "goalAchieved": true,
    "goalTarget": 3,
    "goalCompletion": 67,
    "submissions": 3,
    "testCaseExecutions": 12,
    "passedCount": 10,
    "failedCount": 2,
    "activityBreakdown": {
      "easy": 1,
      "medium": 1,
      "hard": 0,
      "leetcode": 2,
      "hackerrank": 0,
      "codeforces": 0,
      "other": 0
    },
    "questionsSolved": [
      {
        "_id": "69ef0f2d317bfe7d27a6bfe7",
        "question": {
          "_id": "69d238886f2740a9810c8754",
          "title": "Combinations",
          "platform": "LeetCode",
          "platformQuestionId": "combinations",
          "difficulty": "Medium"
        },
        "solvedAt": "2026-05-05T10:30:00.000Z",
        "timeSpent": 15
      }
    ],
    "revisionsCompletedList": [
      {
        "_id": "6987a93461aab214f6ce4a50",
        "question": {
          "_id": "6987a93461aab214f6ce4a23",
          "title": "Binary Search",
          "platform": "LeetCode",
          "platformQuestionId": "binary-search",
          "difficulty": "Easy"
        },
        "completedAt": "2026-05-05T09:00:00.000Z",
        "timeSpent": 0,
        "confidenceAfter": null,
        "overdueCompleted": false,
        "outOfOrder": false
      }
    ]
  },
  "meta": {
    "timezone": "Asia/Kolkata",
    "timestamp": "2026-05-05T14:30:00.000Z"
  },
  "error": null
}
```

---

### 4. Activity for a Specific Date

**Endpoint:** `GET /api/v1/activity/day/:date`  
**Path parameter:** `date` – format `YYYY-MM-DD`  
**Description:** Same structure as “today”, but for a past (or future) date.

**Sample request:**  
`GET /api/v1/activity/day/2026-05-03`

**Sample response:** (only highlights shown – full structure identical to today)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Activity for 2026-05-03 retrieved successfully",
  "data": {
    "date": "2026-05-03",
    "dayOfWeek": "Sunday",
    "problemsSolved": 1,
    "revisionsCompleted": 2,
    "studyTimeMinutes": 30,
    "goalAchieved": false,
    "goalTarget": 3,
    "goalCompletion": 33,
    "submissions": 2,
    "testCaseExecutions": 8,
    "passedCount": 6,
    "failedCount": 2,
    "activityBreakdown": {
      "easy": 0,
      "medium": 1,
      "hard": 0,
      "leetcode": 1,
      "hackerrank": 0,
      "codeforces": 0,
      "other": 0
    },
    "questionsSolved": [
      {
        "_id": "69edc40e2dc3363e47770dd9",
        "question": {
          "_id": "69ca7a93dd9119c074abed20",
          "title": "Binary Tree Inorder Traversal",
          "platform": "LeetCode",
          "platformQuestionId": "binary-tree-inorder-traversal",
          "difficulty": "Easy"
        },
        "solvedAt": "2026-05-03T07:51:38.399Z",
        "timeSpent": 0
      }
    ],
    "revisionsCompletedList": [
      {
        "_id": "6987a93461aab214f6ce4a50",
        "question": {
          "_id": "6987a93461aab214f6ce4a23",
          "title": "Binary Search",
          "platform": "LeetCode",
          "platformQuestionId": "binary-search",
          "difficulty": "Easy"
        },
        "completedAt": "2026-05-03T09:30:41.262Z",
        "timeSpent": 0,
        "confidenceAfter": null,
        "overdueCompleted": true,
        "outOfOrder": false
      }
    ]
  },
  "meta": {
    "timezone": "Asia/Kolkata",
    "timestamp": "2026-05-05T14:31:25.890Z"
  },
  "error": null
}
```

---

### 5. Today’s Solved Questions from Followed Users (Grouped by User)

**Endpoint:** `GET /api/v1/activity/feed/today-grouped`  
**Query parameters:** `page` (default 1), `limit` (default 20, max 100)  
**Description:** Returns all `question_solved` logs from followed users that occurred today (in viewer’s timezone), grouped per user. Pagination works on the number of users (not logs).

**Sample request:**  
`GET /api/v1/activity/feed/today-grouped?page=1&limit=10`

**Sample response:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Today's solved questions from followed users retrieved",
  "data": {
    "users": {
      "697efe3dba24d7bc28d1f7aa": {
        "userInfo": {
          "_id": "697efe3dba24d7bc28d1f7aa",
          "username": "johndoe",
          "displayName": "John Doe",
          "avatarUrl": "https://example.com/avatars/johndoe.jpg"
        },
        "solvedToday": [
          {
            "_id": "69ef0f2d317bfe7d27a6bfe7",
            "question": {
              "_id": "69d238886f2740a9810c8754",
              "title": "Combinations",
              "platform": "LeetCode",
              "platformQuestionId": "combinations",
              "difficulty": "Medium"
            },
            "solvedAt": "2026-05-05T10:30:00.000Z",
            "timeSpent": 15
          },
          {
            "_id": "69edc40e2dc3363e47770dd9",
            "question": {
              "_id": "69ca7a93dd9119c074abed20",
              "title": "Binary Tree Inorder Traversal",
              "platform": "LeetCode",
              "platformQuestionId": "binary-tree-inorder-traversal",
              "difficulty": "Easy"
            },
            "solvedAt": "2026-05-05T09:15:00.000Z",
            "timeSpent": 7
          }
        ]
      },
      "69a12bda50af9918c7aef495": {
        "userInfo": {
          "_id": "69a12bda50af9918c7aef495",
          "username": "anupam",
          "displayName": "Anupam Debnath",
          "avatarUrl": "https://example.com/avatars/anupam.jpg"
        },
        "solvedToday": [
          {
            "_id": "69cd50030f62adee93833e42",
            "question": {
              "_id": "69cd50010f62adee93833e3c",
              "title": "LRU Cache",
              "platform": "LeetCode",
              "platformQuestionId": "lru-cache",
              "difficulty": "Medium"
            },
            "solvedAt": "2026-05-05T13:50:54.271Z",
            "timeSpent": 69
          }
        ]
      }
    }
  },
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 2,
      "pages": 1,
      "hasNext": false,
      "hasPrev": false
    },
    "timezone": "Asia/Kolkata",
    "timestamp": "2026-05-05T14:35:00.000Z"
  },
  "error": null
}
```

---

### 6. Aggregated Activity Logs (Grouped by Action)

**Endpoint:** `GET /api/v1/activity/`  
**Query parameters:** `action` (optional filter), `startDate`, `endDate`, `page`, `limit`, `sortBy`, `sortOrder`, plus `goalPage`, `goalLimit` (for goals pagination)  
**Description:** Returns all user’s activity logs grouped by action. Special handling for `revision_completed` (sub‑categories) and `goal_achieved` (completed/failed, with pagination). This endpoint is used for the “All Activity” view on the dashboard.

**Sample request (no filters):**  
`GET /api/v1/activity/?page=1&limit=5`

**Sample response (abbreviated for brevity, but shows key structures):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Activity logs retrieved successfully",
  "data": {
    "question_solved": [
      {
        "_id": "69ef0f2d317bfe7d27a6bfe7",
        "userId": "697efe3dba24d7bc28d1f7aa",
        "action": "question_solved",
        "targetId": {
          "_id": "69d238886f2740a9810c8754",
          "title": "Combinations",
          "platform": "LeetCode",
          "platformQuestionId": "combinations",
          "difficulty": "Medium"
        },
        "targetModel": "Question",
        "metadata": {
          "title": "Combinations",
          "difficulty": "Medium",
          "platform": "LeetCode",
          "pattern": ["Backtracking"],
          "timeSpent": 0,
          "isFirstSolve": false
        },
        "timestamp": "2026-05-05T10:30:00.000Z",
        "createdAt": "2026-05-05T10:30:05.123Z",
        "updatedAt": "2026-05-05T10:30:05.123Z",
        "__v": 0
      }
    ],
    "question_mastered": [],
    "revision_completed": {
      "on_time": [
        {
          "_id": "69b7acdae080cb4fef38df84",
          "userId": "697efe3dba24d7bc28d1f7aa",
          "targetId": {
            "_id": "69b7acdae080cb4fef38df84",
            "title": "Two Sum BSTs",
            "platform": "LeetCode",
            "platformQuestionId": "two-sum-bsts",
            "difficulty": "Medium"
          },
          "metadata": {
            "scheduledDate": "2026-05-03T07:30:00.000Z",
            "overdueCompleted": false,
            "timeSpent": 24
          },
          "timestamp": "2026-05-03T07:30:00.000Z"
        }
      ],
      "overdue": [
        {
          "_id": "69b983df055272aa4147887d",
          "userId": "697efe3dba24d7bc28d1f7aa",
          "targetId": {
            "_id": "69b7acdae080cb4fef38df84",
            "title": "Two Sum BSTs",
            "platform": "LeetCode",
            "platformQuestionId": "two-sum-bsts",
            "difficulty": "Medium"
          },
          "metadata": {
            "scheduledDate": "2026-03-23T07:30:00.000Z",
            "overdueCompleted": true,
            "timeSpent": 24
          },
          "timestamp": "2026-05-03T09:02:32.774Z"
        }
      ],
      "ratio": {
        "on_time": 0.05,
        "overdue": 0.95,
        "counts": { "on_time": 1, "overdue": 19, "total": 20 }
      },
      "message": "Most users complete revisions on time to stay consistent with their learning flow."
    },
    "goal_achieved": {
      "completed": [
        {
          "_id": "69ec9be316b76c95ad82f693",
          "goalType": "planned",
          "targetCount": 1,
          "completedCount": 1,
          "startDate": "2026-04-25T00:00:00.000Z",
          "endDate": "2026-04-25T23:59:59.999Z",
          "completionPercentage": 100,
          "status": "completed",
          "achievedAt": "2026-04-25T11:06:44.870Z",
          "completedQuestions": [
            {
              "questionId": "69ca7a93dd9119c074abed20",
              "completedAt": "2026-04-25T11:06:41.003Z",
              "platformQuestionId": "binary-tree-inorder-traversal"
            }
          ]
        }
      ],
      "failed": [
        {
          "_id": "69f1acdbbb89e55829045291",
          "goalType": "daily",
          "targetCount": 3,
          "completedCount": 0,
          "startDate": "2026-04-29T00:00:00.000Z",
          "endDate": "2026-04-29T23:59:59.999Z",
          "completionPercentage": 0,
          "status": "failed",
          "achievedAt": null,
          "completedQuestions": []
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 13,
        "pages": 1,
        "hasNext": false,
        "hasPrev": false
      }
    },
    "group_goal_progress": [
      {
        "_id": "69fa036fdf843192fbd920ad",
        "userId": "697efe3dba24d7bc28d1f7aa",
        "action": "group_goal_progress",
        "targetId": {
          "_id": "698322c199ad0a82381afc04"
        },
        "targetModel": "StudyGroup",
        "metadata": {
          "goalId": "6983258d66e3db6041b526eb",
          "delta": 20,
          "newProgress": 40,
          "target": 50
        },
        "timestamp": "2026-05-05T14:49:18.321Z",
        "createdAt": "2026-05-05T14:49:19.943Z",
        "updatedAt": "2026-05-05T14:49:19.943Z",
        "__v": 0
      }
    ],
    "group_goal_completed": [],
    "group_challenge_progress": [],
    "group_challenge_completed": []
  },
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 5,
      "total": 76,
      "pages": 16,
      "hasNext": true,
      "hasPrev": false
    },
    "timestamp": "2026-05-05T14:42:33.796Z"
  },
  "error": null
}
```

> **Note:** The `group_goal_progress`, `group_goal_completed`, etc. entries appear only when a group activity is performed (progress >50% or 100%). They are shown in the example to illustrate the structure.

---

### Summary Table for Frontend Developer

| Section / Component | API Endpoint | Primary Data Fields |
|---------------------|--------------|----------------------|
| 30‑day trend charts | `GET /trends/daily` | `labels`, `problemsSolved`, `revisionsCompleted`, `studyTimeMinutes`, `goalCompletionRate` |
| 12‑month trend charts | `GET /trends/monthly` | `labels`, `problemsSolved`, `goalsCompleted`, `revisionCompletionRate`, `comparison.avgGoalsCompletedGlobal` |
| Today’s activity card | `GET /activity/today` | `problemsSolved`, `revisionsCompleted`, `studyTimeMinutes`, `goalAchieved`, `goalCompletion`, `questionsSolved[]`, `revisionsCompletedList[]` |
| Date picker detail | `GET /activity/day/{date}` | same as today |
| Feed – today’s solves (followed users) | `GET /activity/feed/today-grouped` | `users[userId].userInfo`, `users[userId].solvedToday[]` |
| All activity log (grouped) | `GET /activity/` | `question_solved[]`, `revision_completed.on_time/overdue`, `goal_achieved.completed/failed`, plus group actions |

All endpoints support standard pagination where applicable (`page`, `limit`). The `meta` object in every response includes a `timestamp` for cache control.

---