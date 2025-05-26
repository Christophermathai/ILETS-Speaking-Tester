"use client";
import dynamic from "next/dynamic";
import Logo from "./logo";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PropagateLoader } from "react-spinners";
import { motion } from "framer-motion";

// Dynamically import Framer Motion to avoid SSR issues in Next.js
const MotionDiv = dynamic(
  () => import("framer-motion").then((mod) => mod.motion.div),
  { ssr: false }
);
const MotionButton = dynamic(
  () => import("framer-motion").then((mod) => mod.motion.button),
  { ssr: false }
);

export default function Homme() {
  const router = useRouter();
  const [question1, setQuestion1] = useState("");
  const [question2, setQuestion2] = useState("");
  const [question3, setQuestion3] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);

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
      }, 2000); // Change phrase every 2 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading, phrases.length]);

  // Animation variants for fading in and sliding up
  useEffect(() => {
    console.log(question1);
  }, [question1]);

  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut", staggerChildren: 0.2 },
    },
  };

  const phraseVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const handleSubmit = async () => {
    if (!question1 || !question2 || !question3) {
      setMessage("Please fill all questions.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    const timeout = setTimeout(() => {
      setIsLoading(false);
      setMessage("Request timed out. Please try again.");
    }, 10000); // 10-second timeout

    try {
      const res_session = await fetch("/api/session/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question1, question2, question3 }),
      });

      if (!res_session.ok) {
        throw new Error("Failed to set session");
      }

      const res_db = await fetch("/api/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question1, question2, question3 }),
      });

      const data = await res_db.json();

      if (res_session.ok && res_db.ok) {
        setMessage("Questions saved successfully!");
        alert("Test is going to start");
        setQuestion1("");
        setQuestion2("");
        setQuestion3("");
        router.push("/Test");
      } else {
        setMessage(data.error || "Failed to save questions.");
      }
    } catch (error) {
      setMessage(`Something went wrong: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#0A1E2E] min-h-screen flex items-center justify-center px-4">
      <div className="flex flex-col items-center text-white w-full">
        <Logo />

        <MotionDiv
          className="w-full max-w-md space-y-4 sm:space-y-6"
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
        >
          {/* Section 1 */}
          <MotionDiv variants={sectionVariants}>
            <h2
              className="text-base sm:text-lg mb-2"
              style={{ fontFamily: "MyFont" }}
            >
              Section 1
            </h2>
            <textarea
              placeholder="QUESTION 1"
              value={question1}
              onChange={(e) => setQuestion1(e.target.value)}
              className="w-full h-20 sm:h-24 p-4 bg-[#1A2E3E] text-white placeholder-gray-400 border border-[#00D4FF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00D4FF]"
            />
          </MotionDiv>

          {/* Section 2 */}
          <MotionDiv variants={sectionVariants}>
            <h2
              className="text-base sm:text-lg mb-2"
              style={{ fontFamily: "MyFont" }}
            >
              Section 2
            </h2>
            <textarea
              placeholder="QUESTION 2"
              value={question2}
              onChange={(e) => setQuestion2(e.target.value)}
              className="w-full h-20 sm:h-24 p-4 bg-[#1A2E3E] text-white placeholder-gray-400 border border-[#00D4FF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00D4FF]"
            />
          </MotionDiv>

          {/* Section 3 */}
          <MotionDiv variants={sectionVariants}>
            <h2
              className="text-base sm:text-lg mb-2"
              style={{ fontFamily: "MyFont" }}
            >
              Section 3
            </h2>
            <textarea
              placeholder="QUESTION 3"
              value={question3}
              onChange={(e) => setQuestion3(e.target.value)}
              className="w-full h-20 sm:h-24 p-4 bg-[#1A2E3E] text-white placeholder-gray-400 border border-[#00D4FF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00D4FF]"
            />
          </MotionDiv>

          {/* Submit Button */}
          <MotionButton
            className={`w-full py-2 sm:py-3 mt-4 bg-[#00D4FF] text-[#0A1E2E] font-semibold rounded-full hover:bg-[#00B0D4] transition-colors relative flex items-center justify-center ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={handleSubmit}
            variants={sectionVariants}
            disabled={isLoading}
          >
            Submit
          </MotionButton>

          {/* Full-Screen Loader */}
          {isLoading && (
            <MotionDiv
              className="fixed inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <PropagateLoader
                color="#00D4FF"
                size={15}
                speedMultiplier={1}
              />
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

          {/* Message Display */}
          {message && (
            <MotionDiv
              className="text-center text-sm sm:text-base text-red-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {message}
            </MotionDiv>
          )}
        </MotionDiv>
      </div>
    </div>
  );
}