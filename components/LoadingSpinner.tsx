"use client";
import { useEffect, useState } from "react";
import "./LoadingSpinner.css";

interface LoadingSpinnerProps {
  showPercentage?: boolean;
  percentage?: number;
  size?: "small" | "medium" | "large";
  message?: string;
}

export default function LoadingSpinner({ 
  showPercentage = true, 
  percentage,
  size = "medium",
  message = "Carregando..."
}: LoadingSpinnerProps) {
  const [displayPercentage, setDisplayPercentage] = useState(0);

  useEffect(() => {
    if (percentage !== undefined) {
      setDisplayPercentage(percentage);
    } else {
      // Simula progresso se não houver porcentagem definida
      const interval = setInterval(() => {
        setDisplayPercentage((prev) => {
          if (prev >= 95) return prev;
          const increment = Math.random() * 15;
          return Math.min(prev + increment, 95);
        });
      }, 200);

      return () => clearInterval(interval);
    }
  }, [percentage]);

  return (
    <div className={`loading-spinner-container ${size}`}>
      <div className="loading-spinner-wrapper">
        <div className="spinner-ring">
          <div className="spinner-ring-inner"></div>
        </div>
        <div className="spinner-center">
          {showPercentage && (
            <span className="spinner-percentage">
              {Math.round(displayPercentage)}%
            </span>
          )}
        </div>
      </div>
      {message && (
        <p className="loading-spinner-message">{message}</p>
      )}
      {showPercentage && (
        <div className="loading-progress-bar">
          <div 
            className="loading-progress-fill" 
            style={{ width: `${displayPercentage}%` }}
          ></div>
        </div>
      )}
    </div>
  );
}

