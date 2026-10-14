import { json } from "@/lib/http";
import { withStore } from "@/lib/store";
import { getCurrentJob } from "@/lib/generation";

// GET /api/generation/status -> { status, path? } (contract §11).
// The client polls this every 4s and navigates to `path` once done. The job
// lives in the persisted store (any instance can answer) and expires ~10 min
// after it finished, after which this returns 404 no_generation.
async function handleGET() {
  const job = getCurrentJob();
  if (!job) return json({ error: "no_generation" }, { status: 404 });

  return json(job.path ? { status: job.status, path: job.path } : { status: job.status });
}

export const GET = withStore(handleGET);
