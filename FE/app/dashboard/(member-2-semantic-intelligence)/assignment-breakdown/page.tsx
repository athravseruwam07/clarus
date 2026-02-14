import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";
import { getFeatureBySlug } from "@/lib/feature-roadmap";

export default function AssignmentBreakdownPage() {
  return <FeaturePlaceholder feature={getFeatureBySlug("assignment-breakdown")} />;
}
