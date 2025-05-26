import dynamic from "next/dynamic";
// import { Major_Mono_Display } from "next/font/google";

// const majorMono = Major_Mono_Display({
//   subsets: ['latin'],
//   weight: '400',
//   display: 'swap',
// });
// Dynamically import Framer Motion to avoid SSR issues in Next.js
const MotionH1 = dynamic(
  () => import("framer-motion").then((mod) => mod.motion.h1),
  { ssr: false }
);

// Import Major Mono Display font (assumed to be added in the project via Google Fonts in _document.js or CSS)


export default function Logo() {
  const containerVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: "easeOut" },
    },
  };

  return (
    <MotionH1
      className={`text-2xl sm:text-3xl md:text-4xl font-bold mb-6 sm:mb-8`}
      style={{ fontFamily: 'MyFont' }}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      
      <span className="text-[#00D4FF]">BAND</span>BOOSTER
    </MotionH1>
  );
}
