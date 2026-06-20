"use client"
import React, { useRef, useState } from "react";
import styles from "../styles/styles.module.scss";

interface CardProps {
  dataImage: string;
  header: React.ReactNode;
  content: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ dataImage, header, content }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    setDimensions({ width, height });
    const x = e.clientX - rect.left - width / 2;
    const y = e.clientY - rect.top - height / 2;
    setMouseX(x);
    setMouseY(y);
  };

  const handleMouseLeave = () => {
    setMouseX(0);
    setMouseY(0);
  };

  const mousePX = dimensions.width ? mouseX / dimensions.width : 0;
  const mousePY = dimensions.height ? mouseY / dimensions.height : 0;

  const cardStyle = {
    transform: `rotateY(${mousePX * 30}deg) rotateX(${mousePY * -30}deg)`,
  };

  const cardBgTransform = {
    transform: `translateX(${mousePX * -1}px) translateY(${mousePY * -1}px)`,
  };

  return (
    <div
      className={styles.cardWrap}
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className={styles.card} style={cardStyle}>
        <div
          className={styles.cardBg}
          style={{
            ...cardBgTransform,
            backgroundImage: `url(${dataImage})`,
          }}
        ></div>
        <div className={styles.cardInfo}>
          <h1>{header}</h1>
          <p>{content}</p>
        </div>
      </div>
    </div>
  );
};

export default Card;
