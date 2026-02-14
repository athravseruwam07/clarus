import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";
import { getFeatureBySlug } from "@/lib/feature-roadmap";

export default function ContentLocatorPage() {
  return <FeaturePlaceholder feature={getFeatureBySlug("content-locator")} />;
}
