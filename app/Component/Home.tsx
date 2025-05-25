'use client';
import dynamic from 'next/dynamic';
import Logo from './logo';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';


// Dynamically import Framer Motion to avoid SSR issues in Next.js
const MotionDiv = dynamic(() => import('framer-motion').then(mod => mod.motion.div), { ssr: false });
const MotionButton = dynamic(() => import('framer-motion').then(mod => mod.motion.button), { ssr: false });

// Import Major Mono Display font (assumed to be added in the project via Google Fonts in _document.js or CSS)
const majorMonoFont = "'Major Mono Display', monospace";

export default function Homme()
{
    const router = useRouter();
    const handleSubmit = async () => {
    if (!question1 || !question2 || !question3) {
      setMessage("Please fill all questions.");
      return;
    }
    try {
    const res_session = await fetch("/api/session/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question1, question2, question3 }),
      
    });
    if(!res_session.ok){throw new Error("Failed to add")}
    const res_db = await fetch("/api/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question1, question2, question3 }),
      });
      const data = await res_db.json();

      if (res_session.ok && res_session.ok) {
        setMessage("Questions saved successfully!");
        alert("Test is going to start");
        setQuestion1("");
        setQuestion2("");
        setQuestion3("");
        router.push('/Test')
      } else {
        setMessage(data.error || "Failed to save questions.");
      }
    } catch (error) {
      setMessage(`Something went wrong.${error}`);
    }
  };
  const [question1, setQuestion1] = useState("");
  const [question2, setQuestion2] = useState("");
  const [question3, setQuestion3] = useState("");
  const [message, setMessage] = useState("");

  // Animation variants for fading in and sliding up
  useEffect (() => {
    console.log(question1);
  },[question1])
  
  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut", staggerChildren: 0.2 },
    },
  };

    return(
        <div className="bg-[#0A1E2E] min-h-screen flex items-center justify-center px-4">
      <div className="flex flex-col items-center text-white w-full">
        {/* Header with animation and Major Mono Display font */}
        <Logo/>

        {/* Form Sections with animation */}
        <MotionDiv
          className="w-full max-w-md space-y-4 sm:space-y-6"
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
        >
          {/* Section 1 */}
          <MotionDiv variants={sectionVariants}>
            <h2 className="text-base sm:text-lg mb-2" style={{ fontFamily: majorMonoFont }}>Section 1</h2>
            <textarea
              placeholder="QUESTION 1"
              onChange={(e)=> setQuestion1(e.target.value)}
              className="w-full h-20 sm:h-24 p-4 bg-[#1A2E3E] text-white placeholder-gray-400 border border-[#00D4FF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00D4FF]"
            />
          </MotionDiv>

          {/* Section 2 */}
          <MotionDiv variants={sectionVariants}>
            <h2 className="text-base sm:text-lg mb-2" style={{ fontFamily: majorMonoFont }}>Section 2</h2>
            <textarea
              placeholder="QUESTION 2"
              onChange={(e)=> setQuestion2(e.target.value)}
              className="w-full h-20 sm:h-24 p-4 bg-[#1A2E3E] text-white placeholder-gray-400 border border-[#00D4FF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00D4FF]"
            />
          </MotionDiv>

          {/* Section 3 */}
          <MotionDiv variants={sectionVariants}>
            <h2 className="text-base sm:text-lg mb-2" style={{ fontFamily: majorMonoFont }}>Section 3</h2>
            <textarea
              placeholder="QUESTION 3"
              onChange={(e)=> setQuestion3(e.target.value)}
              className="w-full h-20 sm:h-24 p-4 bg-[#1A2E3E] text-white placeholder-gray-400 border border-[#00D4FF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00D4FF]"
            />
          </MotionDiv>

          {/* Submit Button with animation */}
          <MotionButton
            className="w-full py-2 sm:py-3 mt-4 bg-[#00D4FF] text-[#0A1E2E] font-semibold rounded-full hover:bg-[#00B0D4] transition-colors"
            onClick={handleSubmit}
            variants={sectionVariants}
          >
            Submit
          </MotionButton>
          {message}
        </MotionDiv>
      </div>
    </div>
    )
}