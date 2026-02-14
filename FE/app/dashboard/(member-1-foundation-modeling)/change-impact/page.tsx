import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";
import { getFeatureBySlug } from "@/lib/feature-roadmap";

export default function ChangeImpactPage() {
  return <FeaturePlaceholder feature={getFeatureBySlug("change-impact")} />;
}
