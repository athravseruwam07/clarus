import type { TimelineEventDTO } from "@/lib/api";

const EXAM_TITLE_PATTERN = /\b(midterm|mid-term|final\s*exam|exam)\b/i;
const QUIZ_TITLE_PATTERN = /\bquiz\b/i;
const LAB_TITLE_PATTERN = /\blab\b/i;
const TUTORIAL_TITLE_PATTERN = /\b(tutorial|tut)\b/i;
const OFFICE_HOURS_TITLE_PATTERN = /\boffice\s*hours?\b/i;
const CLASS_TITLE_PATTERN = /\b(lecture|class|seminar|workshop|studio|recitation)\b/i;

export type AgendaCategory =
  | "assignment"
  | "exam"
  | "quiz"
  | "lab"
  | "tutorial"
  | "office_hours"
  | "class"
  | "discussion"
  | "checklist"
  | "content"
  | "other";

export function classifyEvent(event: TimelineEventDTO): AgendaCategory {
  if (event.sourceType === "dropbox_folder" || event.associatedEntityType === "D2L.LE.Dropbox.Dropbox") {
    return "assignment";
  }

  if (event.sourceType === "discussion_forum" || event.sourceType === "discussion_topic") {
    return "discussion";
  }

  if (event.sourceType === "checklist") {
    return "checklist";
  }

  if (event.sourceType === "content_module" || event.sourceType === "content_topic") {
    const title = event.title.trim();
    if (EXAM_TITLE_PATTERN.test(title)) return "exam";
    if (QUIZ_TITLE_PATTERN.test(title)) return "quiz";
    if (LAB_TITLE_PATTERN.test(title)) return "lab";
    if (TUTORIAL_TITLE_PATTERN.test(title)) return "tutorial";
    if (OFFICE_HOURS_TITLE_PATTERN.test(title)) return "office_hours";
    if (CLASS_TITLE_PATTERN.test(title)) return "class";
    return "content";
  }

  if (event.sourceType === "quiz" || event.associatedEntityType === "D2L.LE.Quizzing.Quiz") {
    const title = event.title.trim();
    return EXAM_TITLE_PATTERN.test(title) ? "exam" : "quiz";
  }

  const title = event.title.trim();
  if (EXAM_TITLE_PATTERN.test(title)) return "exam";
  if (QUIZ_TITLE_PATTERN.test(title)) return "quiz";
  if (LAB_TITLE_PATTERN.test(title)) return "lab";
  if (TUTORIAL_TITLE_PATTERN.test(title)) return "tutorial";
  if (OFFICE_HOURS_TITLE_PATTERN.test(title)) return "office_hours";
  if (CLASS_TITLE_PATTERN.test(title)) return "class";

  if (event.sourceType === "calendar" && event.associatedEntityType) {
    return "other";
  }

  return "other";
}

export function safeDateFromIso(value: string): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function sortByStartAt(a: TimelineEventDTO, b: TimelineEventDTO): number {
  const left = safeDateFromIso(a.startAt)?.getTime() ?? 0;
  const right = safeDateFromIso(b.startAt)?.getTime() ?? 0;
  return left - right;
}
