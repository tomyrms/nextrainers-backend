import { connection } from "next/server";
import { json } from "@/lib/http";
import { getCurrentJob } from "@/lib/generation";

// GET /api/generation/status -> { status, path? } (contract §11).
// The client polls this every 4s and navigates to `path` once done. Read the
// in-memory job per request, so always render dynamically.
export async function GET() {
  await connection();

  const job = getCurrentJob();
  if (!job) return json({ error: "no_generation" }, { status: 404 });

  return json(job.path ? { status: job.status, path: job.path } : { status: job.status });
}
