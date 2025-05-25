import { NextRequest } from "next/server";
import { SpeechClient } from "@google-cloud/speech";

const client = new SpeechClient({
  keyFilename: "gen-lang-client-0194573509-78372063deb0.json",
});

function parseTime(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === "object" && ("seconds" in ts)) {
    return Number(ts.seconds) + Number(ts.nanos || 0) / 1e9;
  }
  if (typeof ts === "string" && ts.endsWith("s")) {
    return parseFloat(ts.slice(0, -1));
  }
  if (typeof ts === "number") return ts;
  return 0;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audio, encoding, sampleRateHertz, languageCode } = body;

    const req = {
      audio: { content: audio },
      config: {
        encoding: encoding || "LINEAR16",
        sampleRateHertz: sampleRateHertz || 16000,
        languageCode: languageCode || "en-US",
        enableWordTimeOffsets: true,
      },
    };

    const [response] = await client.recognize(req);
    const results = response.results || [];
    const transcript = results.map(r => r.alternatives?.[0]?.transcript ?? '').join('\n');
    const words = results.flatMap(r =>
      (r.alternatives?.[0]?.words ?? []).map(w => ({
        word: w.word,
        startTime: parseTime(w.startTime),
        endTime: parseTime(w.endTime),
      }))
    );
    return Response.json({ transcript, words });

  } catch (error: any) {
    console.error(error);
    return Response.json({ error: error.message || "STT failed" }, { status: 500 });
  }
}