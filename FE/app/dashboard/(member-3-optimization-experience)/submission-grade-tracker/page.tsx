import { FeaturePlaceholder } from "@/components/features/FeaturePlaceholder";
import { getFeatureBySlug } from "@/lib/feature-roadmap";

export default function SubmissionGradeTrackerPage() {
  return <FeaturePlaceholder feature={getFeatureBySlug("submission-grade-tracker")} />;
}
