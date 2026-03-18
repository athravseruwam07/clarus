"use client";

import { AlertCircle, ListTodo, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError, getWorkPlanContext, type WorkPlanContextResponse } from "@/lib/api";
import TodoChecklist from "@/components/todo/TodoChecklist";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dataCache } from "@/lib/dataCache";
import { buildTodoItems } from "@/lib/todoItems";

export default function TodoPage() {
  const [context, setContext] = useState<WorkPlanContextResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkedTodoIds, setCheckedTodoIds] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    const cached = dataCache.workPlanContext.get();
    if (cached) {
      setContext(cached);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const payload = await getWorkPlanContext();
      dataCache.workPlanContext.set(payload);
      setContext(payload);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to load to-do items.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const todoItems = useMemo(
    () => buildTodoItems(context, { taskLimit: 8, checklistPerItem: 2, maxItems: 16 }),
    [context]
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <ListTodo className="h-5 w-5 text-primary" />
          To Do
        </h1>
        <p className="text-sm text-muted-foreground">
          A focused list of the next concrete tasks from your active coursework.
        </p>
      </div>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load to-do list</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {todoItems.length === 0 ? "No active to-do items" : `${todoItems.length} active to-do item${todoItems.length === 1 ? "" : "s"}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm text-muted-foreground">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading tasks...
            </div>
          ) : todoItems.length > 0 ? (
            <TodoChecklist
              items={todoItems}
              checkedIds={checkedTodoIds}
              onToggle={(id, checked) =>
                setCheckedTodoIds((prev) => ({
                  ...prev,
                  [id]: checked
                }))
              }
            />
          ) : (
            <p>No active to-do items yet. Run sync to load upcoming coursework tasks.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
