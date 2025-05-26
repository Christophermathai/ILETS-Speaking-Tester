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

let speechClient: SpeechClient | null = null;

function getClient(): SpeechClient {
  if (speechClient) {
    return speechClient;
  }
  const b64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
  if (!b64) throw new Error("Google credentials missing");
  const creds: GoogleCredentials = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
  speechClient = new SpeechClient({ credentials: creds });
  console.log("SpeechClient initialized.");
  return speechClient;
}

function parseTime(
  ts: { seconds?: string | number | Long | null; nanos?: number | null } | string | number | null | undefined
): number {
  if (!ts) return 0;
  if (typeof ts === "object" && "seconds" in ts) {
    const secondsValue = ts.seconds instanceof Long
      ? ts.seconds.toNumber()
      : typeof ts.seconds === "string"
      ? parseFloat(ts.seconds)
      : ts.seconds || 0;
    const nanos = ts.nanos || 0;
    return (isNaN(secondsValue) ? 0 : secondsValue) + nanos / 1e9;
  }
  if (typeof ts === "string" && ts.endsWith("s")) {
    const parsed = parseFloat(ts.slice(0, -1));
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof ts === "number") return ts;
  return 0;
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const { audio, encoding, sampleRateHertz, languageCode } = body;

    if (!audio) {
      return Response.json({ error: "Audio data is missing" }, { status: 400 });
    }
    if (typeof audio !== 'string') {
      return Response.json({ error: "Audio data must be a base64 encoded string" }, { status: 400 });
    }

    const client = getClient();
    console.log("Audio data received in request body.");

    const recognitionConfig: protos.google.cloud.speech.v1.IRecognitionConfig = {
      encoding: encoding || "LINEAR16",
      sampleRateHertz: sampleRateHertz || 16000,
      languageCode: languageCode || "en-US",
      enableWordTimeOffsets: true,
      model: 'video',
    };

    const req: protos.google.cloud.speech.v1.ILongRunningRecognizeRequest = {
      audio: { content: audio },
      config: recognitionConfig,
    };

    console.log("Sending request to Speech-to-Text API (longRunningRecognize) with 'video' model...");
    const audioByteLength = audio.length * 0.75; // Approximate binary size from base64
    console.log(`Estimated audio size (binary, from base64): ~${(audioByteLength / (1024*1024)).toFixed(2)} MB`);
    if (audioByteLength > 10 * 1024 * 1024) { // Warn if > 10MB
        console.warn("Warning: Audio data is larger than 10MB, which may exceed inline content limits for Google Speech API.");
    }


    const [operation] = await client.longRunningRecognize(req);

    console.log(`Waiting for long-running operation (name: ${operation.name}) to complete...`);
    const [response] = await operation.promise();
    console.log("Long-running operation completed.");

    const results = response.results || [];
    const transcript = results
      .map(r => r.alternatives?.[0]?.transcript ?? "")
      .join("\n");

    const words: WordInfo[] = results.flatMap(r =>
      (r.alternatives?.[0]?.words ?? []).map(w => ({
        word: w.word ?? "",
        startTime: parseTime(w.startTime),
        endTime: parseTime(w.endTime),
      }))
    );

    return Response.json({ transcript, words });
  } catch (thrownError: unknown) {
    console.error("STT API Error:", thrownError);

    let statusCode = 500;
    let publicErrorMessage = "STT failed due to an unknown error";
    // errorDetailsForResponse will hold the object we want to serialize in the 'details' field.
    // Initialize with the raw error if it's an object, or a structured representation if it's a string/Error.
    let errorDetailsForResponse: unknown = null;

    if (typeof thrownError === 'object' && thrownError !== null) {
        errorDetailsForResponse = thrownError; // Default to the object itself for details
    } else if (typeof thrownError === 'string') {
        errorDetailsForResponse = { messageFromErrorString: thrownError };
    }
    // For other primitive types (number, boolean, etc.), details might remain null or be the primitive.

    if (thrownError instanceof Error) {
      publicErrorMessage = thrownError.message;
      // Overwrite/set specific details for Error instances
      errorDetailsForResponse = {
        name: thrownError.name,
        message: thrownError.message,
        // Only include stack in development for security/verbosity reasons
        stack: process.env.NODE_ENV === "development" ? thrownError.stack : undefined,
      };
    }

    // Check for Google API-like error structure (plain object with 'code')
    if (typeof thrownError === 'object' && thrownError !== null && 'code' in thrownError && typeof (thrownError as { code: unknown }).code === 'number') {
      const googleError = thrownError as { code: number, message?: string }; // Type assertion for easier access

      // If it's a Google error, we want the raw Google error object in 'details'
      errorDetailsForResponse = googleError;
      
      const specificApiMessage = googleError.message || ""; // Use Google's message if available

      switch (googleError.code) {
        case 3: // INVALID_ARGUMENT
          publicErrorMessage = `Invalid argument (Code ${googleError.code})${specificApiMessage ? ': ' + specificApiMessage : ''}. Check API configuration.`;
          statusCode = 400;
          break;
        case 7: // PERMISSION_DENIED
          publicErrorMessage = `Permission denied (Code ${googleError.code})${specificApiMessage ? ': ' + specificApiMessage : ''}. Check credentials.`;
          statusCode = 403;
          break;
        case 8: // RESOURCE_EXHAUSTED
          publicErrorMessage = `Resource exhausted (Code ${googleError.code})${specificApiMessage ? ': ' + specificApiMessage : ''}. This could be due to audio size (for inline content) or API quotas.`;
          statusCode = 413; // Payload Too Large or 429 Too Many Requests are semantic fits
          break;
        case 13: // INTERNAL
        case 14: // UNAVAILABLE
          publicErrorMessage = `Google API service issue (Code ${googleError.code})${specificApiMessage ? ': ' + specificApiMessage : ''}. Please try again later.`;
          statusCode = 503; // Service Unavailable
          break;
        default:
          // For other Google error codes, use its message if available, or a generic one
          if (specificApiMessage) {
            publicErrorMessage = specificApiMessage;
          } else if (!(thrownError instanceof Error)) { // Avoid overriding a standard Error message if Google provides no specific one
            publicErrorMessage = `Google API Error (Code: ${googleError.code})`;
          }
          // statusCode remains 500 unless a more specific one is determined
          break;
      }
    } else if (!(thrownError instanceof Error) && typeof thrownError === 'object' && thrownError !== null && 'message' in thrownError && typeof (thrownError as { message: unknown }).message === 'string') {
      // For other non-Error objects that have a 'message' property
      publicErrorMessage = (thrownError as { message: string }).message;
      // errorDetailsForResponse would have been set to thrownError earlier if it's an object.
    } else if (typeof thrownError === 'string') {
      // If the error was just a string, and not an Error object or Google object
      publicErrorMessage = thrownError;
      // errorDetailsForResponse was already set to { messageFromErrorString: thrownError }
    }

    return Response.json({ error: publicErrorMessage, details: errorDetailsForResponse }, { status: statusCode });
  }
}