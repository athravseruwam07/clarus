import type { Course } from "@/lib/api";

function isValidDate(value: string | null): value is string {
  if (!value) {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
}

function getAcademicTerm(now: Date): { season: "winter" | "spring" | "fall"; year: number } {
  const month = now.getMonth();

  if (month <= 3) {
    return { season: "winter", year: now.getFullYear() };
  }

  if (month <= 7) {
    return { season: "spring", year: now.getFullYear() };
  }

  return { season: "fall", year: now.getFullYear() };
}

function normalizeCourseText(course: Course): string {
  return `${course.courseName} ${course.courseCode ?? ""}`.toLowerCase();
}

function getCurrentTermTokens(now: Date): string[] {
  const { season, year } = getAcademicTerm(now);
  const shortYear = String(year).slice(-2);

  if (season === "winter") {
    return [`winter ${year}`, `winter${year}`, `w${shortYear}`];
  }

  if (season === "spring") {
    return [`spring ${year}`, `spring${year}`, `summer ${year}`, `summer${year}`, `s${shortYear}`];
  }

  return [`fall ${year}`, `fall${year}`, `f${shortYear}`];
}

function extractTaggedTerm(text: string): { season: "winter" | "spring" | "fall"; year: number } | null {
  const namedSeasonMatch = text.match(/\b(winter|spring|summer|fall)\s*(20\d{2}|\d{2})\b/i);
  if (namedSeasonMatch) {
    const rawSeason = namedSeasonMatch[1]!.toLowerCase();
    const rawYear = namedSeasonMatch[2]!;

    return {
      season: rawSeason === "summer" ? "spring" : (rawSeason as "winter" | "spring" | "fall"),
      year: rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear)
    };
  }

  const compactMatch = text.match(/\b([wfs])\s*([0-9]{2})\b/i);
  if (!compactMatch) {
    return null;
  }

  const seasonLetter = compactMatch[1]!.toLowerCase();

  return {
    season: seasonLetter === "w" ? "winter" : seasonLetter === "s" ? "spring" : "fall",
    year: 2000 + Number(compactMatch[2]!)
  };
}

function extractTaggedYear(text: string): number | null {
  const explicitYearMatch =
    text.match(/\((20\d{2})\)/) ??
    text.match(/(?:-|–)\s*(20\d{2})\b/) ??
    text.match(/\b(20\d{2})\b/);

  if (!explicitYearMatch) {
    return null;
  }

  return Number(explicitYearMatch[1]!);
}

function hasCurrentTermTextHint(course: Course, now: Date): boolean {
  const text = normalizeCourseText(course);
  return getCurrentTermTokens(now).some((token) => text.includes(token));
}

function hasExplicitMismatchedTerm(course: Course, now: Date): boolean {
  const normalized = normalizeCourseText(course);
  const taggedTerm = extractTaggedTerm(normalized);
  if (!taggedTerm) {
    const taggedYear = extractTaggedYear(normalized);
    return taggedYear !== null && taggedYear !== now.getFullYear();
  }

  const currentTerm = getAcademicTerm(now);
  return taggedTerm.season !== currentTerm.season || taggedTerm.year !== currentTerm.year;
}

function isActiveByDateWindow(course: Course, now: Date): boolean {
  if (!isValidDate(course.startDate) || !isValidDate(course.endDate)) {
    return false;
  }

  const startMs = new Date(course.startDate).getTime();
  const endMs = new Date(course.endDate).getTime();
  const nowMs = now.getTime();

  return startMs <= nowMs && endMs >= nowMs;
}

export function isCurrentTermCourse(course: Course, now = new Date()): boolean {
  if (!course.isActive || hasExplicitMismatchedTerm(course, now)) {
    return false;
  }

  return isActiveByDateWindow(course, now) || hasCurrentTermTextHint(course, now);
}

export function getCurrentTermCourses(courses: Course[], now = new Date()): Course[] {
  return courses.filter((course) => isCurrentTermCourse(course, now));
}
