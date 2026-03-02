import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TimelineDot } from './TimelineDot';
import type { ViewportArticle } from '../types/timeline';
import {
  ANSWER_APPEAR_DURATION_MS,
  ANSWER_MIN_SCALE,
  ANSWER_SCALE_RECOVERY,
  CENTER_Y,
  CONNECTOR_BLEND,
  CONNECTOR_HANDLE_RATE,
  CONNECTOR_MAX_DISTANCE,
  DOT_ACTIVE_SCALE,
  DOT_SCALE_ANIMATION_MS,
  DOT_HOVER_SCALE,
  DOT_RADIUS,
  LEFT_X,
  RIGHT_X,
  ROW_HEIGHT,
  ROW_WIDTH
} from './timelineUi';

interface TimelineProps {
  articles: ViewportArticle[];
  activeIndex: number;
  onDotClick: (index: number) => void;
}

interface TimelineRow {
  key: string;
  question?: { index: number; article: ViewportArticle };
  answer?: { index: number; article: ViewportArticle };
}

interface Circle {
  x: number;
  y: number;
  r: number;
}

function vec(angle: number, length: number) {
  return {
    x: Math.cos(angle) * length,
    y: Math.sin(angle) * length
  };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function metaballPath(
  ball1: Circle,
  ball2: Circle,
  v = CONNECTOR_BLEND,
  handleLenRate = CONNECTOR_HANDLE_RATE,
  maxDistance = CONNECTOR_MAX_DISTANCE
) {
  const center1 = { x: ball1.x, y: ball1.y };
  const center2 = { x: ball2.x, y: ball2.y };
  let radius1 = ball1.r;
  let radius2 = ball2.r;
  const pi2 = Math.PI / 2;
  const d = dist(center1, center2);
  let u1: number;
  let u2: number;

  if (radius1 === 0 || radius2 === 0) return null;

  if (d > maxDistance || d <= Math.abs(radius1 - radius2)) {
    return null;
  } else if (d < radius1 + radius2) {
    u1 = Math.acos((radius1 * radius1 + d * d - radius2 * radius2) / (2 * radius1 * d));
    u2 = Math.acos((radius2 * radius2 + d * d - radius1 * radius1) / (2 * radius2 * d));
  } else {
    u1 = 0;
    u2 = 0;
  }

  const angle1 = Math.atan2(center2.y - center1.y, center2.x - center1.x);
  const angle2 = Math.acos((radius1 - radius2) / d);
  const angle1a = angle1 + u1 + (angle2 - u1) * v;
  const angle1b = angle1 - u1 - (angle2 - u1) * v;
  const angle2a = angle1 + Math.PI - u2 - (Math.PI - u2 - angle2) * v;
  const angle2b = angle1 - Math.PI + u2 + (Math.PI - u2 - angle2) * v;

  const p1a = { x: center1.x + vec(angle1a, radius1).x, y: center1.y + vec(angle1a, radius1).y };
  const p1b = { x: center1.x + vec(angle1b, radius1).x, y: center1.y + vec(angle1b, radius1).y };
  const p2a = { x: center2.x + vec(angle2a, radius2).x, y: center2.y + vec(angle2a, radius2).y };
  const p2b = { x: center2.x + vec(angle2b, radius2).x, y: center2.y + vec(angle2b, radius2).y };

  const totalRadius = radius1 + radius2;
  let d2 = Math.min(v * handleLenRate, dist(p1a, p2a) / totalRadius);
  d2 *= Math.min(1, (d * 2) / (radius1 + radius2));

  radius1 *= d2;
  radius2 *= d2;

  const h0 = vec(angle1a - pi2, radius1);
  const h1 = vec(angle2a + pi2, radius2);
  const h2 = vec(angle2b - pi2, radius2);
  const h3 = vec(angle1b + pi2, radius1);

  return [
    `M ${p1a.x} ${p1a.y}`,
    `C ${p1a.x + h0.x} ${p1a.y + h0.y}, ${p2a.x + h1.x} ${p2a.y + h1.y}, ${p2a.x} ${p2a.y}`,
    `L ${p2b.x} ${p2b.y}`,
    `C ${p2b.x + h2.x} ${p2b.y + h2.y}, ${p1b.x + h3.x} ${p1b.y + h3.y}, ${p1b.x} ${p1b.y}`,
    'Z'
  ].join(' ');
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function getDotScale(isHighlighted: boolean, isHovered: boolean) {
  const highlightScale = isHighlighted ? DOT_ACTIVE_SCALE : 1;
  const hoverScale = isHovered ? DOT_HOVER_SCALE : 1;
  return Math.max(highlightScale, hoverScale);
}

export function Timeline({ articles, activeIndex, onDotClick }: TimelineProps) {
  const [leftOffset, setLeftOffset] = useState(16);
  const [animation, setAnimation] = useState<{ answerId: string; progress: number } | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [dotScales, setDotScales] = useState<Record<number, number>>({});
  const prevArticleIdsRef = useRef<string[]>([]);
  const animationRafRef = useRef<number | null>(null);
  const dotScaleRafRef = useRef<number | null>(null);
  const dotScaleRef = useRef<Record<number, number>>({});

  const rows = useMemo<TimelineRow[]>(() => {
    const out: TimelineRow[] = [];
    for (let i = 0; i < articles.length; i += 1) {
      const current = articles[i];
      const next = articles[i + 1];

      if (current.role === 'user' && next?.role === 'assistant') {
        out.push({
          key: `${current.id}-${next.id}`,
          question: { index: i, article: current },
          answer: { index: i + 1, article: next }
        });
        i += 1;
        continue;
      }

      if (current.role === 'assistant') {
        out.push({
          key: current.id,
          answer: { index: i, article: current }
        });
        continue;
      }

      out.push({
        key: current.id,
        question: { index: i, article: current }
      });
    }
    return out;
  }, [articles]);

  useEffect(() => {
    dotScaleRef.current = dotScales;
  }, [dotScales]);

  useEffect(() => {
    const updatePosition = () => {
      const thread = document.getElementById('thread');
      if (thread) {
        const rect = thread.getBoundingClientRect();
        const targetLeft = Math.max(16, rect.left + 16);
        setLeftOffset(targetLeft);
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    document.addEventListener('scroll', updatePosition, { passive: true, capture: true });
    const interval = setInterval(updatePosition, 500);

    return () => {
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('scroll', updatePosition, { capture: true });
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const previousIds = new Set(prevArticleIdsRef.current);
    const addedAnswer = [...articles]
      .reverse()
      .find((article, reverseIndex) => {
        const index = articles.length - 1 - reverseIndex;
        const prev = articles[index - 1];
        return !previousIds.has(article.id) && article.role === 'assistant' && prev?.role === 'user';
      });

    prevArticleIdsRef.current = articles.map((article) => article.id);

    if (!addedAnswer) return;

    if (animationRafRef.current) {
      cancelAnimationFrame(animationRafRef.current);
      animationRafRef.current = null;
    }

    const start = performance.now();
    const duration = ANSWER_APPEAR_DURATION_MS;

    const tick = (now: number) => {
      const raw = Math.min(1, (now - start) / duration);
      setAnimation({ answerId: addedAnswer.id, progress: raw });
      if (raw < 1) {
        animationRafRef.current = requestAnimationFrame(tick);
      } else {
        setAnimation(null);
        animationRafRef.current = null;
      }
    };

    animationRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationRafRef.current) {
        cancelAnimationFrame(animationRafRef.current);
        animationRafRef.current = null;
      }
    };
  }, [articles]);

  useEffect(() => {
    const indices = articles.map((_, index) => index);
    const targets: Record<number, number> = {};
    for (const index of indices) {
      const isHovered = hoveredIndex === index;
      const isHighlighted = activeIndex === index;
      targets[index] = getDotScale(isHighlighted, isHovered);
    }

    const starts: Record<number, number> = {};
    for (const index of indices) {
      starts[index] = dotScaleRef.current[index] ?? targets[index] ?? 1;
    }

    if (dotScaleRafRef.current) {
      cancelAnimationFrame(dotScaleRafRef.current);
      dotScaleRafRef.current = null;
    }

    const startAt = performance.now();
    const tick = (now: number) => {
      const raw = Math.min(1, (now - startAt) / DOT_SCALE_ANIMATION_MS);
      const eased = easeOutCubic(raw);
      const next: Record<number, number> = {};

      for (const index of indices) {
        const from = starts[index];
        const to = targets[index];
        next[index] = from + (to - from) * eased;
      }

      dotScaleRef.current = next;
      setDotScales(next);

      if (raw < 1) {
        dotScaleRafRef.current = requestAnimationFrame(tick);
      } else {
        dotScaleRafRef.current = null;
      }
    };

    dotScaleRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (dotScaleRafRef.current) {
        cancelAnimationFrame(dotScaleRafRef.current);
        dotScaleRafRef.current = null;
      }
    };
  }, [activeIndex, hoveredIndex, articles]);

  if (articles.length === 0) return null;

  return (
    <div
      id="chatgpt-scroller-timeline"
      className="fixed top-1/2 -translate-y-1/2 flex flex-col gap-2 z-[9999] pointer-events-auto p-2.5 bg-white/10 dark:bg-black/20 backdrop-blur-md rounded-2xl max-h-[80vh] overflow-y-auto opacity-30 hover:opacity-100 transition-opacity duration-300"
      style={{ left: `${leftOffset}px` }}
    >
      {rows.map((row) => {
        const hasPair = row.question?.article.role === 'user' && row.answer?.article.role === 'assistant';
        const shouldAnimateAnswer = hasPair && animation?.answerId === row.answer?.article.id;
        const raw = shouldAnimateAnswer ? Math.max(0, animation?.progress ?? 0) : 1;
        const moveT = shouldAnimateAnswer ? easeOutCubic(raw) : 1;
        const bornScale = shouldAnimateAnswer
          ? ANSWER_MIN_SCALE + ANSWER_SCALE_RECOVERY * easeOutBack(raw)
          : 1;
        const animatedAnswerX = LEFT_X + (RIGHT_X - LEFT_X) * moveT;
        const questionScale = row.question ? (dotScales[row.question.index] ?? 1) : 1;
        const answerBaseScale = row.answer ? (dotScales[row.answer.index] ?? 1) : 1;
        const answerScale = answerBaseScale * bornScale;
        const connectorPath = hasPair
          ? metaballPath(
              { x: LEFT_X, y: CENTER_Y, r: DOT_RADIUS * questionScale },
              {
                x: shouldAnimateAnswer ? animatedAnswerX : RIGHT_X,
                y: CENTER_Y,
                r: DOT_RADIUS * answerScale
              }
            )
          : null;
        const rowIsActive =
          row.question?.index === activeIndex ||
          row.answer?.index === activeIndex;
        const rowIsHovered =
          row.question?.index === hoveredIndex ||
          row.answer?.index === hoveredIndex;

        return (
          <div key={row.key} className="relative" style={{ width: ROW_WIDTH, height: ROW_HEIGHT }}>
            {connectorPath && (
              <svg
                width={ROW_WIDTH}
                height={ROW_HEIGHT}
                viewBox={`0 0 ${ROW_WIDTH} ${ROW_HEIGHT}`}
                className={"absolute left-0 top-0 z-10 overflow-visible pointer-events-none fill-scroller-dot-idle"}
                aria-hidden="true"
              >
                <path d={connectorPath} />
              </svg>
            )}

            {row.question && (
              <TimelineDot
                role={row.question.article.role}
                isHighlighted={row.question.index === activeIndex}
                scale={questionScale}
                onClick={() => onDotClick(row.question!.index)}
                onHoverChange={(isHovered) => {
                  setHoveredIndex((current) => {
                    if (isHovered) return row.question!.index;
                    return current === row.question!.index ? null : current;
                  });
                }}
                style={{ left: `${LEFT_X - DOT_RADIUS}px`, top: `${CENTER_Y - DOT_RADIUS}px` }}
              />
            )}

            {row.answer && (
              <TimelineDot
                role={row.answer.article.role}
                isHighlighted={row.answer.index === activeIndex}
                scale={answerScale}
                onClick={() => onDotClick(row.answer!.index)}
                onHoverChange={(isHovered) => {
                  setHoveredIndex((current) => {
                    if (isHovered) return row.answer!.index;
                    return current === row.answer!.index ? null : current;
                  });
                }}
                style={{
                  left: `${(shouldAnimateAnswer ? animatedAnswerX : RIGHT_X) - DOT_RADIUS}px`,
                  top: `${CENTER_Y - DOT_RADIUS}px`
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
