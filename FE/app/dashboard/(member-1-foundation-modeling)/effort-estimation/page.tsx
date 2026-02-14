import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";
import { getFeatureBySlug } from "@/lib/feature-roadmap";

export default function EffortEstimationPage() {
  return <FeaturePlaceholder feature={getFeatureBySlug("effort-estimation")} />;
}
