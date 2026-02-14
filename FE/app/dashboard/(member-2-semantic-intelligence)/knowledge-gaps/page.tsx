import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";
import { getFeatureBySlug } from "@/lib/feature-roadmap";

export default function KnowledgeGapsPage() {
  return <FeaturePlaceholder feature={getFeatureBySlug("knowledge-gaps")} />;
}
