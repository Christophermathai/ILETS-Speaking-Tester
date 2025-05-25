import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";

// Define the structure of your session data
interface SessionData {
  questions?: {
    question1: string;
    question2: string;
    question3: string;
  };
}

export async function POST(req: NextRequest) {
  const res = new NextResponse();

  // Explicitly type the session with your custom session data structure
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  const { question1, question2, question3 } = await req.json();

  // Assign the `questions` property to the session
  session.questions = { question1, question2, question3 };

  // Save the session
  await session.save();

  return res;
}