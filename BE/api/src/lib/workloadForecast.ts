/* ------------------------------------------------------------------ */
/*  Workload Forecast — types + computation                           */
/* ------------------------------------------------------------------ */

export interface ForecastAssessment {
  id: string;
  title: string;
  courseName: string;
  courseCode: string;
  assessmentType: "assignment" | "quiz" | "midterm" | "lab" | "project" | "discussion";
  dueDate: string;
  estimatedHours: number;
  complexity: "low" | "medium" | "high";
  weight: number;
  sourceType: string;
  sourceId: string;
  orgUnitId: string;
  associatedEntityType: string | null;
  associatedEntityId: string | null;
  viewUrl: string | null;
}

export interface WeekFeatureVector {
  assessmentCount: number;
  totalEstimatedHours: number;
  complexityMix: { low: number; medium: number; high: number };
  deadlineClusterScore: "low" | "medium" | "high";
  overlapScore: "low" | "medium" | "high";
  typeDistribution: Record<string, number>;
}

export type WorkloadSeverity = "light" | "moderate" | "heavy" | "critical";

export interface RedistributionSuggestion {
  type: "start_earlier" | "split_prep";
  assessmentId: string;
  assessmentTitle: string;
  suggestion: string;
  hoursSaved: number;
  fromWeek: string;
  toWeek: string;
}

export interface WeekForecast {
  weekLabel: string;
  dateRange: string;
  workloadScore: number;
  severity: WorkloadSeverity;
  confidence: number;
  featureVector: WeekFeatureVector;
  assessments: ForecastAssessment[];
  topLoadDrivers: string[];
  suggestions: RedistributionSuggestion[];
}

export interface WorkloadForecastData {
  generatedAt: string;
  forecastWindowWeeks: number;
  courses: string[];
  weeks: WeekForecast[];
  overallSummary: string;
  heavyWeekCount: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Returns the Monday 00:00 of the current week. */
export function getCurrentMonday(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function groupByWeek(assessments: ForecastAssessment[]): ForecastAssessment[][] {
  const monday = getCurrentMonday();
  const weeks: ForecastAssessment[][] = [[], [], [], []];

  for (const a of assessments) {
    const due = new Date(a.dueDate);
    const diffDays = Math.floor((due.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24));
    const weekIndex = Math.floor(diffDays / 7);
    if (weekIndex >= 0 && weekIndex < 4) {
      weeks[weekIndex].push(a);
    }
  }

  return weeks;
}

function computeFeatureVector(assessments: ForecastAssessment[]): WeekFeatureVector {
  const totalHours = assessments.reduce((s, a) => s + a.estimatedHours, 0);

  const complexityMix = { low: 0, medium: 0, high: 0 };
  const typeDistribution: Record<string, number> = {};

  for (const a of assessments) {
    complexityMix[a.complexity]++;
    typeDistribution[a.assessmentType] = (typeDistribution[a.assessmentType] ?? 0) + 1;
  }

  let deadlineClusterScore: "low" | "medium" | "high" = "low";
  if (assessments.length > 1) {
    const dayOffsets = assessments.map((a) => new Date(a.dueDate).getDay());
    const mean = dayOffsets.reduce((s, d) => s + d, 0) / dayOffsets.length;
    const variance = dayOffsets.reduce((s, d) => s + (d - mean) ** 2, 0) / dayOffsets.length;
    const stdDev = Math.sqrt(variance);
    const numericScore = Math.max(0, 100 - stdDev * 30);
    deadlineClusterScore = numericScore >= 70 ? "high" : numericScore >= 40 ? "medium" : "low";
  }

  const distinctCourses = new Set(assessments.map((a) => a.courseCode)).size;
  const overlapNumeric = Math.min(100, distinctCourses * 25);
  const overlapScore: "low" | "medium" | "high" = overlapNumeric >= 70 ? "high" : overlapNumeric >= 40 ? "medium" : "low";

  return {
    assessmentCount: assessments.length,
    totalEstimatedHours: Math.round(totalHours * 10) / 10,
    complexityMix,
    deadlineClusterScore,
    overlapScore,
    typeDistribution,
  };
}

const LEVEL_WEIGHT: Record<string, number> = { low: 20, medium: 55, high: 85 };

function computeWorkloadScore(fv: WeekFeatureVector): number {
  const clusterNumeric = LEVEL_WEIGHT[fv.deadlineClusterScore] ?? 0;
  const overlapNumeric = LEVEL_WEIGHT[fv.overlapScore] ?? 0;
  return Math.min(100, Math.round(fv.totalEstimatedHours * 5 + clusterNumeric * 0.2 + overlapNumeric * 0.15));
}

function classifySeverity(totalHours: number): WorkloadSeverity {
  if (totalHours < 6) return "light";
  if (totalHours < 10) return "moderate";
  if (totalHours < 15) return "heavy";
  return "critical";
}

function weekDateRange(weekIndex: number): { label: string; range: string; start: Date; end: Date } {
  const monday = getCurrentMonday();
  const start = new Date(monday);
  start.setDate(monday.getDate() + weekIndex * 7);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return {
    label: `Week ${weekIndex + 1}`,
    range: `${fmt(start)} – ${fmt(end)}`,
    start,
    end,
  };
}

function identifyTopDrivers(assessments: ForecastAssessment[]): string[] {
  if (assessments.length === 0) return [];
  const sorted = [...assessments].sort((a, b) => b.estimatedHours - a.estimatedHours);
  return [sorted[0].id];
}

function generateSuggestions(
  weeks: { assessments: ForecastAssessment[]; severity: WorkloadSeverity; label: string }[]
): RedistributionSuggestion[] {
  const suggestions: RedistributionSuggestion[] = [];

  for (let i = 0; i < weeks.length; i++) {
    const week = weeks[i];
    if (week.severity !== "heavy" && week.severity !== "critical") continue;

    const sorted = [...week.assessments].sort((a, b) => b.estimatedHours - a.estimatedHours);
    const heaviest = sorted[0];

    if (heaviest && i > 0 && (weeks[i - 1].severity === "light" || weeks[i - 1].severity === "moderate")) {
      suggestions.push({
        type: "start_earlier",
        assessmentId: heaviest.id,
        assessmentTitle: heaviest.title,
        suggestion: `Start "${heaviest.title}" during ${weeks[i - 1].label} to reduce peak load by up to 2h.`,
        hoursSaved: Math.min(2, Math.round(heaviest.estimatedHours * 0.4 * 10) / 10),
        fromWeek: week.label,
        toWeek: weeks[i - 1].label,
      });
    }

    const highEffort = sorted.filter((a) => a.estimatedHours >= 3);
    if (highEffort.length >= 2) {
      suggestions.push({
        type: "split_prep",
        assessmentId: highEffort[1].id,
        assessmentTitle: highEffort[1].title,
        suggestion: `Split prep for "${highEffort[1].title}" across ${week.label} and the prior week to avoid overlap with "${highEffort[0].title}".`,
        hoursSaved: Math.min(2, Math.round(highEffort[1].estimatedHours * 0.3 * 10) / 10),
        fromWeek: week.label,
        toWeek: i > 0 ? weeks[i - 1].label : week.label,
      });
    }
  }

  return suggestions;
}

/* ------------------------------------------------------------------ */
/*  Public entry point                                                 */
/* ------------------------------------------------------------------ */

export function buildForecast(assessments: ForecastAssessment[]): WorkloadForecastData {
  const weekBuckets = groupByWeek(assessments);
  const confidences = [0.92, 0.85, 0.74, 0.61];

  const weekMetas = weekBuckets.map((bucket, i) => {
    const { label, range } = weekDateRange(i);
    const fv = computeFeatureVector(bucket);
    const severity = classifySeverity(fv.totalEstimatedHours);
    return { assessments: bucket, severity, label, range, fv };
  });

  const allSuggestions = generateSuggestions(weekMetas);

  const weeks: WeekForecast[] = weekMetas.map((wm, i) => {
    const weekSuggestions = allSuggestions.filter(
      (s) => s.fromWeek === wm.label
    );

    return {
      weekLabel: wm.label,
      dateRange: wm.range,
      workloadScore: computeWorkloadScore(wm.fv),
      severity: wm.severity,
      confidence: confidences[i],
      featureVector: wm.fv,
      assessments: wm.assessments,
      topLoadDrivers: identifyTopDrivers(wm.assessments),
      suggestions: weekSuggestions,
    };
  });

  const heavyWeekCount = weeks.filter(
    (w) => w.severity === "heavy" || w.severity === "critical"
  ).length;

  const courses = [...new Set(assessments.map((a) => a.courseName))];

  return {
    generatedAt: new Date().toISOString(),
    forecastWindowWeeks: 4,
    courses,
    weeks,
    overallSummary:
      heavyWeekCount > 0
        ? `${heavyWeekCount} of 4 weeks have elevated workload. Consider front-loading prep during lighter weeks.`
        : "Workload is evenly distributed across the forecast window.",
    heavyWeekCount,
  };
}
