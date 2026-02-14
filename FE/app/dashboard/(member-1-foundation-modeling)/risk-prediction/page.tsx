import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";
import { getFeatureBySlug } from "@/lib/feature-roadmap";

export default function RiskPredictionPage() {
  return <FeaturePlaceholder feature={getFeatureBySlug("risk-prediction")} />;
}
