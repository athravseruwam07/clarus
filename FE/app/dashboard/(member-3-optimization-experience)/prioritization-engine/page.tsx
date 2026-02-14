import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";
import { getFeatureBySlug } from "@/lib/feature-roadmap";

export default function PrioritizationEnginePage() {
  return <FeaturePlaceholder feature={getFeatureBySlug("prioritization-engine")} />;
}
