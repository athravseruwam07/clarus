import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";
import { getFeatureBySlug } from "@/lib/feature-roadmap";

export default function SmartRemindersPage() {
  return <FeaturePlaceholder feature={getFeatureBySlug("smart-reminders")} />;
}
