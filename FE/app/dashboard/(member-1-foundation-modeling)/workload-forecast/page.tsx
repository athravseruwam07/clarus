import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";
import { getFeatureBySlug } from "@/lib/feature-roadmap";

export default function WorkloadForecastPage() {
  return <FeaturePlaceholder feature={getFeatureBySlug("workload-forecast")} />;
}
