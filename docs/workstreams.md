# Clarus Parallel Workstreams (Merged Plan)

This structure merges the earlier roadmap and the latest optimization-heavy vision into one executable split for 3 members.

## Demo Narrative (show this in order)

1. `Dashboard` (`/dashboard`)
2. `Open Assignment Intelligence` (`/dashboard/assignments/asg-thermo-2`)
3. `Start Optimized Study Session` (button on assignment page)
4. `Insights View` (`/dashboard/insights`)
5. `Copilot Q&A` (`/dashboard/copilot-mode`)

## Member 1: LMS Foundation + Predictive Modeling

Overall responsibility:
- Build trustworthy LMS ingestion and forecasting primitives used by all higher-level AI features.

Frontend workspace root:
- `FE/app/dashboard/(member-1-foundation-modeling)/`

Backend workspace file:
- `BE/api/src/routes/workstreams/member1.foundation.ts`

Features:
- Auto Course Sync
- Unified Deadline Timeline (AI-ranked)
- Deadline Change Detector + Impact Intelligence
- Workload Radar + Forecast
- Academic Risk Prediction Engine
- AI Effort Estimation Engine

## Member 2: Semantic Intelligence + Knowledge Mapping

Overall responsibility:
- Convert unstructured course/assignment text into grounded, explainable intelligence.

Frontend workspace root:
- `FE/app/dashboard/(member-2-semantic-intelligence)/`

Backend workspace file:
- `BE/api/src/routes/workstreams/member2.intelligence.ts`

Features:
- AI Assignment Breakdown (includes hidden requirement extraction)
- AI Content Locator (with relevance reasons + confidence)
- Knowledge Gap Detection
- Draft Rubric Scoring

## Member 3: Optimization + Copilot Experience

Overall responsibility:
- Turn predictions into adaptive execution plans and actionable student decisions.

Frontend workspace root:
- `FE/app/dashboard/(member-3-optimization-experience)/`

Backend workspace file:
- `BE/api/src/routes/workstreams/member3.optimization.ts`

Features:
- Smart Reminders (adaptive)
- Submission & Grade Tracker (with risk-to-grade framing)
- Adaptive Study Plan Optimizer
- Autonomous Prioritization Engine
- Conversational Copilot Mode

## Shared Contracts and Integration

Feature contract source of truth:
- `BE/api/src/lib/featureRoadmap.ts`
- `FE/lib/feature-roadmap.ts`

Roadmap endpoint:
- `GET /v1/roadmap/features`

Placeholder response envelope:
- `BE/api/src/lib/placeholder.ts`

Demo API endpoints used by the end-to-end flow:
- `GET /v1/demo/dashboard`
- `GET /v1/demo/assignments/:assignmentId`
- `POST /v1/demo/sessions/start`
- `GET /v1/demo/insights`
- `POST /v1/demo/copilot`

## Collaboration Rules

- Each member should spend most time in their lane-specific frontend directory and one backend workstream file.
- Keep shared files (`FE/app/dashboard/page.tsx`, `FE/components/layout/Sidebar.tsx`, `BE/api/src/server.ts`) coordinated via short PRs.
- Keep AI outputs explainable: include reasons, confidence, and drivers in every contract.
