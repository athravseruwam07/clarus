# Clarus Feature Matrix

| # | Feature | Owner Lane | Frontend Route | Backend Contract |
|---|---|---|---|---|
| 1 | Auto Course Sync | Member 1 | `/dashboard/sync-center` | `POST /v1/sync/full` |
| 2 | Unified Deadline Timeline (AI-ranked) | Member 1 | `/dashboard/timeline-intelligence` | `GET /v1/timeline/intelligence` |
| 3 | AI Assignment Breakdown | Member 2 | `/dashboard/assignment-breakdown` | `POST /v1/assignments/breakdown` |
| 4 | AI Content Locator | Member 2 | `/dashboard/content-locator` | `POST /v1/content-locator/resolve` |
| 5 | Smart Reminders (Adaptive) | Member 3 | `/dashboard/smart-reminders` | `GET /v1/reminders/adaptive` |
| 6 | Submission & Grade Tracker | Member 3 | `/dashboard/submission-grade-tracker` | `GET /v1/performance/tracker` |
| 7 | Change Detector + Impact Intelligence | Member 1 | `/dashboard/change-impact` | `GET /v1/changes/impact` |
| 8 | Workload Radar + Forecast | Member 1 | `/dashboard/workload-forecast` | `GET /v1/workload/forecast` |
| 9 | Academic Risk Prediction Engine | Member 1 | `/dashboard/risk-prediction` | `GET /v1/risk/predict` |
| 10 | AI Effort Estimation Engine | Member 1 | `/dashboard/effort-estimation` | `POST /v1/effort/estimate` |
| 11 | Adaptive Study Plan Optimizer | Member 3 | `/dashboard/study-plan-optimizer` | `POST /v1/study-plan/optimize` |
| 12 | Knowledge Gap Detection | Member 2 | `/dashboard/knowledge-gaps` | `GET /v1/knowledge-gaps/detect` |
| 13 | Autonomous Prioritization Engine | Member 3 | `/dashboard/prioritization-engine` | `GET /v1/prioritization/top-task` |
| 14 | Conversational Copilot Mode | Member 3 | `/dashboard/copilot-mode` | `POST /v1/copilot/respond` |
| 15 | Draft Rubric Scoring | Member 2 | `/dashboard/rubric-scoring` | `POST /v1/rubric/score-draft` |

## Demo Flow Contracts

- `GET /v1/demo/dashboard`
- `GET /v1/demo/assignments/:assignmentId`
- `POST /v1/demo/sessions/start`
- `GET /v1/demo/insights`
- `POST /v1/demo/copilot`
