import { json } from "@/lib/http";

// Fallback for every contract endpoint not implemented yet: return an empty
// 200 so the UI degrades gracefully instead of erroring. Replace with real
// handlers as the clone grows.
export function GET() {
  return json({});
}
export function POST() {
  return json({});
}
export function PUT() {
  return json({});
}
export function PATCH() {
  return json({});
}
export function DELETE() {
  return json({});
}
