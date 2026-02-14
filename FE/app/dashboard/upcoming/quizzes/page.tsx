import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const placeholders = [
  { title: "Quiz: Chapter 6", course: "Thermodynamics", due: "Window: TBD", priority: "high" as const },
  { title: "Quiz: Kinematics", course: "Physics", due: "Window: TBD", priority: "medium" as const },
  { title: "Quiz: SQL Basics", course: "Intro CS", due: "Window: TBD", priority: "low" as const }
];

function priorityVariant(priority: (typeof placeholders)[number]["priority"]) {
  if (priority === "high") {
    return "destructive";
  }
  if (priority === "medium") {
    return "default";
  }
  return "secondary";
}

export default function UpcomingQuizzesPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Quizzes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {placeholders.map((item) => (
            <div
              key={`${item.course}-${item.title}`}
              className="flex items-start justify-between gap-3 rounded-md border border-border/80 bg-secondary/30 px-3 py-2 transition-colors hover:bg-secondary/50"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.course} · {item.due}
                </p>
              </div>
              <Badge variant={priorityVariant(item.priority)}>{item.priority} priority</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

