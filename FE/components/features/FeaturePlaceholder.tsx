import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { laneLabels, type FeatureRoadmapItem } from "@/lib/feature-roadmap";

const statusLabel: Record<FeatureRoadmapItem["status"], string> = {
  "foundation-ready": "foundation ready",
  scaffolded: "placeholder scaffolded"
};

export function FeaturePlaceholder({ feature }: { feature: FeatureRoadmapItem }) {
  return (
    <section className="space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{statusLabel[feature.status]}</Badge>
            <Badge variant="secondary">{laneLabels[feature.lane]}</Badge>
          </div>
          <CardTitle>{feature.title}</CardTitle>
          <CardDescription>{feature.summary}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-border/80 bg-secondary/25 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              frontend workspace
            </p>
            <p className="font-mono text-xs text-foreground">{feature.frontendWorkspace}</p>
          </div>
          <div className="space-y-2 rounded-lg border border-border/80 bg-secondary/25 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              backend workspace
            </p>
            <p className="font-mono text-xs text-foreground">{feature.backendWorkspace}</p>
          </div>
          <div className="space-y-2 rounded-lg border border-border/80 bg-secondary/25 p-4 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              ownership focus
            </p>
            <p className="text-sm text-foreground">{feature.ownership}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">planned api contracts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {feature.backendContracts.map((contract) => (
                <li key={contract} className="font-mono text-xs text-foreground/90">
                  {contract}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">starter checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {feature.starterChecklist.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
