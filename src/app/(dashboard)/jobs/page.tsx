import { Suspense } from "react";
import { JobsExplorer } from "@/components/jobs/JobsExplorer";
import { LoadingSpinner } from "@/components/ui";

export default function JobsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <LoadingSpinner size="lg" label="画面を読み込み中…" />
        </div>
      }
    >
      <JobsExplorer />
    </Suspense>
  );
}
