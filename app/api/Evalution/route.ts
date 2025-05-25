import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY!;
  const { prompt } = await request.json();

  const geminiEndpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  };

  const result = await fetch(geminiEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await result.json();
  return Response.json(data);
}