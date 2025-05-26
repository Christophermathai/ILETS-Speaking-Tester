"use client";

import dynamic from "next/dynamic";
import Logo from "../Component/logo";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PropagateLoader } from "react-spinners";
import { motion } from "framer-motion";
import nlp from "compromise";

// ---- TYPES ----

interface STTWord {
  word: string;
  startTime: number;
  endTime: number;
}

interface STTResult {
  transcript: string;
  words: STTWord[];
}

interface IELTSMetric {
  speech_rate_wpm: number;
  pause_count: number;
  mean_pause_duration: number;
  filler_word_count: number;
  duration_seconds: number;
  articulation_rate_wpm: number;
  repetition_count: number;
  grammar_errors: string[];
  vocab_richness: number;
}

interface SectionResult {
  question: string;
  answer_transcript: string;
  words: STTWord[];
  metrics: IELTSMetric;
}

interface SessionQuestions {
  question1: string;
  question2: string;
  question3: string;
}

interface SessionApiResponse {
  questions: SessionQuestions;
}

// --- AUDIO HELPERS ---

function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: "audio/wav" });
}

function resampleTo16kHz(
  buffer: Float32Array,
  fromSampleRate: number
): Float32Array {
  if (fromSampleRate === 16000) return buffer;
  const ratio = fromSampleRate / 16000;
  const newLength = Math.floor(buffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const pos = i * ratio;
    const left = Math.floor(pos);
    const right = Math.min(left + 1, buffer.length - 1);
    const frac = pos - left;
    result[i] = buffer[left] * (1 - frac) + buffer[right] * frac;
  }
  return result;
}

const wavBlobToBase64 = async (wavBlob: Blob): Promise<string> => {
  const arrayBuffer = await wavBlob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const sendWavToSTT = async (wavBlob: Blob): Promise<STTResult> => {
  const audioBase64 = await wavBlobToBase64(wavBlob);

  const res = await fetch("/api/Conversion/speech-to-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audio: audioBase64,
      encoding: "LINEAR16",
      sampleRateHertz: 16000,
      languageCode: "en-US",
    }),
  });

  const data: STTResult = await res.json();
  return {
    transcript: data.transcript ?? "",
    words: data.words ?? [],
  };
};

// --- IELTS SPEAKING METRICS HELPERS ---

function calcIELTSMetrics(
  transcript: string,
  words: STTWord[]
): IELTSMetric | null {
  if (!words || words.length === 0) return null;

  // Duration
  const duration = words[words.length - 1].endTime - words[0].startTime;

  // Speech Rate
  const totalWords = words.length;
  const durationMinutes = duration / 60;
  const speechRate = durationMinutes > 0 ? totalWords / durationMinutes : 0;

  // Pauses
  let pauseCount = 0;
  let pauseTotal = 0;
  let speakingTime = 0;
  for (let i = 1; i < words.length; i++) {
    const pause = words[i].startTime - words[i - 1].endTime;
    if (pause > 0.5) {
      pauseCount++;
      pauseTotal += pause;
    }
    speakingTime += words[i].endTime - words[i].startTime;
  }
  speakingTime += words[0].endTime - words[0].startTime;

  const meanPauseDuration = pauseCount > 0 ? pauseTotal / pauseCount : 0;
  const articulationRate =
    speakingTime > 0 ? totalWords / (speakingTime / 60) : 0;

  // Filler words
  const fillerWords = ["um", "uh", "erm", "like", "you know"] as const;
  const fillerWordCount = words.filter((w) =>
    fillerWords.includes(w.word.toLowerCase() as (typeof fillerWords)[number])
  ).length;

  // Repetition Count
  const doc = nlp(transcript);
  const terms = doc
    .terms()
    .out("array")
    .map((w: string) => w.toLowerCase());
  let repetitionCount = 0;
  for (let i = 1; i < terms.length; i++) {
    if (terms[i] === terms[i - 1]) repetitionCount++;
  }

  // Vocabulary richness
  const uniqueWords = new Set(terms);
  const vocabRichness = terms.length > 0 ? uniqueWords.size / terms.length : 0;

  const sentencesData = doc.sentences().json();
  const grammarErrorSentences: string[] = [];

  sentencesData.forEach((s: { text: string; verbs?: string[] }) => {
    if (s.verbs && s.verbs.length === 0) {
      grammarErrorSentences.push(s.text);
    }
  });

  return {
    speech_rate_wpm: Math.round(speechRate),
    pause_count: pauseCount,
    mean_pause_duration: Number(meanPauseDuration.toFixed(2)),
    filler_word_count: fillerWordCount,
    duration_seconds: Number(duration.toFixed(2)),
    articulation_rate_wpm: Math.round(articulationRate),
    repetition_count: repetitionCount,
    grammar_errors: grammarErrorSentences,
    vocab_richness: Number(vocabRichness.toFixed(2)),
  };
}

// Framer Motion (dynamic import for SSR)
const MotionDiv = dynamic(
  () => import("framer-motion").then((mod) => mod.motion.div),
  { ssr: false }
);
const MotionButton = dynamic(
  () => import("framer-motion").then((mod) => mod.motion.button),
  { ssr: false }
);

export default function Test() {
  const router = useRouter();
  const [question, setQuestion] = useState<string[]>(["", "", ""]);
  const [index, setIndex] = useState<number>(0);
  const [time, setTime] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [donerecorde, setDonerecorde] = useState<boolean>(false);
  const [recording, setRecording] = useState<boolean>(false);
  const [wavUrl, setWavUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sttResult, setSttResult] = useState<STTResult | null>(null);
  const [metrics, setMetrics] = useState<IELTSMetric | null>(null);
  const [sessionResults, setSessionResults] = useState<SectionResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const wavBlobRef = useRef<Blob | null>(null);
  console.log(sessionResults);
  const phrases = [
    "Brewing the test…",
    "Warming up your grammar engines…",
    "Preparing your vocabulary arsenal…",
    "Proofreading your readiness…",
    "Aligning syntax and semantics…",
    "Building your comprehension power…",
    "Crafting perfect paragraphs…",
    "Lighting up your language neurons…",
    "Gathering your lexical gems…",
    "Loading the language challenge…",
  ];

  // Cycle through phrases during loading
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (isLoading) {
      interval = setInterval(() => {
        setCurrentPhraseIndex((prevIndex) => (prevIndex + 1) % phrases.length);
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading, phrases.length]);

  // Fetch session questions
  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        const res = await fetch("/api/session/get");
        if (!res.ok) throw new Error("Failed to fetch session data");
        const data: SessionApiResponse = await res.json();
        setQuestion([
          data.questions.question1,
          data.questions.question2,
          data.questions.question3,
        ]);
      } catch (err) {
        setError(
          `Failed to load questions: ${
            err instanceof Error ? err.message : "Unknown error"
          }`
        );
      }
    };
    fetchSessionData();
  }, []);

  // Timer logic
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (isRunning) {
      intervalId = setInterval(() => setTime((prev) => prev + 1), 10);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isRunning]);

  // Cleanup audio resources
  useEffect(() => {
    return () => {
      if (wavUrl) URL.revokeObjectURL(wavUrl);
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream
            .getTracks()
            .forEach((track) => track.stop());
        }
      } catch {}
    };
  }, [wavUrl]);

  const phraseVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const reset = () => setTime(0);

  const handleStartAgain = () => {
    if (sttResult && metrics) {
      const sectionObj: SectionResult = {
        question: question[index],
        answer_transcript: sttResult.transcript,
        words: sttResult.words,
        metrics,
      };
      setSessionResults((prev) => [...prev, sectionObj]);
    }
    setIndex(index + 1);
    reset();
    setIsRunning(false);
    if (wavUrl) URL.revokeObjectURL(wavUrl);
    setWavUrl(null);
    setError(null);
    setSttResult(null);
    setMetrics(null);
    wavBlobRef.current = null;
    setDonerecorde(false);
  };

  const submit = () => {
    if (sttResult && metrics) {
      const sectionObj: SectionResult = {
        question: question[index],
        answer_transcript: sttResult.transcript,
        words: sttResult.words,
        metrics,
      };
      setSessionResults((prev) => {
        const allSections = [...prev, sectionObj];
        if (typeof window !== "undefined") {
          sessionStorage.setItem("ielts_sections", JSON.stringify(allSections));
        }
        return allSections;
      });
    }
    router.push("/Result");
  };

  const startRecording = async () => {
    setError(null);
    setSttResult(null);
    setMetrics(null);
    if (wavUrl) {
      URL.revokeObjectURL(wavUrl);
      setWavUrl(null);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1 },
      });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.onstart = () => {
        setIsRunning(true);
        setRecording(true);
      };

      mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        setRecording(false);
        setIsRunning(false);
        setIsLoading(true);
        const timeout = setTimeout(() => {
          setIsLoading(false);
          setError("Transcription timed out. Please try again.");
        }, 10000);

        try {
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          audioChunksRef.current = [];
          const buffer = await blob.arrayBuffer();
          const audioCtx = new AudioContext();
          const audioBuffer = await audioCtx.decodeAudioData(buffer);
          const channelData = new Float32Array(audioBuffer.getChannelData(0));
          const resampled = resampleTo16kHz(
            channelData,
            audioBuffer.sampleRate
          );
          const wavBlob = encodeWAV(resampled, 16000);
          wavBlobRef.current = wavBlob;
          const url = URL.createObjectURL(wavBlob);
          setWavUrl(url);
          audioCtx.close();

          // Automatic Transcribe & Score
          const result = await sendWavToSTT(wavBlob);
          setSttResult(result);
          setDonerecorde(true);
          const metricsObj = calcIELTSMetrics(result.transcript, result.words);
          setMetrics(metricsObj);
        } catch (err) {
          setError(
            `Could not decode or transcribe recording: ${
              err instanceof Error ? err.message : "Unknown error"
            }`
          );
        } finally {
          clearTimeout(timeout);
          setIsLoading(false);
        }

        // Stop media stream tracks
        if (mediaRecorderRef.current?.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
        }
      };

      mediaRecorderRef.current.start();
    } catch (err) {
      alert(
        `Microphone permission denied: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    setIsRunning(false);
  };

  const minutes = Math.floor((time % 360000) / 6000);
  const seconds = Math.floor((time % 6000) / 100);
  const milliseconds = time % 100;

  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut", staggerChildren: 0.2 },
    },
  } as const;

  return (
    <div className="bg-[#0A1E2E] min-h-screen flex items-center justify-center px-4">
      <div className="flex flex-col items-center text-white w-full">
        <Logo />

        <MotionDiv
          className="w-full max-w-3xl max-h-xl bg-white rounded-xl shadow-lg flex flex-col md:flex-row overflow-hidden"
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
        >
          {/* Timer Section */}
          <div
            className="w-full md:w-1/2 p-8 sm:p-10 bg-repeat bg-[length:120px_120px] flex flex-col items-center justify-center"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'%3E%3Cpath d='M0 50 Q 25 25, 50 50 T 100 50' fill='none' stroke='%23222' stroke-width='1'/%3E%3Cpath d='M0 60 Q 25 35, 50 60 T 100 60' fill='none' stroke='%23222' stroke-width='1'/%3E%3Cpath d='M0 70 Q 25 45, 50 70 T 100 70' fill='none' stroke='%23222' stroke-width='1'/%3E%3Cpath d='M0 80 Q 25 55, 50 80 T 100 80' fill='none' stroke='%23222' stroke-width='1'/%3E%3C/svg%3E")`,
            }}
          >
            <div className="w-12 h-12 mb-6 rounded-full border-2 border-black flex items-center justify-center">
              <div className="w-5 h-1 bg-black rounded-full"></div>
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-black">
              {minutes.toString().padStart(2, "0")}:
              {seconds.toString().padStart(2, "0")}:
              {milliseconds.toString().padStart(2, "0")}
            </p>
          </div>

          {/* Question Section */}
          <div className="w-full md:w-1/2 p-8 sm:p-10 flex flex-col justify-between">
            <div>
              <h2 className="text-2xl sm:text-3xl font-semibold text-black mb-6 my-text">
                {question[index]}
              </h2>
            </div>
            <div className="flex flex-row gap-5 align-end">
              <MotionButton
                className={`self-end mt-6 px-6 py-3 bg-black text-white rounded-full hover:bg-gray-800 transition-colors text-base sm:text-lg ${
                  isLoading || donerecorde
                    ? "opacity-50 cursor-not-allowed disabled:bg-transparent"
                    : ""
                }`}
                onClick={recording ? stopRecording : startRecording}
                style={{ fontFamily: "MyFont" }}
                variants={sectionVariants}
                disabled={isLoading || donerecorde}
              >
                {recording ? "Stop" : "Start"}
              </MotionButton>
              <MotionButton
                className={`self-end mt-6 px-6 py-3 bg-black text-white rounded-full hover:bg-gray-800 transition-colors text-base sm:text-lg disabled:bg-transparent disabled:cursor-not-allowed`}
                onClick={index > 1 ? submit : handleStartAgain}
                style={{ fontFamily: "MyFont" }}
                variants={sectionVariants}
                disabled={isLoading || !donerecorde}
              >
                {index < 2 ? "Next" : "Finish"}
              </MotionButton>
            </div>
          </div>
        </MotionDiv>

        {/* Full-Screen Loader */}
        {isLoading && (
          <MotionDiv
            className="fixed inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <PropagateLoader color="#00D4FF" size={15} speedMultiplier={1} />
            <motion.span
              className="mt-4 text-white text-lg"
              key={currentPhraseIndex}
              variants={phraseVariants}
              initial="hidden"
              animate="visible"
            >
              {phrases[currentPhraseIndex]}
            </motion.span>
          </MotionDiv>
        )}

        {/* Audio Controls */}
        <div className="p-4">
          {error && <div className="text-red-400 mt-1">{error}</div>}
          {wavUrl && (
            <div className="mt-4 space-y-2">
              <h3>Playback (16kHz WAV)</h3>
              <audio controls src={wavUrl}></audio>
              <a
                href={wavUrl}
                download="response-16khz.wav"
                className="block text-blue-300 mt-2 underline"
              >
                Download 16kHz WAV
              </a>
              {sttResult && metrics && (
                <div className="bg-gray-100 text-black p-3 rounded-lg mt-2">
                  <p>
                    <b>Transcript:</b> {sttResult.transcript}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
