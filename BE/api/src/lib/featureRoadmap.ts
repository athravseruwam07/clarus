export type FeatureLane =
  | "member-1-foundation-modeling"
  | "member-2-semantic-intelligence"
  | "member-3-optimization-experience";

export interface FeatureContract {
  feature: string;
  lane: FeatureLane;
  method: "GET" | "POST";
  path: string;
  backendWorkspace: string;
}

export const featureContracts: FeatureContract[] = [
  {
    feature: "auto_course_sync",
    lane: "member-1-foundation-modeling",
    method: "POST",
    path: "/v1/sync/full",
    backendWorkspace: "BE/api/src/routes/workstreams/member1.foundation.ts"
  },
  {
    feature: "unified_deadline_timeline_ai_ranked",
    lane: "member-1-foundation-modeling",
    method: "GET",
    path: "/v1/timeline/intelligence",
    backendWorkspace: "BE/api/src/routes/workstreams/member1.foundation.ts"
  },
  {
    feature: "deadline_change_detector_impact_intelligence",
    lane: "member-1-foundation-modeling",
    method: "GET",
    path: "/v1/changes/impact",
    backendWorkspace: "BE/api/src/routes/workstreams/member1.foundation.ts"
  },
  {
    feature: "workload_radar_forecast",
    lane: "member-1-foundation-modeling",
    method: "GET",
    path: "/v1/workload/forecast",
    backendWorkspace: "BE/api/src/routes/workstreams/member1.foundation.ts"
  },
  {
    feature: "academic_risk_prediction_engine",
    lane: "member-1-foundation-modeling",
    method: "GET",
    path: "/v1/risk/predict",
    backendWorkspace: "BE/api/src/routes/workstreams/member1.foundation.ts"
  },
  {
    feature: "ai_effort_estimation_engine",
    lane: "member-1-foundation-modeling",
    method: "POST",
    path: "/v1/effort/estimate",
    backendWorkspace: "BE/api/src/routes/workstreams/member1.foundation.ts"
  },
  {
    feature: "ai_assignment_breakdown",
    lane: "member-2-semantic-intelligence",
    method: "POST",
    path: "/v1/assignments/breakdown",
    backendWorkspace: "BE/api/src/routes/workstreams/member2.intelligence.ts"
  },
  {
    feature: "ai_content_locator",
    lane: "member-2-semantic-intelligence",
    method: "POST",
    path: "/v1/content-locator/resolve",
    backendWorkspace: "BE/api/src/routes/workstreams/member2.intelligence.ts"
  },
  {
    feature: "knowledge_gap_detection",
    lane: "member-2-semantic-intelligence",
    method: "GET",
    path: "/v1/knowledge-gaps/detect",
    backendWorkspace: "BE/api/src/routes/workstreams/member2.intelligence.ts"
  },
  {
    feature: "draft_rubric_scoring",
    lane: "member-2-semantic-intelligence",
    method: "POST",
    path: "/v1/rubric/score-draft",
    backendWorkspace: "BE/api/src/routes/workstreams/member2.intelligence.ts"
  },
  {
    feature: "smart_reminders_adaptive",
    lane: "member-3-optimization-experience",
    method: "GET",
    path: "/v1/reminders/adaptive",
    backendWorkspace: "BE/api/src/routes/workstreams/member3.optimization.ts"
  },
  {
    feature: "submission_grade_tracker",
    lane: "member-3-optimization-experience",
    method: "GET",
    path: "/v1/performance/tracker",
    backendWorkspace: "BE/api/src/routes/workstreams/member3.optimization.ts"
  },
  {
    feature: "adaptive_study_plan_optimizer",
    lane: "member-3-optimization-experience",
    method: "POST",
    path: "/v1/study-plan/optimize",
    backendWorkspace: "BE/api/src/routes/workstreams/member3.optimization.ts"
  },
  {
    feature: "autonomous_prioritization_engine",
    lane: "member-3-optimization-experience",
    method: "GET",
    path: "/v1/prioritization/top-task",
    backendWorkspace: "BE/api/src/routes/workstreams/member3.optimization.ts"
  },
  {
    feature: "conversational_copilot_mode",
    lane: "member-3-optimization-experience",
    method: "POST",
    path: "/v1/copilot/respond",
    backendWorkspace: "BE/api/src/routes/workstreams/member3.optimization.ts"
  }
];
