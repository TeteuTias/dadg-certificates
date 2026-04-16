"use client";
import { useEffect, useState } from "react";
import LoadingSpinner from "./LoadingSpinner";
import "./LoadingPage.css";

interface LoadingPageProps {
  message?: string;
  showPercentage?: boolean;
}

export default function LoadingPage({ 
  message = "Carregando dados...",
  showPercentage = true 
}: LoadingPageProps) {
  const [percentage, setPercentage] = useState(0);

  useEffect(() => {
    // Simula progresso de carregamento
    const interval = setInterval(() => {
      setPercentage((prev) => {
        if (prev >= 90) {
          return prev; // Para em 90% até o carregamento real terminar
        }
        const increment = Math.random() * 10 + 5;
        return Math.min(prev + increment, 90);
      });
    }, 300);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="loading-page-container">
      <div className="loading-page-content glass-container">
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

