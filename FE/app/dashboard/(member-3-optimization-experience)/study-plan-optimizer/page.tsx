import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";
import { getFeatureBySlug } from "@/lib/feature-roadmap";

export default function StudyPlanOptimizerPage() {
  return <FeaturePlaceholder feature={getFeatureBySlug("study-plan-optimizer")} />;
}
