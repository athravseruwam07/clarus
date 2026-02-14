import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";
import { getFeatureBySlug } from "@/lib/feature-roadmap";

export default function TimelineIntelligencePage() {
  return <FeaturePlaceholder feature={getFeatureBySlug("timeline-intelligence")} />;
}
