"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Logo from "../Component/logo";
import { useEffect, useState } from "react";
import { PropagateLoader } from "react-spinners";

// --- TYPES ---
type STTWord = {
  word: string;
  startTime: number;
  endTime: number;
};

type IELTSMetric = {
  speech_rate_wpm: number;
  articulation_rate_wpm: number;
  pause_count: number;
  mean_pause_duration: number;
  filler_word_count: number;
  repetition_count: number;
  grammar_errors: string[];
  vocab_richness: number;
  duration_seconds: number;
};

type SectionResult = {
  question: string;
  answer_transcript: string;
  words: STTWord[];
  metrics: IELTSMetric;
};

const MotionDiv = dynamic(
  () => import("framer-motion").then((mod) => mod.motion.div),
  { ssr: false }
);
const MotionButton = dynamic(
  () => import("framer-motion").then((mod) => mod.motion.button),
  { ssr: false }
);

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut", staggerChildren: 0.2 },
  },
};

const patternSvg = `
  <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
    <pattern id="wave" patternUnits="userSpaceOnUse" width="60" height="60">
      <path d="M 0 30 Q 15 0 30 30 T 60 30" fill="transparent" stroke="black" strokeWidth="1"/>
    </pattern>
    <rect width="100%" height="100%" fill="url(#wave)" />
  </svg>
`;

const metricLabels: Record<keyof IELTSMetric, string> = {
  speech_rate_wpm: "Speech Rate (wpm)",
  articulation_rate_wpm: "Articulation Rate (wpm)",
  pause_count: "Pauses (#)",
  mean_pause_duration: "Mean Pause (s)",
  filler_word_count: "Filler Words (#)",
  repetition_count: "Repetition Count",
  grammar_errors: "Grammar Errors",
  vocab_richness: "Vocabulary Richness",
  duration_seconds: "Duration (s)",
};

const Result = () => {
  const router = useRouter();
  const [sections, setSections] = useState<SectionResult[]>([]);
  const [geminiResult, setGeminiResult] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const data = sessionStorage.getItem("ielts_sections");
      if (data) setSections(JSON.parse(data));

      // Only call Gemini API if data present
      if (data) {
        const prompt = `
You are an IELTS Speaking examiner.

Here are three sections of a candidate's speaking test. For each section:
- The question is shown,
- The candidate's answer transcript,
- Metrics: speech rate, pauses, filler words, articulation rate, repetition, grammar errors (with sentences), vocabulary richness, and duration.

Based on all this information, please:
1. Assign an IELTS Band Score (0-9, with 0.5 increments) for each section and an overall score.
2. Briefly justify the scoring in terms of Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, and Pronunciation.
3. Suggest one or two specific areas for improvement.
4. section 2 must be about minmium 2 mintues

Here is the data:
${data}

Please respond Only in this format:
Section 1: Band X – [Justification]
(space)
Section 2: Band X – [Justification]
(space)
Section 3: Band X – [Justification]
Overall Band: X – [Summary and improvement advice]
`;

        // Call Gemini evaluation API (use your own backend proxy)
        fetch("/api/Evalution", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        })
          .then((res) => res.json())
          .then((json) => {
            // Adjust parsing depending on Gemini API response
            const answer =
              json.candidates?.[0]?.content?.parts?.[0]?.text ||
              json.result ||
              "No result";
            setGeminiResult(answer);
          })
          .catch(() => setGeminiResult("Evaluation failed."));
      }
    }
  }, []);

  // Simple average band suggestion (for demonstration)
  const overall = (() => {
    if (sections.length === 0) return null;
    // Example: average metrics (could use weighted sum for real band)
    const sum = sections.reduce((acc, s) => {
      Object.entries(s.metrics).forEach(([k, v]) => {
        // Only average number metrics
        if (typeof v === "number") acc[k as keyof IELTSMetric] = (acc[k as keyof IELTSMetric] || 0) + v;
      });
      return acc;
    }, {} as Partial<Record<keyof IELTSMetric, number>>);
    const avg: Partial<Record<keyof IELTSMetric, string>> = {};
    Object.entries(sum).forEach(([k, v]) => {
      avg[k as keyof IELTSMetric] = (v / sections.length).toFixed(2);
    });
    return avg;
  })();

  return (
    <div className="bg-[#0A1E2E] min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <Logo />
      <MotionDiv
        className="flex flex-col md:flex-row bg-white rounded-xl shadow-2xl overflow-hidden w-full max-w-5xl"
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
      >
        {/* Left Side: Summary */}
        <div className="w-full md:w-1/2 p-10 flex flex-col justify-top space-y-4">
          <h2 className="text-4xl font-bold text-black">
            IELTS Speaking Result
          </h2>
          <p className="text-black text-lg">Your Results</p>
          {geminiResult ? (
            <pre className="whitespace-pre-wrap text-black ">{geminiResult}</pre>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <div>
                <PropagateLoader />
              </div>
              <div>Evaluating your results with Gemini...</div>
            </div>
          )}
          
          <MotionButton
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push("/")}
            className="bg-black text-white px-5 py-2 rounded-md shadow-lg w-fit mt-4"
          >
            Start Again
          </MotionButton>
        </div>

        {/* Right Side: Section Details */}
        <div
          className="w-full md:w-1/2 p-10 flex flex-col items-center justify-start text-black"
          style={{
            backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(
              patternSvg
            )}")`,
            backgroundRepeat: "repeat",
            backgroundSize: "100px 100px",
            minHeight: "fit-content",
          }}
        >
          <h3 className="font-bold text-2xl mb-4">Section Details</h3>
          <div className="w-full max-h-[1500px] overflow-y-auto">
            {overall && (
            <div className="mb-8 border-b pb-4">
              <h3 className="text-black font-semibold mb-2">
                Overall Metrics (average):
              </h3>
              <ul className="text-black text-sm">
                {Object.entries(metricLabels).map(([k, label]) =>
                  k !== "grammar_errors" && overall[k as keyof IELTSMetric] !== undefined ? (
                    <li key={k}>
                      <span className="font-semibold">{label}:</span>{" "}
                      {overall[k as keyof IELTSMetric]}
                    </li>
                  ) : null
                )}
              </ul>
            </div>
          )}
            
            {sections.length === 0 && (
              <p className="text-gray-700">No results found.</p>
            )}
            {sections.map((section, idx) => (
              <div key={idx} className="mb-8 border-b pb-4">
                <div className="font-semibold">
                  Q{idx + 1}: {section.question}
                </div>
                <div className="text-sm mb-2">
                  <b>Transcript:</b> {section.answer_transcript}
                </div>
                <ul className="text-xs mb-1">
                  {section.words.map((w: STTWord, i: number) => (
                    <li key={i}>
                      {w.word}: {w.startTime.toFixed(2)}s -{" "}
                      {w.endTime.toFixed(2)}s
                    </li>
                  ))}
                </ul>
                <div className="mt-1">
                  <span className="font-semibold">Metrics:</span>
                  <ul className="ml-2 text-xs">
                    {Object.entries(metricLabels).map(([k, label]) => {
                      if (
                        k === "grammar_errors" &&
                        (section.metrics[k as keyof IELTSMetric] as string[])?.length > 0
                      ) {
                        return (
                          <li key={k}>
                            <span className="font-semibold">{label}:</span>
                            <ul className="ml-5 list-disc">
                              {(section.metrics[k as keyof IELTSMetric] as string[]).map(
                                (err: string, i: number) => (
                                  <li key={i}>{err}</li>
                                )
                              )}
                            </ul>
                          </li>
                        );
                      } else if (k === "grammar_errors") {
                        return (
                          <li key={k}>
                            <span className="font-semibold">{label}:</span> None
                          </li>
                        );
                      } else if (section.metrics[k as keyof IELTSMetric] !== undefined) {
                        return (
                          <li key={k}>
                            <span className="font-semibold">{label}:</span>{" "}
                            {section.metrics[k as keyof IELTSMetric]}
                          </li>
                        );
                      }
                      return null;
                    })}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </MotionDiv>
    </div>
  );
};

export default Result;