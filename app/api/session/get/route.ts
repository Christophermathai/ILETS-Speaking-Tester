// app/api/session/get/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";

export async function GET(req: NextRequest) {

  const session = await getIronSession(req, new NextResponse(), sessionOptions);
  return NextResponse.json({ questions: session.questions || null });
}

