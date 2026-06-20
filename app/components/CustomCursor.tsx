"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export default function CustomCursor() {
  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  // Dot: tight & fast
  const springConfigDot = { damping: 25, stiffness: 700, mass: 0.5 };
  // Ring: slow, weighted inertia
  const springConfigRing = { damping: 25, stiffness: 150, mass: 1 };

  const dotX = useSpring(cursorX, springConfigDot);
  const dotY = useSpring(cursorY, springConfigDot);
  const ringX = useSpring(cursorX, springConfigRing);
  const ringY = useSpring(cursorY, springConfigRing);

  useEffect(() => {
    // A11y: respect prefers-reduced-motion
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handleMotionPref = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", handleMotionPref);

    // Disable entirely on touch / mobile devices
    if (window.matchMedia("(max-width: 768px)").matches || mq.matches) {
      return () => mq.removeEventListener("change", handleMotionPref);
    }

    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive = target.closest('a, button, [role="button"], input, textarea, select');
      setIsHovering(!!isInteractive);
    };

    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);

    window.addEventListener("mousemove", moveCursor);
    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);

    return () => {
      mq.removeEventListener("change", handleMotionPref);
      window.removeEventListener("mousemove", moveCursor);
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
    };
  }, [cursorX, cursorY, isVisible]);

  // Don't render if motion is reduced or not yet visible
  if (reducedMotion || !isVisible) return null;

  return (
    <>
      {/* Outer ring — slow, blended */}
      <motion.div
        aria-hidden="true"
        className="fixed -top-4 -left-4 w-8 h-8 rounded-full border border-white z-[9999] pointer-events-none mix-blend-difference"
        style={{ x: ringX, y: ringY }}
        animate={{ scale: isHovering ? 2 : 1, opacity: isHovering ? 0.4 : 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
      {/* Center dot — fast */}
      <motion.div
        aria-hidden="true"
        className="fixed -top-1 -left-1 w-2 h-2 bg-white rounded-full z-[9999] pointer-events-none mix-blend-difference"
        style={{ x: dotX, y: dotY }}
      />
    </>
  );
}
