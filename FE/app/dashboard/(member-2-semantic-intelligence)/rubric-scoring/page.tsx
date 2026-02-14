import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";
import { getFeatureBySlug } from "@/lib/feature-roadmap";

export default function RubricScoringPage() {
  return <FeaturePlaceholder feature={getFeatureBySlug("rubric-scoring")} />;
}
