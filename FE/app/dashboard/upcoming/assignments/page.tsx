import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const placeholders = [
  { title: "Problem Set Draft", course: "Thermodynamics", due: "Due: TBD", priority: "high" as const },
  { title: "Lab Writeup", course: "Physics Lab", due: "Due: TBD", priority: "medium" as const },
  { title: "Reading Reflection", course: "Humanities", due: "Due: TBD", priority: "low" as const },
  { title: "Project Milestone", course: "Design Studio", due: "Due: TBD", priority: "high" as const }
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

export default function UpcomingAssignmentsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Assignments</CardTitle>
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

