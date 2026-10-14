import { json, readJson } from "@/lib/http";

// In this clone nothing is billed: the "checkout" instantly succeeds.
export async function POST(req: Request) {
  const body = await readJson<{ planType?: string }>(req);
  return json({
    ok: true,
    planType: body?.planType ?? "monthly",
    checkoutUrl: null,
    message: "This clone is free: premium is always active.",
  });
}
