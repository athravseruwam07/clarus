export type FeatureLane =
  | "member-1-foundation-modeling"
  | "member-2-semantic-intelligence"
  | "member-3-optimization-experience";

export interface FeatureRoadmapItem {
  slug: string;
  title: string;
  route: string;
  summary: string;
  lane: FeatureLane;
  status: "foundation-ready" | "scaffolded";
  backendContracts: string[];
  frontendWorkspace: string;
  backendWorkspace: string;
  ownership: string;
  starterChecklist: string[];
}

export const laneLabels: Record<FeatureLane, string> = {
  "member-1-foundation-modeling": "Member 1: LMS Foundation + Predictive Modeling",
  "member-2-semantic-intelligence": "Member 2: Semantic Intelligence + Knowledge Mapping",
  "member-3-optimization-experience": "Member 3: Optimization + Copilot Experience"
};

export const featureRoadmap: FeatureRoadmapItem[] = [
  {
    slug: "sync-center",
    title: "1) Auto Course Sync",
    route: "/dashboard/sync-center",
    summary:
      "Sync courses, modules, assessments, announcements, discussions, files, and grade items from D2L.",
    lane: "member-1-foundation-modeling",
    status: "foundation-ready",
    backendContracts: ["POST /v1/sync/full", "GET /v1/sync/status"],
    frontendWorkspace: "FE/app/dashboard/(member-1-foundation-modeling)/sync-center/page.tsx",
    backendWorkspace: "BE/api/src/routes/workstreams/member1.foundation.ts",
    ownership: "Data ingestion, normalization, and sync reliability",
    starterChecklist: [
      "Expand sync coverage beyond courses to all LMS item types listed in the plan.",
      "Add sync status telemetry (duration, counts, failures).",
      "Persist source metadata needed by risk/effort/prioritization engines."
    ]
  },
  {
    slug: "timeline-intelligence",
    title: "2) Unified Deadline Timeline (AI-Ranked)",
    route: "/dashboard/timeline-intelligence",
    summary:
      "Rank assignments/quizzes/discussions by priority score, risk score, effort estimate, and recommended start date.",
    lane: "member-1-foundation-modeling",
    status: "scaffolded",
    backendContracts: ["GET /v1/timeline/intelligence"],
    frontendWorkspace:
      "FE/app/dashboard/(member-1-foundation-modeling)/timeline-intelligence/page.tsx",
    backendWorkspace: "BE/api/src/routes/workstreams/member1.foundation.ts",
    ownership: "Unified task feed + ranking pipeline",
    starterChecklist: [
      "Define timeline item schema with rank components and explanations.",
      "Support filtering by course, due range, and assessment type.",
      "Expose rank drivers to keep scoring transparent for users."
    ]
  },
  {
    slug: "change-impact",
    title: "7) Deadline Change Detector + Impact Intelligence",
    route: "/dashboard/change-impact",
    summary:
      "Detect due date/rubric/instruction changes, compute impact severity, and show before/after diff + plan adjustments.",
    lane: "member-1-foundation-modeling",
    status: "scaffolded",
    backendContracts: ["GET /v1/changes/impact"],
    frontendWorkspace: "FE/app/dashboard/(member-1-foundation-modeling)/change-impact/page.tsx",
    backendWorkspace: "BE/api/src/routes/workstreams/member1.foundation.ts",
    ownership: "Versioned LMS snapshot diffs + impact scoring",
    starterChecklist: [
      "Store item snapshots for temporal comparison.",
      "Implement structured diff output (added/removed/modified constraints).",
      "Recompute downstream effort/risk when critical deltas appear."
    ]
  },
  {
    slug: "workload-forecast",
    title: "8) Workload Radar + Forecast",
    route: "/dashboard/workload-forecast",
    summary:
      "Forecast heavy weeks using task mix, rubric density, deliverables, and estimated hours.",
    lane: "member-1-foundation-modeling",
    status: "scaffolded",
    backendContracts: ["GET /v1/workload/forecast"],
    frontendWorkspace: "FE/app/dashboard/(member-1-foundation-modeling)/workload-forecast/page.tsx",
    backendWorkspace: "BE/api/src/routes/workstreams/member1.foundation.ts",
    ownership: "Workload feature engineering + weekly forecast",
    starterChecklist: [
      "Define workload feature vector and week-level aggregation.",
      "Set heavy-week thresholds and confidence metadata.",
      "Return suggested workload redistribution actions."
    ]
  },
  {
    slug: "risk-prediction",
    title: "9) Academic Risk Prediction Engine",
    route: "/dashboard/risk-prediction",
    summary:
      "Predict deadline-miss and underperformance probabilities with explainable drivers and mitigation suggestions.",
    lane: "member-1-foundation-modeling",
    status: "scaffolded",
    backendContracts: ["GET /v1/risk/predict"],
    frontendWorkspace: "FE/app/dashboard/(member-1-foundation-modeling)/risk-prediction/page.tsx",
    backendWorkspace: "BE/api/src/routes/workstreams/member1.foundation.ts",
    ownership: "Risk feature modeling + explainability",
    starterChecklist: [
      "Define risk score schema and calibration strategy.",
      "Surface top model drivers in user-facing language.",
      "Attach mitigation actions that route into planning and copilot flows."
    ]
  },
  {
    slug: "effort-estimation",
    title: "10) AI Effort Estimation Engine",
    route: "/dashboard/effort-estimation",
    summary:
      "Estimate task effort, buffer time, and recommended start date using assignment structure and behavior-adjusted pace.",
    lane: "member-1-foundation-modeling",
    status: "scaffolded",
    backendContracts: ["POST /v1/effort/estimate"],
    frontendWorkspace: "FE/app/dashboard/(member-1-foundation-modeling)/effort-estimation/page.tsx",
    backendWorkspace: "BE/api/src/routes/workstreams/member1.foundation.ts",
    ownership: "Effort model and adaptation loop inputs",
    starterChecklist: [
      "Design effort inputs (rubric length, deliverables, word/page constraints).",
      "Return base estimate + confidence + buffer recommendation.",
      "Record actual completion time for future model correction."
    ]
  },
  {
    slug: "assignment-breakdown",
    title: "3) AI Assignment Breakdown",
    route: "/dashboard/assignment-breakdown",
    summary:
      "Extract constraints, rubric criteria, hidden requirements, complexity, effort, risk, and execution checklist.",
    lane: "member-2-semantic-intelligence",
    status: "scaffolded",
    backendContracts: ["POST /v1/assignments/breakdown"],
    frontendWorkspace:
      "FE/app/dashboard/(member-2-semantic-intelligence)/assignment-breakdown/page.tsx",
    backendWorkspace: "BE/api/src/routes/workstreams/member2.intelligence.ts",
    ownership: "Instruction parsing and structured requirement extraction",
    starterChecklist: [
      "Define output schema for checklist tasks + evidence text spans.",
      "Extract hidden constraints and map them to actionable checks.",
      "Attach complexity and risk rationale fields for transparency."
    ]
  },
  {
    slug: "content-locator",
    title: "4) AI Content Locator",
    route: "/dashboard/content-locator",
    summary:
      "Map each requirement to exact modules, lectures, slides/sections, files, and related resources with relevance explanation.",
    lane: "member-2-semantic-intelligence",
    status: "scaffolded",
    backendContracts: ["POST /v1/content-locator/resolve"],
    frontendWorkspace: "FE/app/dashboard/(member-2-semantic-intelligence)/content-locator/page.tsx",
    backendWorkspace: "BE/api/src/routes/workstreams/member2.intelligence.ts",
    ownership: "Semantic retrieval + ranking + explanation",
    starterChecklist: [
      "Define content node schema for modules, lectures, files, and discussions.",
      "Implement relevance ranking with short reasoning text.",
      "Return top-k sources with coordinate info (module, section, page range)."
    ]
  },
  {
    slug: "knowledge-gaps",
    title: "12) Knowledge Gap Detection",
    route: "/dashboard/knowledge-gaps",
    summary:
      "Infer concept weaknesses from rubric feedback, quiz patterns, and missed topics, then map them to review materials.",
    lane: "member-2-semantic-intelligence",
    status: "scaffolded",
    backendContracts: ["GET /v1/knowledge-gaps/detect"],
    frontendWorkspace: "FE/app/dashboard/(member-2-semantic-intelligence)/knowledge-gaps/page.tsx",
    backendWorkspace: "BE/api/src/routes/workstreams/member2.intelligence.ts",
    ownership: "Concept graph + weak-signal inference",
    starterChecklist: [
      "Define concept nodes and prerequisite relationships.",
      "Generate per-concept confidence and severity scores.",
      "Attach direct remediation links from content locator outputs."
    ]
  },
  {
    slug: "rubric-scoring",
    title: "15) Draft Rubric Scoring",
    route: "/dashboard/rubric-scoring",
    summary:
      "Score student drafts against rubric criteria, flag missing components, and propose targeted improvements.",
    lane: "member-2-semantic-intelligence",
    status: "scaffolded",
    backendContracts: ["POST /v1/rubric/score-draft"],
    frontendWorkspace: "FE/app/dashboard/(member-2-semantic-intelligence)/rubric-scoring/page.tsx",
    backendWorkspace: "BE/api/src/routes/workstreams/member2.intelligence.ts",
    ownership: "Rubric-aligned feedback generation",
    starterChecklist: [
      "Define rubric criterion scoring rubric for model output.",
      "Return missing evidence + suggested revision actions.",
      "Expose confidence and citation of matched rubric lines."
    ]
  },
  {
    slug: "smart-reminders",
    title: "5) Smart Reminders (Adaptive)",
    route: "/dashboard/smart-reminders",
    summary:
      "Adaptive reminders that shift timing and escalation based on behavior, workload spikes, and completion patterns.",
    lane: "member-3-optimization-experience",
    status: "scaffolded",
    backendContracts: ["GET /v1/reminders/adaptive", "POST /v1/reminders/action"],
    frontendWorkspace:
      "FE/app/dashboard/(member-3-optimization-experience)/smart-reminders/page.tsx",
    backendWorkspace: "BE/api/src/routes/workstreams/member3.optimization.ts",
    ownership: "Reminder policy + behavior-driven adaptation",
    starterChecklist: [
      "Implement escalation timeline and adaptive rescheduling policy.",
      "Track snooze/start-now/mark-done behavior events.",
      "Expose reason codes for why each reminder fired when it did."
    ]
  },
  {
    slug: "submission-grade-tracker",
    title: "6) Submission & Grade Tracker",
    route: "/dashboard/submission-grade-tracker",
    summary:
      "Track submitted/graded/missing/pending status, current grade snapshot, what-if outcomes, and risk-to-grade forecast.",
    lane: "member-3-optimization-experience",
    status: "scaffolded",
    backendContracts: ["GET /v1/performance/tracker"],
    frontendWorkspace:
      "FE/app/dashboard/(member-3-optimization-experience)/submission-grade-tracker/page.tsx",
    backendWorkspace: "BE/api/src/routes/workstreams/member3.optimization.ts",
    ownership: "Performance tracking + grade projection UX",
    starterChecklist: [
      "Normalize submission state across assignment/quiz/discussion types.",
      "Bundle what-if grade estimator into same response contract.",
      "Add risk-to-grade trajectory with short explanation."
    ]
  },
  {
    slug: "study-plan-optimizer",
    title: "11) Adaptive Study Plan Optimizer",
    route: "/dashboard/study-plan-optimizer",
    summary:
      "Generate and continuously adapt study blocks, daily tasks, and spaced repetition sessions based on real behavior.",
    lane: "member-3-optimization-experience",
    status: "scaffolded",
    backendContracts: ["POST /v1/study-plan/optimize"],
    frontendWorkspace:
      "FE/app/dashboard/(member-3-optimization-experience)/study-plan-optimizer/page.tsx",
    backendWorkspace: "BE/api/src/routes/workstreams/member3.optimization.ts",
    ownership: "Adaptive scheduler + plan re-optimization",
    starterChecklist: [
      "Define schedule inputs (availability, pace, priorities).",
      "Recompute plan when sessions are skipped or workload changes.",
      "Return human-readable explanation for each plan adjustment."
    ]
  },
  {
    slug: "prioritization-engine",
    title: "13) Autonomous Prioritization Engine",
    route: "/dashboard/prioritization-engine",
    summary:
      "Compute highest-leverage next task from deadline proximity, risk, grade weight, complexity, effort, and knowledge-gap impact.",
    lane: "member-3-optimization-experience",
    status: "scaffolded",
    backendContracts: ["GET /v1/prioritization/top-task"],
    frontendWorkspace:
      "FE/app/dashboard/(member-3-optimization-experience)/prioritization-engine/page.tsx",
    backendWorkspace: "BE/api/src/routes/workstreams/member3.optimization.ts",
    ownership: "Priority scoring and explainable ranking",
    starterChecklist: [
      "Implement weighted priority formula with configurable factors.",
      "Return top task + counterfactual delay impact.",
      "Expose score breakdown for transparency."
    ]
  },
  {
    slug: "copilot-mode",
    title: "14) Conversational Copilot Mode",
    route: "/dashboard/copilot-mode",
    summary:
      "Answer planning questions using prioritization, risk, effort, and content locator outputs with actionable plans.",
    lane: "member-3-optimization-experience",
    status: "scaffolded",
    backendContracts: ["POST /v1/copilot/respond"],
    frontendWorkspace: "FE/app/dashboard/(member-3-optimization-experience)/copilot-mode/page.tsx",
    backendWorkspace: "BE/api/src/routes/workstreams/member3.optimization.ts",
    ownership: "Copilot orchestration and response grounding",
    starterChecklist: [
      "Define chat request/response schema with citations to source engines.",
      "Support intents: weekend plan, 2-hour plan, quiz prep.",
      "Return plan steps + direct links to recommended resources."
    ]
  }
];

export function getFeatureBySlug(slug: string): FeatureRoadmapItem {
  const feature = featureRoadmap.find((item) => item.slug === slug);
  if (!feature) {
    throw new Error(`unknown feature slug: ${slug}`);
  }

  return feature;
}

export function getRoadmapByLane(): Array<{ lane: FeatureLane; label: string; features: FeatureRoadmapItem[] }> {
  return (Object.keys(laneLabels) as FeatureLane[]).map((lane) => ({
    lane,
    label: laneLabels[lane],
    features: featureRoadmap.filter((feature) => feature.lane === lane)
  }));
}
