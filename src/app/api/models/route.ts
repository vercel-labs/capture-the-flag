import { NextResponse } from "next/server";
import { CTF_ELIGIBLE_MODELS } from "@/lib/ai/models";

export async function GET() {
  return NextResponse.json(CTF_ELIGIBLE_MODELS);
}
