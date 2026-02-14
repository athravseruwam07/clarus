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
    slug: "timeline-intelligence",
    title: "Calendar",
    route: "/dashboard/timeline-intelligence",
    summary:
      "Unified calendar view of deadlines across assignments, quizzes, and exams, with clear AI ranking.",
    lane: "member-1-foundation-modeling",
    status: "scaffolded",
    backendContracts: ["GET /v1/timeline/intelligence"],
    frontendWorkspace:
      "FE/app/dashboard/(member-1-foundation-modeling)/timeline-intelligence/page.tsx",
    backendWorkspace: "BE/api/src/routes/workstreams/member1.foundation.ts",
    ownership: "Unified calendar feed + ranking pipeline",
    starterChecklist: [
      "Define calendar item schema with rank components and explanations.",
      "Support filtering by course, due range, and assessment type.",
      "Expose rank drivers to keep scoring transparent for users."
    ]
  },
  {
    slug: "workload-forecast",
    title: "Workload Forecast",
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
    slug: "upcoming",
    title: "Upcoming",
    route: "/dashboard/upcoming/assignments",
    summary:
      "Upcoming view with quick navigation between assignments, quizzes, and exams.",
    lane: "member-2-semantic-intelligence",
    status: "scaffolded",
    backendContracts: [],
    frontendWorkspace: "FE/app/dashboard/upcoming/*/page.tsx",
    backendWorkspace: "TBD",
    ownership: "Upcoming feed UX + filters",
    starterChecklist: [
      "Define unified upcoming item schema (type, due date, course, priority).",
      "Support filters for assignments/quizzes/exams and due range.",
      "Add lightweight priority cues that don't overwhelm the dashboard."
    ]
  },
  {
    slug: "content-locator",
    title: "Content Locator",
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
    slug: "study-plan-optimizer",
    title: "Study Plan Optimizer",
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
    title: "Prioritization Engine",
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
    title: "Copilot Mode",
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
