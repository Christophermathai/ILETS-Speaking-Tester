// app/api/session/set/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";

export async function POST(req: NextRequest) {
  const res = new NextResponse(); 
  const session = await getIronSession(req, res, sessionOptions); 
  const { question1, question2, question3 } = await req.json();
  session.questions = { question1, question2, question3 };
  await session.save(); 
  return res; 
}
