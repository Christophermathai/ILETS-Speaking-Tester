// app/api/question/route.js (or route.ts if using TypeScript)

import { NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb"; // adjust path as needed

export async function POST(request) {
  try {
    const { question1, question2, question3 } = await request.json();

    if (!question1 || !question2 || !question3) {
      return NextResponse.json({ error: "All three questions are required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("speaking");

    const timeId = new Date().getTime().toString();

    const result1 = await db.collection("question1").insertOne({
      id: timeId,
      question: question1,
      count: 1,
    });

    const result2 = await db.collection("question2").insertOne({
      id: timeId,
      question: question2,
      count: 1,
    });

    const result3 = await db.collection("question3").insertOne({
      id: timeId,
      question: question3,
      count: 1,
    });

    return NextResponse.json({
      message: "Questions saved successfully",
      insertedIds: [result1.insertedId, result2.insertedId, result3.insertedId],
    }, { status: 201 });

  } catch (e) {
    console.error("Error in POST /api/question:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
