"use client";
import { useEffect, useState } from "react";
import LoadingSpinner from "./LoadingSpinner";
import "./LoadingModal.css";

interface LoadingModalProps {
  message?: string;
  showPercentage?: boolean;
}

export default function LoadingModal({ 
  message = "Processando...",
  showPercentage = true 
}: LoadingModalProps) {
  const [percentage, setPercentage] = useState(0);

  useEffect(() => {
    // Simula progresso de carregamento
    const interval = setInterval(() => {
      setPercentage((prev) => {
        if (prev >= 95) {
          return prev;
        }
        const increment = Math.random() * 8 + 3;
        return Math.min(prev + increment, 95);
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="loading-modal-overlay">
      <div className="loading-modal-content glass-container">
        <LoadingSpinner 
          size="large" 
          showPercentage={showPercentage}
          percentage={percentage}
          message={message}
        />
      </div>
    </div>
  );
}