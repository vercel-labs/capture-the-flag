import { NextResponse } from "next/server";
import { getAvailableCtfModels } from "@/lib/ai/models";

export async function GET() {
  const models = await getAvailableCtfModels();
  return NextResponse.json(models);
}
