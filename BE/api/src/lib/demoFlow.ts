import { AppError } from "./errors.js";

export interface DemoTimelineItem {
  assignmentId: string;
  title: string;
  courseName: string;
  assessmentType: "assignment" | "quiz" | "discussion" | "lab" | "project";
  dueAt: string;
  priorityScore: number;
  riskScore: number;
  effortHours: number;
  recommendedStartDate: string;
  recentlyChanged: boolean;
}

export interface DemoResourceHit {
  priority: number;
  module: string;
  lecture: string;
  resource: string;
  section: string;
  whyRelevant: string;
  confidence: number;
}

export interface DemoChecklistItem {
  id: string;
  text: string;
  category: "submission" | "rubric" | "format" | "citation" | "hidden";
  completed: boolean;
}

export interface DemoSessionPlan {
  label: string;
  durationMinutes: number;
  objective: string;
}

export interface DemoAssignmentIntelligence {
  assignmentId: string;
  title: string;
  courseName: string;
  dueAt: string;
  complexityScore: number;
  effortHours: number;
  riskScore: number;
  riskDrivers: string[];
  recommendedStartDate: string;
  highestLeverageNextStep: string;
  checklist: DemoChecklistItem[];
  contentLocator: DemoResourceHit[];
  sessionPlan: DemoSessionPlan[];
}

export interface DemoDashboardData {
  highestLeverageTask: {
    assignmentId: string;
    title: string;
    reason: string;
    riskScore: number;
    effortHours: number;
  };
  riskAlert: {
    headline: string;
    explanation: string;
    mitigation: string;
  };
  workloadPreview: {
    heavyWeekDetected: boolean;
    weekLabel: string;
    estimatedHours: number;
    recommendation: string;
  };
  timeline: DemoTimelineItem[];
}

export interface DemoInsightsData {
  workloadHeatmap: Array<{ week: string; estimatedHours: number; intensity: "low" | "medium" | "high" }>;
  riskForecast: Array<{ week: string; riskScore: number; label: string }>;
  knowledgeGaps: Array<{ concept: string; confidence: number; recommendation: string }>;
  behaviorTrends: {
    averageStartLeadDays: number;
    snoozeRate: number;
    estimatedVsActualDriftPct: number;
  };
}

const demoTimeline: DemoTimelineItem[] = [
  {
    assignmentId: "asg-thermo-2",
    title: "Assignment 2: Thermodynamics Analysis",
    courseName: "MSE 240",
    assessmentType: "assignment",
    dueAt: isoDaysFromNow(5),
    priorityScore: 91,
    riskScore: 68,
    effortHours: 4.2,
    recommendedStartDate: isoDaysFromNow(0),
    recentlyChanged: true
  },
  {
    assignmentId: "quiz-mech-3",
    title: "Quiz 3: Shear Stress Concepts",
    courseName: "MECH 210",
    assessmentType: "quiz",
    dueAt: isoDaysFromNow(3),
    priorityScore: 87,
    riskScore: 54,
    effortHours: 2.1,
    recommendedStartDate: isoDaysFromNow(0),
    recentlyChanged: false
  },
  {
    assignmentId: "disc-design-4",
    title: "Discussion 4: Design Tradeoffs",
    courseName: "SYDE 161",
    assessmentType: "discussion",
    dueAt: isoDaysFromNow(2),
    priorityScore: 72,
    riskScore: 41,
    effortHours: 1.4,
    recommendedStartDate: isoDaysFromNow(0),
    recentlyChanged: false
  }
];

const assignmentIntelligence: Record<string, DemoAssignmentIntelligence> = {
  "asg-thermo-2": {
    assignmentId: "asg-thermo-2",
    title: "Assignment 2: Thermodynamics Analysis",
    courseName: "MSE 240",
    dueAt: isoDaysFromNow(5),
    complexityScore: 83,
    effortHours: 4.2,
    riskScore: 68,
    riskDrivers: [
      "You usually start writing assignments less than 48h before due date.",
      "Two additional graded items overlap this week.",
      "Past assignments with similar rubric density took 4+ hours."
    ],
    recommendedStartDate: isoDaysFromNow(0),
    highestLeverageNextStep: "Draft outline + collect 3 sources today.",
    checklist: [
      {
        id: "ck-1",
        text: "Prepare one combined PDF submission with results + discussion sections.",
        category: "submission",
        completed: false
      },
      {
        id: "ck-2",
        text: "Use APA citations and include at least 3 external sources.",
        category: "citation",
        completed: false
      },
      {
        id: "ck-3",
        text: "Address rubric criterion: justification of assumptions.",
        category: "rubric",
        completed: false
      },
      {
        id: "ck-4",
        text: "Hidden requirement detected: explicitly compare two modeling approaches.",
        category: "hidden",
        completed: false
      }
    ],
    contentLocator: [
      {
        priority: 1,
        module: "Module 3",
        lecture: "Lecture 3.2",
        resource: "Thermodynamics Slide Deck",
        section: "Slides 14-22",
        whyRelevant: "Covers the exact method required by rubric criterion #2.",
        confidence: 0.92
      },
      {
        priority: 2,
        module: "Module 3",
        lecture: "Reading",
        resource: "Chapter 6: Elastic Collisions",
        section: "Section 6.1-6.3",
        whyRelevant: "Provides derivation steps referenced in assignment prompt.",
        confidence: 0.89
      },
      {
        priority: 3,
        module: "Additional Resources",
        lecture: "Practice Set",
        resource: "Problem Set #3",
        section: "Question 4",
        whyRelevant: "Most similar solved example to expected submission format.",
        confidence: 0.84
      }
    ],
    sessionPlan: [
      {
        label: "Session 1",
        durationMinutes: 75,
        objective: "Outline sections, gather 3 sources, and map rubric criteria to headings."
      },
      {
        label: "Session 2",
        durationMinutes: 90,
        objective: "Complete calculations + first draft results section."
      },
      {
        label: "Session 3",
        durationMinutes: 90,
        objective: "Finalize discussion, citations, and submission formatting checks."
      }
    ]
  },
  "quiz-mech-3": {
    assignmentId: "quiz-mech-3",
    title: "Quiz 3: Shear Stress Concepts",
    courseName: "MECH 210",
    dueAt: isoDaysFromNow(3),
    complexityScore: 66,
    effortHours: 2.1,
    riskScore: 54,
    riskDrivers: [
      "Quiz topic overlaps with concept area where prior score dropped below 70%.",
      "No completed review blocks logged for this topic in last 5 days."
    ],
    recommendedStartDate: isoDaysFromNow(0),
    highestLeverageNextStep: "Review Lecture 5.1 shear stress section and solve 5 targeted practice questions.",
    checklist: [
      {
        id: "ck-q1",
        text: "Review topic set 2.1-2.4 and key formulas.",
        category: "rubric",
        completed: false
      },
      {
        id: "ck-q2",
        text: "Complete practice problems under Additional Resources.",
        category: "submission",
        completed: false
      }
    ],
    contentLocator: [
      {
        priority: 1,
        module: "Module 5",
        lecture: "Lecture 5.1",
        resource: "Shear Stress Concepts",
        section: "Slides 10-19",
        whyRelevant: "Primary concept cluster directly tagged to quiz topic list.",
        confidence: 0.9
      }
    ],
    sessionPlan: [
      {
        label: "Session 1",
        durationMinutes: 60,
        objective: "Concept review + formula sheet refresh."
      },
      {
        label: "Session 2",
        durationMinutes: 60,
        objective: "Timed mixed practice and error review."
      }
    ]
  }
};

export function getDemoDashboardData(): DemoDashboardData {
  const top = demoTimeline[0];

  return {
    highestLeverageTask: {
      assignmentId: top.assignmentId,
      title: top.title,
      reason:
        "Highest priority due to combined deadline proximity, risk profile, and high expected effort relative to available time.",
      riskScore: top.riskScore,
      effortHours: top.effortHours
    },
    riskAlert: {
      headline: "62% risk of missing at least one deadline next week",
      explanation:
        "Four graded items overlap with two high-effort tasks, and historical starts trend under 48 hours before due.",
      mitigation: "Start Assignment 2 today and lock two study blocks before Wednesday."
    },
    workloadPreview: {
      heavyWeekDetected: true,
      weekLabel: "Next 7 days",
      estimatedHours: 12.5,
      recommendation: "Split high-complexity tasks into three sessions and front-load reading tasks."
    },
    timeline: demoTimeline
  };
}

export function getDemoAssignmentIntelligence(assignmentId: string): DemoAssignmentIntelligence {
  const item = assignmentIntelligence[assignmentId];
  if (!item) {
    throw new AppError(404, "assignment intelligence not found", "assignment_not_found");
  }

  return item;
}

export function startDemoStudySession(input: {
  assignmentId: string;
  plannedMinutes: number;
  startedAt: string;
}): {
  sessionId: string;
  assignmentId: string;
  plannedMinutes: number;
  startedAt: string;
  adaptiveNote: string;
} {
  return {
    sessionId: `session-${Math.floor(Math.random() * 100000)}`,
    assignmentId: input.assignmentId,
    plannedMinutes: input.plannedMinutes,
    startedAt: input.startedAt,
    adaptiveNote:
      "Plan updated: your next block was moved earlier because this task has elevated risk and high effort variance."
  };
}

export function getDemoInsightsData(): DemoInsightsData {
  return {
    workloadHeatmap: [
      { week: "Week 1", estimatedHours: 7.2, intensity: "medium" },
      { week: "Week 2", estimatedHours: 12.5, intensity: "high" },
      { week: "Week 3", estimatedHours: 9.1, intensity: "medium" },
      { week: "Week 4", estimatedHours: 5.4, intensity: "low" }
    ],
    riskForecast: [
      { week: "Week 1", riskScore: 42, label: "moderate" },
      { week: "Week 2", riskScore: 68, label: "high" },
      { week: "Week 3", riskScore: 55, label: "elevated" }
    ],
    knowledgeGaps: [
      {
        concept: "Theoretical justification",
        confidence: 0.81,
        recommendation: "Review Module 4 -> Lecture 4.2 -> Slides 18-22 before next writing assignment."
      },
      {
        concept: "Shear stress application",
        confidence: 0.74,
        recommendation: "Complete Practice Set #3 Q4 and rewatch Lecture 5.1 examples."
      }
    ],
    behaviorTrends: {
      averageStartLeadDays: 1.7,
      snoozeRate: 0.33,
      estimatedVsActualDriftPct: 19
    }
  };
}

export function getDemoCopilotResponse(message: string): {
  answer: string;
  suggestedPlan: string[];
  linkedAssignments: Array<{ assignmentId: string; title: string; reason: string }>;
} {
  const normalized = message.toLowerCase();

  if (normalized.includes("2 hours") || normalized.includes("two hours")) {
    return {
      answer:
        "Use your next 2 hours on Assignment 2 outline + sources. This is currently the highest leverage task and lowers next-week deadline risk fastest.",
      suggestedPlan: [
        "45 min: review Lecture 3.2 slides 14-22 and extract required method steps",
        "35 min: gather 3 APA-compliant sources",
        "40 min: draft outline mapped to rubric criteria"
      ],
      linkedAssignments: [
        {
          assignmentId: "asg-thermo-2",
          title: "Assignment 2: Thermodynamics Analysis",
          reason: "Highest priority + highest effort + elevated risk overlap"
        }
      ]
    };
  }

  if (normalized.includes("quiz")) {
    return {
      answer:
        "Quiz 3 should be your next review target. Focus on Shear Stress in Module 5 and timed practice problems.",
      suggestedPlan: [
        "30 min concept recap (Lecture 5.1)",
        "45 min targeted practice set",
        "20 min error review and formula flashcards"
      ],
      linkedAssignments: [
        {
          assignmentId: "quiz-mech-3",
          title: "Quiz 3: Shear Stress Concepts",
          reason: "Concept-level weakness detected from prior performance trend"
        }
      ]
    };
  }

  return {
    answer:
      "Start with Assignment 2 today, then schedule Quiz 3 review tomorrow. This sequencing best balances risk reduction and effort feasibility.",
    suggestedPlan: [
      "Today: Assignment 2 Session 1 (75 min)",
      "Tomorrow: Quiz 3 review block (60 min)",
      "Day after: Assignment 2 Session 2 (90 min)"
    ],
    linkedAssignments: [
      {
        assignmentId: "asg-thermo-2",
        title: "Assignment 2: Thermodynamics Analysis",
        reason: "Top priority by multi-factor leverage score"
      },
      {
        assignmentId: "quiz-mech-3",
        title: "Quiz 3: Shear Stress Concepts",
        reason: "Upcoming due date with unresolved concept gap"
      }
    ]
  };
}

function isoDaysFromNow(daysFromNow: number): string {
  const now = new Date();
  now.setDate(now.getDate() + daysFromNow);
  return now.toISOString();
}
