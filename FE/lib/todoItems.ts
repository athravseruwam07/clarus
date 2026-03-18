import type { WorkPlanContextResponse } from "@/lib/api";

export interface TodoItem {
  id: string;
  title: string;
  action: string;
  dueText: string;
  href: string;
}

function dueInDaysText(dueAt: string): string {
  const dueMs = new Date(dueAt).getTime();
  if (Number.isNaN(dueMs)) {
    return "due date unavailable";
  }

  const now = Date.now();
  const days = Math.ceil((dueMs - now) / (1000 * 60 * 60 * 24));

  if (days < 0) return `overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `due in ${days} days`;
}

export function buildTodoItems(
  context: WorkPlanContextResponse | null,
  options?: {
    taskLimit?: number;
    checklistPerItem?: number;
    maxItems?: number;
  }
): TodoItem[] {
  if (!context) {
    return [];
  }

  const taskLimit = options?.taskLimit ?? 3;
  const checklistPerItem = options?.checklistPerItem ?? 2;
  const maxItems = options?.maxItems ?? Number.POSITIVE_INFINITY;

  const prioritized = [...context.workItems]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, taskLimit);

  const checklistBackedTasks = prioritized.flatMap((item) => {
    const checklist = item.checklistTasks.slice(0, checklistPerItem);
    if (checklist.length === 0) {
      return [
        {
          id: `${item.id}:fallback`,
          title: item.title,
          action: `Start the next concrete step for "${item.title}".`,
          dueText: dueInDaysText(item.dueAt),
          href: item.taskUrl
        }
      ];
    }

    return checklist.map((task) => ({
      id: `${item.id}:${task.id}`,
      title: item.title,
      action: task.text,
      dueText: dueInDaysText(item.dueAt),
      href: item.taskUrl
    }));
  });

  return checklistBackedTasks.slice(0, maxItems);
}
