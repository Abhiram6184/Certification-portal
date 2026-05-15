import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Props = { label?: string; size?: number };

const EtlLoader = ({ label = "Loading credentials…", size = 240 }: Props) => {
  const stroke = "#ef4444";     // red-500
  const gearFill = "#dc2626";   // red-600
  const dbFill = "#e5e7eb";     // gray-200
  const dbTopFill = "#d1d5db";  // gray-300
  const cloudFill = "#e5e7eb";    // gray-200
  const cloudTopFill = "#d1d5db"; // gray-300
  const pipeFill = "#e5e7eb";   // gray-200

  const texts = ["Extract...", "Transform...", "Load..."];
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTextIndex((i) => (i + 1) % texts.length), 1800);
    return () => clearInterval(id);
  }, []);

  const PIPE_D = "M100 60 H220 C260 60 260 160 300 160 H420";

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={label}
      className="etl-loader"
      style={{ width: size, height: size / 2, margin: "2rem auto" }}
    >
      <motion.svg
        viewBox="0 0 520 220"
        width="100%"
        height="100%"
        style={{ overflow: "visible", willChange: "transform, opacity" }}
      >
        {/* Extract (database) */}
        <g transform="translate(30,60)">
          <ellipse cx="40" cy="0" rx="40" ry="12" fill={dbFill} />
          <rect x="0" y="-60" width="80" height="60" rx="8" fill={dbFill} />
          <ellipse cx="40" cy="-60" rx="40" ry="12" fill={dbTopFill} />
          <text x="80" y="28" textAnchor="middle" fontSize={16} className="fill-slate-700 dark:fill-slate-300">Extract</text>
        </g>

        {/* Pipeline base (static grey) */}
        <path
          d={PIPE_D}
          fill="none"
          stroke={pipeFill}
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Pipeline red flow (loops from left to right) */}
        <motion.path
          d={PIPE_D}
          fill="none"
          stroke={stroke}
          strokeWidth="6"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{
            duration: 1.2,
            ease: "linear",
            repeat: Infinity,
            repeatType: "loop"
          }}
        />

        {/* Transform (gear) */}
        <motion.g
          transform="translate(300,140)"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, ease: "linear", repeat: Infinity }}
        >
          <circle r="18" fill={gearFill} />
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i * Math.PI) / 4;
            const x = Math.cos(a) * 28, y = Math.sin(a) * 28;
            return (
              <rect
                key={i}
                x={x - 3}
                y={y - 6}
                width="6"
                height="12"
                rx="2"
                fill={gearFill}
                transform={`rotate(${i * 45}, ${x}, ${y})`}
              />
            );
          })}
        </motion.g>
        <text x="300" y="190" textAnchor="middle" fontSize={16} className="fill-slate-700 dark:fill-slate-300">Transform</text>

        {/* Load (warehouse/cloud) */}
        <g transform="translate(420,140)">
          <path d="M-24 0 h48 v24 h-48 z" fill={cloudFill} />
          <rect x="-18" y="-30" width="36" height="18" fill={cloudTopFill} rx="4" />
          <text x="0" y="50" textAnchor="middle" fontSize={16} className="fill-slate-700 dark:fill-slate-300">Load</text>
        </g>

        {/* Status text cycling */}
        <g>
          <AnimatePresence mode="wait">
            <motion.text
              key={textIndex}
              x="260"
              y="24"
              textAnchor="middle"
              fontSize={18}
              fontWeight="bold"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="fill-slate-800 dark:fill-slate-100"
            >
              {texts[textIndex]}
            </motion.text>
          </AnimatePresence>
        </g>
      </motion.svg>
    </div>
  );
};

export default EtlLoader;