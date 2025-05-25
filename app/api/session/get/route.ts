import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";

// Extend the session type inline (temporary)
export async function GET(req: NextRequest) {
  const session = await getIronSession(req, new NextResponse(), sessionOptions) as {
    questions?: {
      question1: string;
      question2: string;
      question3: string;
    };
  };

  return NextResponse.json({ questions: session.questions || null });
}