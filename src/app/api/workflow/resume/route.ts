import { NextResponse } from "next/server";
import { resumeHook } from "workflow/api";

export async function POST(request: Request) {
  const { token, data } = await request.json();

  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  await resumeHook(token, data || {});

  return NextResponse.json({ success: true });
}
