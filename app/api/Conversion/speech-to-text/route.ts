import { NextRequest } from "next/server";
import { SpeechClient, protos } from "@google-cloud/speech";
import Long from "long";

interface GoogleCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

interface WordInfo {
  word: string;
  startTime: number;
  endTime: number;
}

function getClient(): SpeechClient {
  const b64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
  if (!b64) throw new Error("Google credentials missing");
  const creds: GoogleCredentials = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
  return new SpeechClient({ credentials: creds });
}

function parseTime(
  ts: { seconds?: string | number | Long | null; nanos?: number | null } | string | number | null | undefined
): number {
  if (!ts) return 0;
  if (typeof ts === "object" && "seconds" in ts) {
    const seconds = ts.seconds instanceof Long
      ? ts.seconds.toNumber() // Convert Long to number
      : typeof ts.seconds === "string"
      ? parseFloat(ts.seconds) // Convert string to number
      : ts.seconds || 0; // Use number directly
    const nanos = ts.nanos || 0;
    return seconds + nanos / 1e9;
  }
  if (typeof ts === "string" && ts.endsWith("s")) {
    return parseFloat(ts.slice(0, -1));
  }
  if (typeof ts === "number") return ts;
  return 0;
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const { audio, encoding, sampleRateHertz, languageCode } = body;

    const client = getClient();

    const req: protos.google.cloud.speech.v1.IRecognizeRequest = {
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
    const transcript = results
      .map(r => r.alternatives?.[0]?.transcript ?? "")
      .join("\n");
    const words: WordInfo[] = results.flatMap(r =>
      (r.alternatives?.[0]?.words ?? []).map(w => ({
        word: w.word ?? "", // Ensure word is always a string
        startTime: parseTime(w.startTime),
        endTime: parseTime(w.endTime),
      }))
    );
    return Response.json({ transcript, words });
  } catch (error: unknown) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : "STT failed";
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}