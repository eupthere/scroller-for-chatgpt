import React, { useEffect, useState, useRef } from 'react';
import { TimelineDot } from './TimelineDot';

export interface ViewportArticle {
  role: 'user' | 'assistant' | null;
}

export interface TimelineProps {
  articles: ViewportArticle[];
  activeIndex: number;
  onDotClick: (index: number) => void;
}

export function Timeline({ articles, activeIndex, onDotClick }: TimelineProps) {
  const [leftOffset, setLeftOffset] = useState(16);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Dynamic thread positioning calculation
    const updatePosition = () => {
      const thread = document.getElementById('thread');
      if (thread) {
        const rect = thread.getBoundingClientRect();
        // Place it 16px from the left edge of the thread if visible,
        // or fallback to viewport edge if it's too snug.
        const targetLeft = Math.max(16, rect.left + 16);
        setLeftOffset(targetLeft);
      }
    };

    updatePosition();
    
    // Poll or resize-observe to keep the position perfectly tracked.
    window.addEventListener('resize', updatePosition);
    document.addEventListener('scroll', updatePosition, { passive: true, capture: true });

    // Since ChatGPT can dynamically shift layout without window resize, an interval might be safest
    const interval = setInterval(updatePosition, 500);

    return () => {
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('scroll', updatePosition, { capture: true });
      clearInterval(interval);
    };
  }, []);

  if (articles.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      id="chatgpt-scroller-timeline"
      className="fixed top-1/2 -translate-y-1/2 flex flex-col gap-2 z-[9999] pointer-events-auto p-2.5 bg-white/10 dark:bg-black/20 backdrop-blur-md rounded-2xl max-h-[80vh] overflow-y-auto opacity-30 hover:opacity-100 transition-opacity duration-300"
      style={{ left: `${leftOffset}px` }}
    >
      {articles.map((article, index) => (
        <TimelineDot
          key={index}
          role={article.role}
          isActive={index === activeIndex}
          onClick={() => onDotClick(index)}
        />
      ))}
    </div>
  );
}
