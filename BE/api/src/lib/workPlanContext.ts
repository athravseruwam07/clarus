import type { Course, User } from "@prisma/client";

import { connectorRequest } from "./connectorClient.js";
import { AppError, isAppError } from "./errors.js";
import { prisma } from "./prisma.js";
import { decodeStorageState } from "./storageState.js";
import { WHOAMI_API_PATH } from "./valence.js";

const LE_VERSIONS = ["1.75", "1.74", "1.73", "1.71", "1.69", "1.66", "1.64", "1.60", "1.58"];

type WorkItemType = "assignment" | "quiz" | "discussion" | "project" | "lab" | "other";

interface ContentLink {
  module: string;
  lecture: string;
  resource: string;
  section: string;
  url: string;
  whyRelevant: string;
  confidence: number;
}

interface ChecklistTask {
  id: string;
  text: string;
}

interface PriorityBreakdown {
  deadlineProximity: number;
  risk: number;
  gradeWeight: number;
  complexity: number;
  effort: number;
  knowledgeGapImpact: number;
  total: number;
}

export interface WorkPlanContextItem {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  type: WorkItemType;
  dueAt: string;
  taskUrl: string;
  submissionUrl: string;
  assignmentUrl: string;
  estimatedMinutes: number;
  complexityScore: number;
  riskScore: number;
  gradeWeight: number;
  priorityScore: number;
  priorityBreakdown: PriorityBreakdown;
  delayImpactIfDeferred24h: number;
  contentLocator: ContentLink[];
  checklistTasks: ChecklistTask[];
  recentlyChanged: boolean;
}

export interface WorkPlanContextCourse {
  courseId: string;
  courseName: string;
  courseCode: string | null;
  courseUrl: string;
  moduleCount: number;
  contentPreview: ContentLink[];
}

export interface WorkPlanContextResponse {
  generatedAt: string;
  currentDateIso: string;
  activeCourses: WorkPlanContextCourse[];
  workItems: WorkPlanContextItem[];
  highestLeverageTask: {
    id: string;
    title: string;
    courseName: string;
    priorityScore: number;
    delayImpactIfDeferred24h: number;
    scoreBreakdown: PriorityBreakdown;
    reason: string;
  } | null;
}

interface FetchWithVersionResult {
  data: unknown;
  version: string;
}

interface ParsedRawItem {
  id: string;
  title: string;
  detailsText: string;
  type: WorkItemType;
  dueAt: string;
  estimatedMinutes: number;
  complexityScore: number;
  riskScore: number;
  gradeWeight: number;
  recentlyChanged: boolean;
}

export async function getWorkPlanContext(user: User): Promise<WorkPlanContextResponse> {
  if (!user.brightspaceStateEncrypted || !user.institutionUrl) {
    throw new AppError(400, "connect to d2l before generating work plan", "not_connected");
  }

  const storageState = decodeStorageState(user.brightspaceStateEncrypted);
  await assertConnectorSession(user, storageState);
  const courses = await getActiveCourses(user.id);
  const now = new Date();

  const courseContexts = await Promise.all(
    courses.map((course) =>
      buildCourseContext({
        user,
        storageState,
        course
      })
    )
  );

  const workItems = courseContexts.flatMap((context) => context.items);
  const rankedWorkItems = rankWorkItemsForPlanning(workItems, now);
  const orderedWorkItems = rankedWorkItems.map((entry) => entry.item);
  const topTask = orderedWorkItems[0];

  return {
    generatedAt: now.toISOString(),
    currentDateIso: now.toISOString(),
    activeCourses: courseContexts.map((context) => ({
      courseId: context.course.brightspaceCourseId,
      courseName: context.course.courseName,
      courseCode: context.course.courseCode,
      courseUrl: buildCourseUrl(user.institutionUrl!, context.course.brightspaceCourseId),
      moduleCount: context.contentLinks.length,
      contentPreview: context.contentLinks.slice(0, 4)
    })),
    workItems: orderedWorkItems,
    highestLeverageTask: topTask
      ? {
          id: topTask.id,
          title: topTask.title,
          courseName: topTask.courseName,
          priorityScore: topTask.priorityScore,
          delayImpactIfDeferred24h: topTask.delayImpactIfDeferred24h,
          scoreBreakdown: topTask.priorityBreakdown,
          reason: buildTopTaskReason(topTask)
        }
      : null
  };
}

async function getActiveCourses(userId: string): Promise<Course[]> {
  const now = new Date();

  const courses = await prisma.course.findMany({
    where: {
      userId,
      isActive: true
    },
    orderBy: [{ endDate: "asc" }, { updatedAt: "desc" }],
    take: 12
  });

  return courses.filter((course) => {
    const startsOk = !course.startDate || course.startDate <= now;
    const endsOk = !course.endDate || course.endDate >= now;
    return startsOk && endsOk;
  });
}

async function buildCourseContext(input: {
  user: User;
  storageState: Record<string, unknown>;
  course: Course;
}): Promise<{
  course: Course;
  contentLinks: ContentLink[];
  items: WorkPlanContextItem[];
}> {
  const { user, storageState, course } = input;
  const courseId = course.brightspaceCourseId;

  const [dropboxData, quizzesData, discussionForumsData, discussionTopicsData, contentData] = await Promise.all([
    requestLEWithFallback({
      user,
      storageState,
      pathFactory: (version) => `/d2l/api/le/${version}/${courseId}/dropbox/folders/`
    }),
    requestLEWithFallback({
      user,
      storageState,
      pathFactory: (version) => `/d2l/api/le/${version}/${courseId}/quizzes/`
    }),
    requestLEWithFallback({
      user,
      storageState,
      pathFactory: (version) => `/d2l/api/le/${version}/${courseId}/discussions/forums/`
    }),
    requestLEWithFallback({
      user,
      storageState,
      pathFactory: (version) => `/d2l/api/le/${version}/${courseId}/discussions/topics/`
    }),
    requestLEWithFallback({
      user,
      storageState,
      pathFactory: (version) => `/d2l/api/le/${version}/${courseId}/content/toc`
    })
  ]);

  const contentLinks = parseContentLinks({
    source: contentData?.data ?? null,
    user,
    courseId
  });

  const rawItems = dedupeParsedItems([
    ...parseDropboxItems(dropboxData?.data, courseId),
    ...parseQuizItems(quizzesData?.data, courseId),
    ...parseDiscussionItems(discussionForumsData?.data, courseId),
    ...parseDiscussionTopicItems(discussionTopicsData?.data, courseId)
  ]);

  const now = new Date();
  const minDueAtMs = now.getTime() - 1000 * 60 * 60 * 24 * 2;
  const maxDueAtMs = now.getTime() + 1000 * 60 * 60 * 24 * 180;
  const items: WorkPlanContextItem[] = rawItems
    .filter((item) => {
      const due = new Date(item.dueAt);
      const dueAtMs = due.getTime();
      return !Number.isNaN(dueAtMs) && dueAtMs >= minDueAtMs && dueAtMs <= maxDueAtMs;
    })
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, 30)
    .map((item) => {
      const due = new Date(item.dueAt);
      const daysUntilDue = Math.max(
        1,
        Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );
      const breakdown = computePriorityBreakdown({
        daysUntilDue,
        riskScore: item.riskScore,
        gradeWeight: item.gradeWeight,
        complexityScore: item.complexityScore,
        effortMinutes: item.estimatedMinutes,
        knowledgeGapImpact: estimateKnowledgeGapImpact(item.type, item.riskScore)
      });

      const delayedBreakdown = computePriorityBreakdown({
        daysUntilDue: daysUntilDue + 1,
        riskScore: item.riskScore,
        gradeWeight: item.gradeWeight,
        complexityScore: item.complexityScore,
        effortMinutes: item.estimatedMinutes,
        knowledgeGapImpact: estimateKnowledgeGapImpact(item.type, item.riskScore)
      });

      const taskContentLink = pickTaskLinkForItem(contentLinks, item);
      const studyLinks = pickStudyLinksForItem(contentLinks, item, taskContentLink?.url);
      const normalizedStudyLinks =
        studyLinks.length > 0
          ? studyLinks
          : [
              buildFallbackStudyLink({
                baseUrl: user.institutionUrl!,
                courseId,
                item
              })
            ];

      const taskUrl = taskContentLink?.url
        ? taskContentLink.url
        : buildTaskUrl({
            baseUrl: user.institutionUrl!,
            courseId,
            type: item.type,
            itemId: item.id
          });
      const submissionUrl = buildSubmissionUrl({
        baseUrl: user.institutionUrl!,
        courseId,
        type: item.type,
        itemId: item.id
      });

      return {
        id: item.id,
        courseId,
        courseName: course.courseName,
        title: item.title,
        type: item.type,
        dueAt: item.dueAt,
        taskUrl,
        submissionUrl,
        assignmentUrl: taskUrl,
        estimatedMinutes: item.estimatedMinutes,
        complexityScore: item.complexityScore,
        riskScore: item.riskScore,
        gradeWeight: item.gradeWeight,
        priorityScore: breakdown.total,
        priorityBreakdown: breakdown,
        delayImpactIfDeferred24h: round2(Math.max(0, breakdown.total - delayedBreakdown.total)),
        contentLocator: attachExternalResearchLink(
          normalizedStudyLinks.map((link, index) => ({
            ...link,
            confidence: clamp(link.confidence - index * 0.03, 0.55, 0.96)
          })),
          item,
          course.courseName
        ),
        checklistTasks: buildChecklistDefaults(item),
        recentlyChanged: item.recentlyChanged
      };
    });

  return {
    course,
    contentLinks,
    items
  };
}

async function requestLEWithFallback(input: {
  user: User;
  storageState: Record<string, unknown>;
  pathFactory: (version: string) => string;
}): Promise<FetchWithVersionResult | null> {
  for (const version of LE_VERSIONS) {
    try {
      const response = await connectorRequest<unknown>({
        instanceUrl: input.user.institutionUrl!,
        storageState: input.storageState,
        apiPath: input.pathFactory(version)
      });

      return {
        data: response.data,
        version
      };
    } catch (error) {
      if (isAppError(error) && error.code === "session_expired") {
        continue;
      }

      if (isAppError(error) && error.statusCode >= 500) {
        continue;
      }
    }
  }

  return null;
}

async function assertConnectorSession(
  user: User,
  storageState: Record<string, unknown>
): Promise<void> {
  try {
    await connectorRequest({
      instanceUrl: user.institutionUrl!,
      storageState,
      apiPath: WHOAMI_API_PATH
    });
  } catch (error) {
    if (isAppError(error) && error.code === "session_expired") {
      throw new AppError(401, "session expired", "session_expired");
    }

    throw error;
  }
}

function parseDropboxItems(source: unknown, courseId: string): ParsedRawItem[] {
  const array = toArray(source);
  const items: ParsedRawItem[] = [];
  const now = Date.now();

  array.forEach((entry) => {
    const record = asRecord(entry);
    if (!record) {
      return;
    }

    const id = readId(record["Id"]);
    const title = readString(record["Name"]) ?? readString(record["Title"]);
    const detailsText =
      readString(record["Description"]) ??
      readString(record["Instructions"]) ??
      readString(record["CustomInstructions"]) ??
      "";
    const dueAt =
      readDateString(record["DueDate"]) ??
      readDateString(record["EndDate"]) ??
      readDateString(record["StartDate"]);

    if (!id || !title || !dueAt) {
      return;
    }

    const points = readNumber(record["MaxPoints"]) ?? readNumber(record["Points"]) ?? 20;
    const gradeWeight = clamp(Math.round(points / 4), 5, 35);
    const complexityScore = clamp(58 + title.length / 3, 35, 88);
    const riskScore = clamp(48 + complexityScore / 4, 35, 92);
    const recentlyChanged = isRecentlyChanged(
      readDateString(record["LastModified"]) ??
        readDateString(record["LastModifiedDate"]) ??
        readDateString(record["UpdatedAt"]),
      now
    );

    items.push({
      id: `asg-${courseId}-${id}`,
      title,
      detailsText,
      type: "assignment",
      dueAt,
      estimatedMinutes: clamp(Math.round(complexityScore * 2.1), 45, 420),
      complexityScore,
      riskScore,
      gradeWeight,
      recentlyChanged
    });
  });

  return items;
}

function parseQuizItems(source: unknown, courseId: string): ParsedRawItem[] {
  const array = toArray(source);
  const items: ParsedRawItem[] = [];
  const now = Date.now();

  array.forEach((entry) => {
    const record = asRecord(entry);
    if (!record) {
      return;
    }

    const id = readId(record["Id"]);
    const title = readString(record["Name"]) ?? readString(record["Title"]);
    const detailsText =
      readString(record["Description"]) ??
      readString(record["Instructions"]) ??
      readString(record["IntroMessage"]) ??
      "";
    const dueAt =
      readDateString(record["DueDate"]) ??
      readDateString(record["EndDate"]) ??
      readDateString(record["StartDate"]);

    if (!id || !title || !dueAt) {
      return;
    }

    const points =
      readNumber(record["TotalPoints"]) ??
      readNumber(record["MaxPoints"]) ??
      readNumber(record["Points"]) ??
      15;
    const gradeWeight = clamp(Math.round(points / 3), 4, 30);
    const complexityScore = clamp(48 + title.length / 4, 30, 78);
    const riskScore = clamp(52 + complexityScore / 5, 38, 90);
    const recentlyChanged = isRecentlyChanged(
      readDateString(record["LastModified"]) ??
        readDateString(record["ModifiedDate"]) ??
        readDateString(record["UpdatedAt"]),
      now
    );

    items.push({
      id: `quiz-${courseId}-${id}`,
      title,
      detailsText,
      type: "quiz",
      dueAt,
      estimatedMinutes: clamp(Math.round(complexityScore * 1.4), 25, 200),
      complexityScore,
      riskScore,
      gradeWeight,
      recentlyChanged
    });
  });

  return items;
}

function parseDiscussionItems(source: unknown, courseId: string): ParsedRawItem[] {
  const forums = toArray(source);
  const items: ParsedRawItem[] = [];
  const now = Date.now();

  forums.forEach((forumEntry) => {
    const forum = asRecord(forumEntry);
    if (!forum) {
      return;
    }

    const forumTitle = readString(forum["Name"]) ?? "Discussion";
    const forumId = readId(forum["ForumId"]) ?? readId(forum["Id"]) ?? "forum";
    const topics = toArray((forum as Record<string, unknown>)["Topics"]);

    if (topics.length === 0) {
      const dueAt =
        readDateString(forum["DueDate"]) ??
        readDateString(forum["EndDate"]) ??
        readDateString(forum["StartDate"]);
      if (!dueAt) {
        return;
      }

      items.push({
        id: `disc-${courseId}-${forumId}`,
        title: forumTitle,
        detailsText: readString(forum["Description"]) ?? "",
        type: "discussion",
        dueAt,
        estimatedMinutes: 45,
        complexityScore: 42,
        riskScore: 40,
        gradeWeight: 8,
        recentlyChanged: isRecentlyChanged(
          readDateString(forum["LastModified"]) ??
            readDateString(forum["UpdatedAt"]) ??
            readDateString(forum["ModifiedDate"]),
          now
        )
      });
      return;
    }

    topics.forEach((topicEntry) => {
      const topic = asRecord(topicEntry);
      if (!topic) {
        return;
      }

      const topicId = readId(topic["TopicId"]) ?? readId(topic["Id"]);
      const topicTitle = readString(topic["Name"]) ?? readString(topic["Title"]);
      const dueAt =
        readDateString(topic["DueDate"]) ??
        readDateString(topic["EndDate"]) ??
        readDateString(topic["StartDate"]);

      if (!topicId || !topicTitle || !dueAt) {
        return;
      }

      items.push({
        id: `disc-${courseId}-${topicId}`,
        title: `${forumTitle}: ${topicTitle}`,
        detailsText:
          readString(topic["Description"]) ??
          readString(topic["Body"]) ??
          "",
        type: "discussion",
        dueAt,
        estimatedMinutes: 50,
        complexityScore: 45,
        riskScore: 42,
        gradeWeight: 9,
        recentlyChanged: isRecentlyChanged(
          readDateString(topic["LastModified"]) ??
            readDateString(topic["UpdatedAt"]) ??
            readDateString(topic["ModifiedDate"]),
          now
        )
      });
    });
  });

  return items;
}

function parseDiscussionTopicItems(source: unknown, courseId: string): ParsedRawItem[] {
  const topics = toArray(source);
  const items: ParsedRawItem[] = [];
  const now = Date.now();

  topics.forEach((topicEntry) => {
    const topic = asRecord(topicEntry);
    if (!topic) {
      return;
    }

    const topicId = readId(topic["TopicId"]) ?? readId(topic["Id"]);
    const topicTitle = readString(topic["Name"]) ?? readString(topic["Title"]);
    const dueAt =
      readDateString(topic["DueDate"]) ??
      readDateString(topic["EndDate"]) ??
      readDateString(topic["StartDate"]);

    if (!topicId || !topicTitle || !dueAt) {
      return;
    }

    items.push({
      id: `disc-${courseId}-${topicId}`,
      title: topicTitle,
      detailsText:
        readString(topic["Description"]) ??
        readString(topic["Body"]) ??
        "",
      type: "discussion",
      dueAt,
      estimatedMinutes: 50,
      complexityScore: 45,
      riskScore: 42,
      gradeWeight: 9,
      recentlyChanged: isRecentlyChanged(
        readDateString(topic["LastModified"]) ??
          readDateString(topic["UpdatedAt"]) ??
          readDateString(topic["ModifiedDate"]),
        now
      )
    });
  });

  return items;
}

function parseContentLinks(input: {
  source: unknown;
  user: User;
  courseId: string;
}): ContentLink[] {
  const nodes: ContentLink[] = [];
  const root = asRecord(input.source);
  const topModules = toArray(
    root?.TableOfContents ?? root?.Modules ?? root?.Items ?? input.source
  );

  function visit(
    entry: unknown,
    moduleName: string,
    lectureName: string
  ): void {
    if (nodes.length >= 80) {
      return;
    }

    const record = asRecord(entry);
    if (!record) {
      return;
    }

    const title = readString(record["Title"]) ?? readString(record["Name"]) ?? lectureName;
    const nextModule = moduleName || title || "Course module";
    const nextLecture = lectureName || title || "Lecture";

    const topics = toArray(record["Topics"]);
    topics.forEach((topicEntry) => {
      if (nodes.length >= 80) {
        return;
      }

      const topic = asRecord(topicEntry);
      if (!topic) {
        return;
      }

      const topicTitle = readString(topic["Title"]) ?? readString(topic["Name"]) ?? "Content item";
      const urlPath =
        readString(topic["Url"]) ??
        readString(topic["Link"]) ??
        readString(topic["HtmlUrl"]) ??
        readString(topic["ActivityUrl"]);
      const topicId =
        readId(topic["TopicId"]) ??
        readId(topic["Id"]) ??
        readId(topic["TopicIdentifier"]) ??
        readId(topic["Identifier"]);
      const resolvedUrl = urlPath
        ? joinUrl(input.user.institutionUrl!, urlPath)
        : topicId
          ? buildContentTopicUrl(input.user.institutionUrl!, input.courseId, topicId)
          : buildCourseContentHomeUrl(input.user.institutionUrl!, input.courseId);

      if (!isUsableStudyLink(topicTitle, resolvedUrl, nextModule, nextLecture)) {
        return;
      }

      nodes.push({
        module: nextModule,
        lecture: nextLecture,
        resource: topicTitle,
        section: readString(topic["Description"])?.slice(0, 40) ?? "Key section",
        url: resolvedUrl,
        whyRelevant: "Mapped from active course content structure.",
        confidence: 0.8
      });
    });

    const modules = toArray(record["Modules"]);
    modules.forEach((child) => {
      const childRecord = asRecord(child);
      const childTitle =
        readString(childRecord?.Title) ?? readString(childRecord?.Name) ?? nextLecture;
      visit(child, nextModule, childTitle);
    });
  }

  topModules.forEach((moduleEntry) => {
    const module = asRecord(moduleEntry);
    const moduleName = readString(module?.Title) ?? readString(module?.Name) ?? "Module";
    visit(moduleEntry, moduleName, moduleName);
  });

  if (nodes.length > 0) {
    return nodes;
  }

  return [
    {
      module: "Course content",
      lecture: "Latest lecture",
      resource: "Active learning material",
      section: "Core section",
      url: buildCourseContentHomeUrl(input.user.institutionUrl!, input.courseId),
      whyRelevant: "Fallback entry from active course shell.",
      confidence: 0.58
    }
  ];
}

function pickTaskLinkForItem(contentLinks: ContentLink[], item: ParsedRawItem): ContentLink | null {
  const tokens = tokenizeForMatching(`${item.title} ${item.detailsText}`);
  const ordinal = extractTaskOrdinal(item.title, item.type);
  const scored = contentLinks
    .map((link) => ({
      link,
      score: scoreTaskLink(link, tokens, item.type, ordinal)
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.link.confidence - a.link.confidence;
    });

  return scored[0]?.link ?? null;
}

function pickStudyLinksForItem(
  contentLinks: ContentLink[],
  item: ParsedRawItem,
  taskUrl: string | undefined
): ContentLink[] {
  if (contentLinks.length <= 3) {
    return contentLinks.filter((link) => !isTaskDetailLikeLink(link, item.type, taskUrl));
  }

  const tokens = tokenizeForMatching(`${item.title} ${item.detailsText}`);
  const scored = contentLinks
    .filter((link) => !isTaskDetailLikeLink(link, item.type, taskUrl))
    .map((link) => ({
      link,
      score: scoreStudyLink(link, tokens, item.type)
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.link.confidence - a.link.confidence;
    });

  const selected: ContentLink[] = [];
  const seenUrls = new Set<string>();
  scored.forEach((entry) => {
    if (selected.length >= 3) {
      return;
    }

    if (seenUrls.has(entry.link.url)) {
      return;
    }

    selected.push(entry.link);
    seenUrls.add(entry.link.url);
  });

  return selected;
}

function dedupeParsedItems(items: ParsedRawItem[]): ParsedRawItem[] {
  const byId = new Map<string, ParsedRawItem>();

  items.forEach((item) => {
    byId.set(item.id, item);
  });

  return Array.from(byId.values());
}

function buildChecklistDefaults(item: ParsedRawItem): ChecklistTask[] {
  if (item.type === "assignment" || item.type === "project") {
    return [
      { id: `${item.id}-ck1`, text: "Confirm submission type and rubric criteria." },
      { id: `${item.id}-ck2`, text: "Draft outline mapped to key rubric sections." },
      { id: `${item.id}-ck3`, text: "Run final formatting and checklist validation." }
    ];
  }

  if (item.type === "quiz") {
    return [
      { id: `${item.id}-ck1`, text: "Review tagged concepts from related modules." },
      { id: `${item.id}-ck2`, text: "Complete timed practice set and error review." }
    ];
  }

  return [
    { id: `${item.id}-ck1`, text: "Read prompt and identify required responses." },
    { id: `${item.id}-ck2`, text: "Post and verify all participation requirements." }
  ];
}

function estimateKnowledgeGapImpact(type: WorkItemType, riskScore: number): number {
  if (type === "quiz") {
    return clamp(55 + riskScore / 5, 50, 90);
  }

  if (type === "assignment" || type === "project") {
    return clamp(45 + riskScore / 6, 40, 82);
  }

  return clamp(35 + riskScore / 7, 30, 70);
}

function computePriorityBreakdown(input: {
  daysUntilDue: number;
  riskScore: number;
  gradeWeight: number;
  complexityScore: number;
  effortMinutes: number;
  knowledgeGapImpact: number;
}): PriorityBreakdown {
  const deadlineProximity = clamp(120 / Math.max(1, input.daysUntilDue), 0, 100);
  const effortScore = clamp(input.effortMinutes / 4, 0, 100);

  const deadlineC = deadlineProximity * 0.26;
  const riskC = input.riskScore * 0.24;
  const weightC = input.gradeWeight * 0.14;
  const complexityC = input.complexityScore * 0.15;
  const effortC = effortScore * 0.11;
  const gapC = input.knowledgeGapImpact * 0.1;

  return {
    deadlineProximity: round2(deadlineC),
    risk: round2(riskC),
    gradeWeight: round2(weightC),
    complexity: round2(complexityC),
    effort: round2(effortC),
    knowledgeGapImpact: round2(gapC),
    total: round2(deadlineC + riskC + weightC + complexityC + effortC + gapC)
  };
}

function rankWorkItemsForPlanning(items: WorkPlanContextItem[], now: Date) {
  const nowMs = now.getTime();
  const dayMs = 1000 * 60 * 60 * 24;

  return items
    .map((item) => {
      const dueAtMs = new Date(item.dueAt).getTime();
      const safeDueAtMs = Number.isNaN(dueAtMs) ? nowMs + dayMs * 365 : dueAtMs;
      const daysUntilDue = Math.max(0, Math.ceil((safeDueAtMs - nowMs) / dayMs));
      const urgencyBand = daysUntilDue <= 1 ? 0 : daysUntilDue <= 3 ? 1 : daysUntilDue <= 7 ? 2 : 3;
      const urgencyBoost = clamp(36 - daysUntilDue * 3, 0, 36);
      const recencyBoost = item.recentlyChanged ? 4 : 0;
      const rankingScore = round2(
        item.priorityScore + urgencyBoost + recencyBoost + item.riskScore * 0.05 + item.gradeWeight * 0.04
      );

      return {
        item,
        daysUntilDue,
        urgencyBand,
        dueAtMs: safeDueAtMs,
        rankingScore
      };
    })
    .sort((a, b) => {
      if (a.urgencyBand !== b.urgencyBand) {
        return a.urgencyBand - b.urgencyBand;
      }
      if (a.daysUntilDue !== b.daysUntilDue) {
        return a.daysUntilDue - b.daysUntilDue;
      }
      if (b.rankingScore !== a.rankingScore) {
        return b.rankingScore - a.rankingScore;
      }
      if (a.dueAtMs !== b.dueAtMs) {
        return a.dueAtMs - b.dueAtMs;
      }
      return a.item.title.localeCompare(b.item.title);
    });
}

function buildTopTaskReason(item: WorkPlanContextItem): string {
  const factors = [
    item.priorityBreakdown.deadlineProximity > 14 ? "deadline proximity" : null,
    item.priorityBreakdown.risk > 12 ? "risk profile" : null,
    item.priorityBreakdown.gradeWeight > 6 ? "grade weight" : null,
    item.priorityBreakdown.complexity > 8 ? "complexity load" : null
  ].filter((value): value is string => Boolean(value));

  if (factors.length === 0) {
    return "Highest leverage after weighted multi-factor ranking.";
  }

  return `Ranked highest due to ${factors.join(", ")}.`;
}

function buildCourseUrl(baseUrl: string, courseId: string): string {
  return `${baseUrl.replace(/\/$/, "")}/d2l/home/${courseId}`;
}

function buildCourseContentHomeUrl(baseUrl: string, courseId: string): string {
  return `${baseUrl.replace(/\/$/, "")}/d2l/le/content/${courseId}/Home`;
}

function buildContentTopicUrl(baseUrl: string, courseId: string, topicId: string): string {
  return `${baseUrl.replace(/\/$/, "")}/d2l/le/content/${courseId}/viewContent/${topicId}/View`;
}

function buildTaskUrl(input: {
  baseUrl: string;
  courseId: string;
  type: WorkItemType;
  itemId: string;
}): string {
  const base = input.baseUrl.replace(/\/$/, "");
  if (input.type === "assignment" || input.type === "project") {
    return buildCourseContentHomeUrl(base, input.courseId);
  }

  if (input.type === "quiz") {
    const quizId = extractSourceId(input);
    if (!quizId) {
      return buildCourseContentHomeUrl(base, input.courseId);
    }
    return `${base}/d2l/lms/quizzing/user/quiz_description.d2l?ou=${input.courseId}&qi=${quizId}`;
  }

  if (input.type === "discussion") {
    return `${base}/d2l/le/${input.courseId}/discussions/List`;
  }

  return `${base}/d2l/home/${input.courseId}`;
}

function buildSubmissionUrl(input: {
  baseUrl: string;
  courseId: string;
  type: WorkItemType;
  itemId: string;
}): string {
  const base = input.baseUrl.replace(/\/$/, "");
  if (input.type === "assignment" || input.type === "project") {
    const folder = extractSourceId(input);
    if (!folder) {
      return buildCourseContentHomeUrl(base, input.courseId);
    }
    return `${base}/d2l/lms/dropbox/user/folder_submit_files.d2l?ou=${input.courseId}&db=${folder}`;
  }

  if (input.type === "quiz") {
    const quizId = extractSourceId(input);
    if (!quizId) {
      return buildCourseContentHomeUrl(base, input.courseId);
    }
    return `${base}/d2l/lms/quizzing/user/quiz.d2l?ou=${input.courseId}&qi=${quizId}`;
  }

  if (input.type === "discussion") {
    return `${base}/d2l/le/${input.courseId}/discussions/List`;
  }

  return `${base}/d2l/home/${input.courseId}`;
}

function extractSourceId(input: {
  courseId: string;
  type: WorkItemType;
  itemId: string;
}): string {
  const prefix =
    input.type === "assignment" || input.type === "project"
      ? "asg"
      : input.type === "quiz"
        ? "quiz"
        : input.type === "discussion"
          ? "disc"
          : null;

  if (!prefix) {
    return input.itemId;
  }

  const compositePrefix = `${prefix}-${input.courseId}-`;
  if (input.itemId.startsWith(compositePrefix)) {
    return input.itemId.slice(compositePrefix.length);
  }

  const fallbackParts = input.itemId.split("-");
  if (fallbackParts.length > 2) {
    return fallbackParts.slice(2).join("-");
  }

  return input.itemId;
}

function joinUrl(base: string, path: string): string {
  try {
    return new URL(path, `${base.replace(/\/$/, "")}/`).toString();
  } catch {
    return path;
  }
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  const direct =
    record.Items ??
    record.Objects ??
    record.Topics ??
    record.Modules ??
    record.TableOfContents ??
    record.Folders ??
    record.Quizzes ??
    record.Forum;

  if (Array.isArray(direct)) {
    return direct;
  }

  return [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function readId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return null;
}

function readDateString(value: unknown): string | null {
  const text = readString(value);
  if (!text) {
    return null;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function isRecentlyChanged(dateText: string | null, nowMs = Date.now()): boolean {
  if (!dateText) {
    return false;
  }

  const changedAt = new Date(dateText).getTime();
  if (!Number.isFinite(changedAt)) {
    return false;
  }

  return nowMs - changedAt <= 1000 * 60 * 60 * 24 * 5;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function tokenizeForMatching(text: string): string[] {
  const stopWords = new Set([
    "assignment",
    "quiz",
    "discussion",
    "project",
    "lab",
    "test",
    "exam",
    "the",
    "and",
    "for",
    "with",
    "from",
    "of",
    "to",
    "pd",
    "online",
    "winter",
    "fall",
    "spring",
    "summer"
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !stopWords.has(word));
}

function scoreContentLink(link: ContentLink, tokens: string[], itemType: WorkItemType): number {
  const haystack = `${link.module} ${link.lecture} ${link.resource} ${link.section}`.toLowerCase();
  let overlap = 0;
  tokens.forEach((token) => {
    if (haystack.includes(token)) {
      overlap += 1;
    }
  });

  let score = overlap * 10 + link.confidence * 5;

  if (itemType === "quiz" && haystack.includes("practice")) {
    score += 4;
  }

  if (isGenericContentLabel(link.resource) || isGenericContentLabel(link.module)) {
    score -= 6;
  }

  if (isNavigationLikeUrl(link.url)) {
    score -= 20;
  }

  return score;
}

function scoreTaskLink(
  link: ContentLink,
  tokens: string[],
  itemType: WorkItemType,
  ordinal: number | null
): number {
  const haystack = `${link.module} ${link.lecture} ${link.resource} ${link.section} ${link.url}`.toLowerCase();
  let overlap = 0;
  tokens.forEach((token) => {
    if (haystack.includes(token)) {
      overlap += 1;
    }
  });

  let score = overlap * 9 + link.confidence * 6;

  if (itemType === "assignment" || itemType === "project") {
    if (haystack.includes("activities-and-assignments")) {
      score += 24;
    }
    if (haystack.includes("assignment")) {
      score += 12;
    }
    if (
      ordinal !== null &&
      (haystack.includes(`assignment ${ordinal}`) ||
        haystack.includes(`assignment-${ordinal}`) ||
        haystack.includes(`asg-${ordinal}`))
    ) {
      score += 20;
    }
    if (haystack.includes("rubric") || haystack.includes("instructions")) {
      score += 6;
    }
  }

  if (itemType === "quiz" || itemType === "other") {
    if (haystack.includes("quiz") || haystack.includes("test")) {
      score += 10;
    }
    if (
      ordinal !== null &&
      (haystack.includes(`quiz ${ordinal}`) || haystack.includes(`quiz-${ordinal}`))
    ) {
      score += 16;
    }
  }

  if (itemType === "discussion" && haystack.includes("discussion")) {
    score += 10;
  }

  if (isNavigationLikeUrl(link.url)) {
    score -= 30;
  }

  return score;
}

function scoreStudyLink(link: ContentLink, tokens: string[], itemType: WorkItemType): number {
  let score = scoreContentLink(link, tokens, itemType);
  const url = link.url.toLowerCase();

  if (url.includes("/d2l/le/content/")) {
    score += 8;
  }

  if (url.includes("/content/enforced/")) {
    score += 6;
  }

  if (url.includes("/modules/") || url.includes("/lecture") || url.includes("/read")) {
    score += 3;
  }

  return score;
}

function isTaskDetailLikeLink(
  link: ContentLink,
  itemType: WorkItemType,
  taskUrl: string | undefined
): boolean {
  if (taskUrl && normalizeUrl(link.url) === normalizeUrl(taskUrl)) {
    return true;
  }

  const haystack = `${link.module} ${link.lecture} ${link.resource} ${link.section} ${link.url}`.toLowerCase();

  if (
    haystack.includes("activities-and-assignments") ||
    haystack.includes("/dropbox/") ||
    haystack.includes("folder_view") ||
    haystack.includes("folder_submit") ||
    haystack.includes("rubric")
  ) {
    return true;
  }

  if ((itemType === "assignment" || itemType === "project") && haystack.includes("assignment")) {
    return true;
  }

  if (itemType === "quiz" && (haystack.includes("quiz") || haystack.includes("quizzing"))) {
    return true;
  }

  if (itemType === "discussion" && haystack.includes("discussion")) {
    return true;
  }

  return false;
}

function buildFallbackStudyLink(input: {
  baseUrl: string;
  courseId: string;
  item: ParsedRawItem;
}): ContentLink {
  const requiresExternal = needsExternalResearch(input.item);
  return {
    module: requiresExternal ? "External research" : "Course content",
    lecture: requiresExternal ? "Find supporting sources" : "Relevant module",
    resource: requiresExternal ? "Research starting points" : "Review modules tied to this task",
    section: requiresExternal ? "Evidence collection" : "Concept review",
    url: requiresExternal
      ? `https://duckduckgo.com/?q=${encodeURIComponent(input.item.title)}`
      : buildCourseContentHomeUrl(input.baseUrl, input.courseId),
    whyRelevant: requiresExternal
      ? "No direct internal match found; gather supporting external references."
      : "No direct internal page match found; start from course content modules.",
    confidence: requiresExternal ? 0.62 : 0.58
  };
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

function extractTaskOrdinal(title: string, type: WorkItemType): number | null {
  const normalized = title.toLowerCase();
  const typeWord =
    type === "assignment" || type === "project"
      ? "assignment"
      : type === "quiz"
        ? "quiz"
        : type === "discussion"
          ? "discussion"
          : null;

  if (!typeWord) {
    return null;
  }

  const match = normalized.match(new RegExp(`${typeWord}\\s*(\\d{1,2})`));
  if (!match || !match[1]) {
    return null;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function isUsableStudyLink(
  resource: string,
  url: string,
  module: string,
  lecture: string
): boolean {
  if (isNavigationLikeUrl(url)) {
    return false;
  }

  if (
    isGenericContentLabel(resource) &&
    isGenericContentLabel(module) &&
    isGenericContentLabel(lecture)
  ) {
    return false;
  }

  return true;
}

function isNavigationLikeUrl(url: string): boolean {
  const normalized = url.toLowerCase();
  return (
    normalized.includes("/d2l/home/") ||
    normalized.includes("/quizzing/") ||
    normalized.includes("/dropbox/") ||
    normalized.includes("/discussions/") ||
    normalized.includes("/grades/") ||
    normalized.includes("/calendar/") ||
    normalized.includes("/checklist/")
  );
}

function isGenericContentLabel(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("welcome") ||
    normalized.includes("course information") ||
    normalized.includes("orientation") ||
    normalized.includes("start here") ||
    normalized.includes("about this course")
  );
}

function attachExternalResearchLink(
  links: ContentLink[],
  item: ParsedRawItem,
  courseName: string
): ContentLink[] {
  const enriched = links.slice(0, 4);
  if (!needsExternalResearch(item)) {
    return enriched.slice(0, 4);
  }

  if (enriched.some((link) => link.module.toLowerCase().includes("external research"))) {
    return enriched.slice(0, 5);
  }

  const query = encodeURIComponent(`${courseName} ${item.title} research sources`);
  enriched.push({
    module: "External research",
    lecture: "Source discovery",
    resource: "Find supporting sources",
    section: "Web search",
    url: `https://duckduckgo.com/?q=${query}`,
    whyRelevant: "Task wording suggests external sources are required.",
    confidence: 0.66
  });

  return enriched.slice(0, 5);
}

function needsExternalResearch(item: ParsedRawItem): boolean {
  const text = `${item.title} ${item.detailsText}`.toLowerCase();
  return (
    text.includes("research") ||
    text.includes("sources") ||
    text.includes("citation") ||
    text.includes("literature") ||
    text.includes("external") ||
    text.includes("reference")
  );
}
