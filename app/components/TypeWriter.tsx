"use client"
import { useEffect, useState } from "react";
interface TypewriterProps {
    text: string;
    speed?: number;
}

export default function Typewriter({ text, speed = 100 }: TypewriterProps) {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (index < text.length) {
            const randomDelay = speed + Math.random() * 50;
            const timeoutId = setTimeout(() => setIndex(index + 1), randomDelay);
            return () => clearTimeout(timeoutId);
        }
    }, [index, text, speed]);

    return (
        <span>
            {text.slice(0, index)}
            {index < text.length && <span className="blinking-cursor">|</span>}
        </span>
    );
}
