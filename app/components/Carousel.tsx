'use client';
import React, { useRef } from 'react';

interface CarouselProps {
    children: React.ReactNode[];
}

const Carousel: React.FC<CarouselProps> = ({ children }) => {
    const carouselRef = useRef<HTMLDivElement>(null);

    const scrollLeft = () => {
        if (carouselRef.current) {
            carouselRef.current.scrollBy({ left: -300, behavior: 'smooth' });
        }
    };

    const scrollRight = () => {
        if (carouselRef.current) {
            carouselRef.current.scrollBy({ left: 300, behavior: 'smooth' });
        }
    };

    return (
        <div className="relative">
            <button
                onClick={scrollLeft}
                className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-gray-200 p-2 z-10"
            >
                &lt;
            </button>
            <div
                ref={carouselRef}
                className="flex overflow-x-auto space-x-4 scrollbar-hide"
            >
                {children}
            </div>
            <button
                onClick={scrollRight}
                className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-gray-200 p-2 z-10"
            >
                &gt;
            </button>
        </div>
    );
};

export default Carousel;
