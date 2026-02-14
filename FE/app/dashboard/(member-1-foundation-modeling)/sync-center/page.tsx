import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";
import { getFeatureBySlug } from "@/lib/feature-roadmap";

export default function SyncCenterPage() {
  return <FeaturePlaceholder feature={getFeatureBySlug("sync-center")} />;
}
