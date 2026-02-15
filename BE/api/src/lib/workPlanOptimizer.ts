export type WorkItemType =
  | "assignment"
  | "quiz"
  | "test"
  | "discussion"
  | "lab"
  | "project"
  | "reading"
  | "presentation"
  | "other";

export type RecomputeTrigger = "initial" | "session_skipped" | "workload_changed";

export interface WorkItemInput {
  id: string;
  title: string;
  type: WorkItemType;
  dueAt: string;
  estimatedMinutes: number;
  complexityScore: number;
  riskScore: number;
  priorityScore: number;
  gradeWeight: number;
}

export interface WorkPlanOptimizeRequest {
  availability: {
    timezone: string;
    weekdayMinutes: number;
    weekendMinutes: number;
    overrides: Partial<Record<DayKey, number>>;
  };
  pace: {
    productivityProfile: "slow" | "steady" | "fast";
    focusMinutesPerSession: number;
    breakMinutes: number;
  };
  priorities: {
    preferHighRisk: boolean;
    preferHighWeight: boolean;
    preferNearDeadline: boolean;
  };
  behavior: {
    sessionsSkippedLast7d: number;
    recentSnoozeRate: number;
    avgCompletionDriftPct: number;
    preferredTimeOfDay: "morning" | "afternoon" | "evening";
  };
  recompute: {
    trigger: RecomputeTrigger;
    workloadChangeNote: string;
    newAssessmentsAdded: number;
  };
  workItems: WorkItemInput[];
}

export interface WorkPlanOptimizeResponse {
  planType: "student_work_plan_optimizer";
  generatedAt: string;
  summary: {
    totalWorkItems: number;
    totalEstimatedHours: number;
    totalScheduledHours: number;
    daysPlanned: number;
    recomputed: boolean;
    spacedRepetitionBlocks: number;
  };
  nextBestAction: {
    workItemId: string;
    title: string;
    action: string;
    reason: string;
    recommendedTodayMinutes: number;
  };
  adjustments: Array<{
    kind: "behavior" | "workload" | "risk" | "capacity";
    title: string;
    description: string;
  }>;
  explanations: string[];
  dailyPlan: Array<{
    date: string;
    totalMinutes: number;
    focusWindow: "morning" | "afternoon" | "evening";
    tasks: Array<{
      blockId: string;
      workItemId: string;
      title: string;
      type: WorkItemType;
      mode: "prep" | "execution" | "spaced_repetition" | "review";
      minutes: number;
      dueAt: string;
      priorityRank: number;
      isLatePlacement: boolean;
      reason: string;
    }>;
  }>;
}

interface RankedItem {
  item: WorkItemInput;
  adjustedMinutes: number;
  rankScore: number;
  daysUntilDue: number;
}

interface PlannedBlock {
  blockId: string;
  workItemId: string;
  title: string;
  type: WorkItemType;
  mode: "prep" | "execution" | "spaced_repetition" | "review";
  minutes: number;
  dueAt: string;
  priorityRank: number;
  reason: string;
}

type DayKey =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

const dayKeys: DayKey[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday"
];

const paceMultiplier: Record<WorkPlanOptimizeRequest["pace"]["productivityProfile"], number> = {
  slow: 1.2,
  steady: 1,
  fast: 0.86
};

export function optimizeStudentWorkPlan(input: WorkPlanOptimizeRequest): WorkPlanOptimizeResponse {
  const now = new Date();

  const rankedItems = input.workItems
    .map((item) => rankItem(item, input, now))
    .sort((a, b) => b.rankScore - a.rankScore);

  const blocks = buildBlocks(rankedItems, input);
  const maxDueDays = Math.max(7, ...rankedItems.map((ranked) => ranked.daysUntilDue));
  const planningDays = Math.min(Math.max(maxDueDays + 1, 7), 14);
  const schedule = buildDaySchedule(now, planningDays, input.availability, input.behavior.preferredTimeOfDay);
  const { placedDailyPlan, latePlacements } = placeBlocks(schedule, blocks, now);

  const spacedRepetitionBlocks = blocks.filter((block) => block.mode === "spaced_repetition").length;
  const totalEstimatedMinutes = rankedItems.reduce((sum, ranked) => sum + ranked.adjustedMinutes, 0);
  const totalScheduledMinutes = placedDailyPlan.reduce((sum, day) => sum + day.totalMinutes, 0);

  const adjustments = buildAdjustments(input, latePlacements);
  const explanations = buildExplanations(rankedItems, input, latePlacements);

  const topItem = rankedItems[0];
  const suggestedMinutes = Math.min(
    Math.max(input.pace.focusMinutesPerSession, 30),
    topItem ? topItem.adjustedMinutes : input.pace.focusMinutesPerSession
  );

  return {
    planType: "student_work_plan_optimizer",
    generatedAt: new Date().toISOString(),
    summary: {
      totalWorkItems: input.workItems.length,
      totalEstimatedHours: round2(totalEstimatedMinutes / 60),
      totalScheduledHours: round2(totalScheduledMinutes / 60),
      daysPlanned: planningDays,
      recomputed: input.recompute.trigger !== "initial",
      spacedRepetitionBlocks
    },
    nextBestAction: {
      workItemId: topItem?.item.id ?? "none",
      title: topItem?.item.title ?? "No work items",
      action: topItem
        ? `Start with a ${suggestedMinutes}-minute focused block on ${topItem.item.title}.`
        : "Add work items to generate your next action.",
      reason: topItem
        ? `Highest rank from risk (${topItem.item.riskScore}), priority (${topItem.item.priorityScore}), and due urgency (${topItem.daysUntilDue} day window).`
        : "Planner requires at least one active work item.",
      recommendedTodayMinutes: topItem ? suggestedMinutes : 0
    },
    adjustments,
    explanations,
    dailyPlan: placedDailyPlan
  };
}

function rankItem(item: WorkItemInput, input: WorkPlanOptimizeRequest, now: Date): RankedItem {
  const dueDate = new Date(item.dueAt);
  const daysUntilDue = Math.max(1, Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  const urgencyScore = clamp(120 / daysUntilDue, 0, 100);
  let rankScore =
    item.priorityScore * 0.3 +
    item.riskScore * 0.25 +
    item.complexityScore * 0.15 +
    item.gradeWeight * 0.15 +
    urgencyScore * 0.15;

  if (input.priorities.preferHighRisk) {
    rankScore += item.riskScore * 0.06;
  }

  if (input.priorities.preferHighWeight) {
    rankScore += item.gradeWeight * 0.06;
  }

  if (input.priorities.preferNearDeadline) {
    rankScore += urgencyScore * 0.06;
  }

  const adjustedMinutes = Math.max(
    20,
    Math.ceil(
      item.estimatedMinutes *
        paceMultiplier[input.pace.productivityProfile] *
        (1 + input.behavior.avgCompletionDriftPct / 100) *
        recomputeMultiplier(input.recompute.trigger)
    )
  );

  return {
    item,
    adjustedMinutes,
    rankScore: round2(rankScore),
    daysUntilDue
  };
}

function buildBlocks(rankedItems: RankedItem[], input: WorkPlanOptimizeRequest): PlannedBlock[] {
  const blocks: PlannedBlock[] = [];
  let blockCounter = 0;

  rankedItems.forEach((rankedItem, index) => {
    const priorityRank = index + 1;
    const prepMinutes = clamp(Math.round(rankedItem.adjustedMinutes * 0.18), 15, 40);
    const executionMinutes = Math.max(20, rankedItem.adjustedMinutes - prepMinutes);

    blockCounter += 1;
    blocks.push({
      blockId: `block-${blockCounter}`,
      workItemId: rankedItem.item.id,
      title: rankedItem.item.title,
      type: rankedItem.item.type,
      mode: "prep",
      minutes: prepMinutes,
      dueAt: rankedItem.item.dueAt,
      priorityRank,
      reason: "Preparation block to remove startup friction and gather required materials."
    });

    const focus = Math.max(25, input.pace.focusMinutesPerSession);
    let remaining = executionMinutes;

    while (remaining > 0) {
      const chunk = Math.min(remaining, focus);
      blockCounter += 1;
      blocks.push({
        blockId: `block-${blockCounter}`,
        workItemId: rankedItem.item.id,
        title: rankedItem.item.title,
        type: rankedItem.item.type,
        mode: "execution",
        minutes: chunk,
        dueAt: rankedItem.item.dueAt,
        priorityRank,
        reason: "Core execution block for deliverable progress."
      });
      remaining -= chunk;
    }

    if (isAssessmentNeedingRetention(rankedItem.item.type)) {
      const repetitions = rankedItem.daysUntilDue >= 4 ? 2 : 1;
      for (let i = 0; i < repetitions; i += 1) {
        blockCounter += 1;
        blocks.push({
          blockId: `block-${blockCounter}`,
          workItemId: rankedItem.item.id,
          title: rankedItem.item.title,
          type: rankedItem.item.type,
          mode: "spaced_repetition",
          minutes: 25,
          dueAt: rankedItem.item.dueAt,
          priorityRank,
          reason: "Spaced repetition to strengthen recall before assessment."
        });
      }
    }

    if (rankedItem.item.type === "discussion") {
      blockCounter += 1;
      blocks.push({
        blockId: `block-${blockCounter}`,
        workItemId: rankedItem.item.id,
        title: rankedItem.item.title,
        type: rankedItem.item.type,
        mode: "review",
        minutes: 20,
        dueAt: rankedItem.item.dueAt,
        priorityRank,
        reason: "Review block to refine responses and satisfy participation quality criteria."
      });
    }
  });

  if (input.recompute.trigger === "session_skipped" && rankedItems[0]) {
    blockCounter += 1;
    blocks.unshift({
      blockId: `block-${blockCounter}`,
      workItemId: rankedItems[0].item.id,
      title: rankedItems[0].item.title,
      type: rankedItems[0].item.type,
      mode: "review",
      minutes: 30,
      dueAt: rankedItems[0].item.dueAt,
      priorityRank: 1,
      reason: "Recovery block inserted after skipped sessions to reduce immediate slippage risk."
    });
  }

  return blocks.sort((a, b) => {
    if (a.priorityRank !== b.priorityRank) {
      return a.priorityRank - b.priorityRank;
    }

    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
}

function buildDaySchedule(
  now: Date,
  planningDays: number,
  availability: WorkPlanOptimizeRequest["availability"],
  focusWindow: "morning" | "afternoon" | "evening"
): Array<{
  date: Date;
  key: string;
  capacity: number;
  remaining: number;
  focusWindow: "morning" | "afternoon" | "evening";
  tasks: WorkPlanOptimizeResponse["dailyPlan"][number]["tasks"];
}> {
  const days = [] as Array<{
    date: Date;
    key: string;
    capacity: number;
    remaining: number;
    focusWindow: "morning" | "afternoon" | "evening";
    tasks: WorkPlanOptimizeResponse["dailyPlan"][number]["tasks"];
  }>;

  for (let i = 0; i < planningDays; i += 1) {
    const date = addDays(startOfDay(now), i);
    const dayKey = toDayKey(date);
    const defaultMinutes = dayKey === "saturday" || dayKey === "sunday" ? availability.weekendMinutes : availability.weekdayMinutes;
    const overrideMinutes = availability.overrides[dayKey];
    const capacity = Math.max(0, overrideMinutes ?? defaultMinutes);

    days.push({
      date,
      key: toIsoDate(date),
      capacity,
      remaining: capacity,
      focusWindow,
      tasks: []
    });
  }

  return days;
}

function placeBlocks(
  schedule: Array<{
    date: Date;
    key: string;
    capacity: number;
    remaining: number;
    focusWindow: "morning" | "afternoon" | "evening";
    tasks: WorkPlanOptimizeResponse["dailyPlan"][number]["tasks"];
  }>,
  blocks: PlannedBlock[],
  now: Date
): { placedDailyPlan: WorkPlanOptimizeResponse["dailyPlan"]; latePlacements: number } {
  let latePlacements = 0;

  blocks.forEach((block) => {
    const dueDate = startOfDay(new Date(block.dueAt));
    const dueIndex = Math.max(0, daysBetween(startOfDay(now), dueDate));

    let placed = false;
    for (let i = 0; i < schedule.length; i += 1) {
      const day = schedule[i];

      if (day.remaining < block.minutes) {
        continue;
      }

      const beforeOrOnDue = i <= dueIndex;
      const fallbackMode = !beforeOrOnDue;
      const isFinalOption = i === schedule.length - 1;

      if (beforeOrOnDue || isFinalOption || dueIndex >= schedule.length - 1) {
        day.tasks.push({
          blockId: block.blockId,
          workItemId: block.workItemId,
          title: block.title,
          type: block.type,
          mode: block.mode,
          minutes: block.minutes,
          dueAt: block.dueAt,
          priorityRank: block.priorityRank,
          isLatePlacement: fallbackMode,
          reason: block.reason
        });
        day.remaining -= block.minutes;
        if (fallbackMode) {
          latePlacements += 1;
        }
        placed = true;
        break;
      }
    }

    if (!placed) {
      // If no day had enough remaining time, force-place into the day with highest remaining capacity.
      const bestDay = schedule.reduce((acc, day) => (day.remaining > acc.remaining ? day : acc), schedule[0]);
      bestDay.tasks.push({
        blockId: block.blockId,
        workItemId: block.workItemId,
        title: block.title,
        type: block.type,
        mode: block.mode,
        minutes: block.minutes,
        dueAt: block.dueAt,
        priorityRank: block.priorityRank,
        isLatePlacement: true,
        reason: `${block.reason} (forced placement due to capacity limit)`
      });
      bestDay.remaining = Math.max(0, bestDay.remaining - block.minutes);
      latePlacements += 1;
    }
  });

  const placedDailyPlan = schedule
    .filter((day) => day.tasks.length > 0)
    .map((day) => ({
      date: day.key,
      totalMinutes: day.tasks.reduce((sum, task) => sum + task.minutes, 0),
      focusWindow: day.focusWindow,
      tasks: day.tasks.sort((a, b) => a.priorityRank - b.priorityRank)
    }));

  return { placedDailyPlan, latePlacements };
}

function buildAdjustments(input: WorkPlanOptimizeRequest, latePlacements: number): WorkPlanOptimizeResponse["adjustments"] {
  const adjustments: WorkPlanOptimizeResponse["adjustments"] = [];

  if (input.recompute.trigger === "session_skipped") {
    adjustments.push({
      kind: "behavior",
      title: "Recovery rebalance applied",
      description:
        "Skipped sessions triggered an automatic recovery block and reallocation of high-priority work to earlier slots."
    });
  }

  if (input.recompute.trigger === "workload_changed" || input.recompute.newAssessmentsAdded > 0) {
    adjustments.push({
      kind: "workload",
      title: "Workload change absorbed",
      description:
        "New or changed workload caused re-ranking and redistributed blocks with extra buffer on highest-risk items."
    });
  }

  if (input.behavior.avgCompletionDriftPct > 10) {
    adjustments.push({
      kind: "risk",
      title: "Effort buffer increased",
      description:
        `Historical overrun of ${input.behavior.avgCompletionDriftPct}% increased planned minutes to reduce deadline miss probability.`
    });
  }

  if (latePlacements > 0) {
    adjustments.push({
      kind: "capacity",
      title: "Capacity warning",
      description:
        `${latePlacements} block(s) required late placement; increase daily availability or reduce low-impact tasks.`
    });
  }

  if (adjustments.length === 0) {
    adjustments.push({
      kind: "behavior",
      title: "Plan stable",
      description: "No major disruptions detected; current schedule aligns with workload and behavior profile."
    });
  }

  return adjustments;
}

function buildExplanations(
  rankedItems: RankedItem[],
  input: WorkPlanOptimizeRequest,
  latePlacements: number
): string[] {
  const top = rankedItems[0];
  const second = rankedItems[1];

  const lines: string[] = [];

  if (top) {
    lines.push(
      `Top priority is \"${top.item.title}\" due to combined high risk (${top.item.riskScore}), priority (${top.item.priorityScore}), and due window (${top.daysUntilDue} day${top.daysUntilDue === 1 ? "" : "s"}).`
    );
  }

  if (second) {
    lines.push(
      `Second priority is \"${second.item.title}\" to avoid overlap-driven bottlenecks with other high-effort work.`
    );
  }

  if (input.behavior.sessionsSkippedLast7d > 0) {
    lines.push(
      `Recent skipped sessions (${input.behavior.sessionsSkippedLast7d}) increased early-block allocation to lower slippage risk.`
    );
  }

  if (latePlacements > 0) {
    lines.push(
      `Capacity constraints caused ${latePlacements} late placement block(s); consider adding ${Math.ceil(latePlacements * 30)} extra minutes/day this week.`
    );
  }

  if (lines.length === 0) {
    lines.push("Plan generated successfully with balanced workload and no major risk amplifiers.");
  }

  return lines;
}

function isAssessmentNeedingRetention(type: WorkItemType): boolean {
  return type === "quiz" || type === "test";
}

function recomputeMultiplier(trigger: RecomputeTrigger): number {
  if (trigger === "session_skipped") {
    return 1.1;
  }

  if (trigger === "workload_changed") {
    return 1.06;
  }

  return 1;
}

function daysBetween(start: Date, end: Date): number {
  return Math.ceil((startOfDay(end).getTime() - startOfDay(start).getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toDayKey(date: Date): DayKey {
  return dayKeys[date.getDay()] ?? "monday";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
