"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";

export function ImageComparisonSlider({
  beforeImage,
  afterImage,
  beforeAlt = "Before",
  afterAlt = "After",
}: {
  beforeImage: string;
  afterImage: string;
  beforeAlt?: string;
  afterAlt?: string;
}) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = (x / rect.width) * 100;
    setSliderPosition(percent);
  }, []);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      handleMove(e.clientX);
    },
    [isDragging, handleMove]
  );

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging) return;
      handleMove(e.touches[0].clientX);
    },
    [isDragging, handleMove]
  );

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", () => setIsDragging(false));
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", () => setIsDragging(false));
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", () => setIsDragging(false));
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", () => setIsDragging(false));
    };
  }, [isDragging, onMouseMove, onTouchMove]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full cursor-ew-resize select-none overflow-hidden rounded-2xl"
      onMouseDown={(e) => {
        setIsDragging(true);
        handleMove(e.clientX);
      }}
      onTouchStart={(e) => {
        setIsDragging(true);
        handleMove(e.touches[0].clientX);
      }}
    >
      {/* After Image (Base) */}
      <Image
        src={afterImage}
        alt={afterAlt}
        fill
        className="object-cover object-top"
        sizes="(max-width: 768px) 100vw, 50vw"
        draggable={false}
        priority
      />

      {/* Before Image (Clipped) */}
      <div
        className="absolute inset-y-0 left-0 right-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <Image
          src={beforeImage}
          alt={beforeAlt}
          fill
          className="object-cover object-top"
          sizes="(max-width: 768px) 100vw, 50vw"
          draggable={false}
          priority
        />
      </div>

      {/* Slider Handle */}
      <div
        className="absolute inset-y-0 w-1 bg-white/90 shadow-[0_0_10px_rgba(0,0,0,0.3)] backdrop-blur-sm -translate-x-1/2 flex items-center justify-center"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md text-ink text-[10px] tracking-widest font-medium">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </div>
    </div>
  );
}
