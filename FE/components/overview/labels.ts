import type { TimelineDateKind, TimelineEventDTO } from "@/lib/api";

export function dateKindLabel(kind: TimelineDateKind): string {
  switch (kind) {
    case "start":
      return "Starts";
    case "due":
      return "Due";
    case "end":
      return "Ends";
    case "event":
      return "Event";
    default:
      return "When";
  }
}

export function associatedEntityLabel(type: string | null | undefined): string {
  if (!type) return "Unlinked";
  if (type === "D2L.LE.Dropbox.Dropbox") return "Dropbox assignment";
  if (type === "D2L.LE.Quizzing.Quiz") return "Quiz";
  if (type === "D2L.LE.Content.ContentObject.TopicCO") return "Content item";
  return "Linked item";
}

export function sourceLabel(event: Pick<TimelineEventDTO, "sourceType" | "dateKind">): string {
  if (event.sourceType === "calendar" && event.dateKind === "event") return "Brightspace calendar event";
  if (event.sourceType === "dropbox_folder") return "Brightspace dropbox";
  if (event.sourceType === "quiz") return "Brightspace quiz";
  if (event.sourceType === "content_topic") return "Brightspace content";
  if (event.sourceType === "content_module") return "Brightspace content";
  if (event.sourceType === "discussion_forum" || event.sourceType === "discussion_topic") return "Brightspace discussion";
  if (event.sourceType === "checklist") return "Brightspace checklist";
  return "Brightspace";
}

