import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TimelineDot } from './TimelineDot';
import { metaballPath } from './timelineMetaball';
import type { ViewportArticle } from '../types/timeline';
import {
  ANSWER_APPEAR_DURATION_MS,
  ANSWER_MIN_SCALE,
  ANSWER_SCALE_RECOVERY,
  CENTER_Y,
  CONTENT_OVERLAP_GAP,
  DOT_ACTIVE_SCALE,
  DOT_SCALE_ANIMATION_MS,
  DOT_HOVER_SCALE,
  DOT_RADIUS,
  LEFT_X,
  MAX_HEIGHT_PERCENT,
  PREVIEW_GAP,
  PREVIEW_MAX_WIDTH,
  PREVIEW_VERTICAL_BLEED,
  RIGHT_X,
  ROW_HEIGHT,
  ROW_WIDTH,
  TIMELINE_COLLAPSED_WIDTH
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

function getMessageTextFromTurn(turnElement: HTMLElement | null) {
  if (!turnElement) return '';
  const authorRoot = turnElement.querySelector<HTMLElement>('[data-message-author-role]');
  const text = authorRoot?.innerText ?? turnElement.innerText ?? '';
  return text.replace(/\u00a0/g, ' ').trim();
}

async function writeClipboardText(text: string) {
  if (!navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function copyUsingTurnCopyButton(turnElement: HTMLElement | null): Promise<string> {
  if (!turnElement) return '';

  const copyButton = turnElement.querySelector<HTMLButtonElement>(
    'button[data-testid="copy-turn-action-button"][aria-label="Copy"]'
  );

  if (!copyButton || !navigator.clipboard?.readText) {
    return getMessageTextFromTurn(turnElement);
  }

  let before = '';
  try {
    before = await navigator.clipboard.readText();
  } catch {
    return getMessageTextFromTurn(turnElement);
  }

  copyButton.click();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 80));
    try {
      const current = await navigator.clipboard.readText();
      if (current && current !== before) return current.trim();
    } catch {
      break;
    }
  }

  return getMessageTextFromTurn(turnElement);
}

function CopyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

export function Timeline({ articles, activeIndex, onDotClick }: TimelineProps) {
  const [leftOffset, setLeftOffset] = useState(16);
  const [isLayoutVisible, setIsLayoutVisible] = useState(true);
  const [animation, setAnimation] = useState<{ answerId: string; progress: number } | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isTimelineHovered, setIsTimelineHovered] = useState(false);
  const [dotScales, setDotScales] = useState<Record<number, number>>({});
  const [maxHeightPx, setMaxHeightPx] = useState(0);
  const [isScrollable, setIsScrollable] = useState(false);
  const [copiedRowKey, setCopiedRowKey] = useState<string | null>(null);
  const prevArticleIdsRef = useRef<string[]>([]);
  const animationRafRef = useRef<number | null>(null);
  const dotScaleRafRef = useRef<number | null>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dotScaleRef = useRef<Record<number, number>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const activeRowRef = useRef<HTMLDivElement | null>(null);

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
    const getContentLeftBoundary = () => {
      const contentNodes = Array.from(
        document.querySelectorAll<HTMLElement>('[data-testid^="conversation-turn"] [data-message-author-role]')
      );
      let minLeft = Number.POSITIVE_INFINITY;

      for (const node of contentNodes) {
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
        minLeft = Math.min(minLeft, rect.left);
      }

      return minLeft;
    };

    const updatePosition = () => {
      const thread = document.getElementById('thread');
      if (thread) {
        const rect = thread.getBoundingClientRect();
        const targetLeft = Math.max(16, rect.left + 16);
        const timelineRight = targetLeft + TIMELINE_COLLAPSED_WIDTH;
        const contentLeft = getContentLeftBoundary();
        const doesOverlapContent =
          Number.isFinite(contentLeft) && timelineRight + CONTENT_OVERLAP_GAP > contentLeft;

        if (doesOverlapContent) {
          setIsLayoutVisible(false);
          return;
        }

        setIsLayoutVisible(true);
        setLeftOffset(targetLeft);
      } else {
        setIsLayoutVisible(false);
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
    const updateMaxHeight = () => {
      const bodyHeight = document.body.getBoundingClientRect().height || window.innerHeight;
      setMaxHeightPx((bodyHeight * MAX_HEIGHT_PERCENT) / 100);
    };

    updateMaxHeight();
    window.addEventListener('resize', updateMaxHeight);
    document.addEventListener('scroll', updateMaxHeight, { passive: true, capture: true });

    return () => {
      window.removeEventListener('resize', updateMaxHeight);
      document.removeEventListener('scroll', updateMaxHeight, { capture: true });
    };
  }, []);

  useEffect(() => {
    if (!scrollContainerRef.current || maxHeightPx <= 0) return;

    const container = scrollContainerRef.current;
    const updateScrollable = () => {
      setIsScrollable(container.scrollHeight > maxHeightPx);
    };

    updateScrollable();
    const observer = new ResizeObserver(updateScrollable);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [rows, maxHeightPx]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const activeRow = activeRowRef.current;
    if (!container || !activeRow) return;

    const containerTop = container.scrollTop;
    const containerBottom = containerTop + container.clientHeight;
    const rowTop = activeRow.offsetTop;
    const rowBottom = rowTop + activeRow.offsetHeight;
    const padding = 8;

    if (rowTop < containerTop + padding) {
      container.scrollTo({
        top: Math.max(0, rowTop - padding),
        behavior: 'smooth'
      });
      return;
    }

    if (rowBottom > containerBottom - padding) {
      container.scrollTo({
        top: rowBottom - container.clientHeight + padding,
        behavior: 'smooth'
      });
    }
  }, [activeIndex, rows, isScrollable]);

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
  }, [articles]);

  useEffect(() => {
    return () => {
      if (animationRafRef.current) {
        cancelAnimationFrame(animationRafRef.current);
        animationRafRef.current = null;
      }
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
        copiedTimeoutRef.current = null;
      }
    };
  }, []);

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

  if (articles.length === 0 || !isLayoutVisible) return null;

  const handlePreviewCopy = async (row: TimelineRow) => {
    const domTurns = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="conversation-turn"]'));
    const questionTurn = row.question ? domTurns[row.question.index] : null;
    const answerTurn = row.answer ? domTurns[row.answer.index] : null;

    const questionText = row.question ? await copyUsingTurnCopyButton(questionTurn) : '';
    const answerText = row.answer ? await copyUsingTurnCopyButton(answerTurn) : '';

    const formatted = `# Question\n${questionText}\n\n# Answer\n${answerText}`;
    const didCopy = await writeClipboardText(formatted);
    if (!didCopy) return;

    setCopiedRowKey(row.key);
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
    }
    copiedTimeoutRef.current = setTimeout(() => {
      setCopiedRowKey((current) => (current === row.key ? null : current));
      copiedTimeoutRef.current = null;
    }, 2000);
  };

  return (
    <div
      id="chatgpt-scroller-timeline"
      className="fixed top-1/2 -translate-y-1/2 z-20 pointer-events-auto p-2.5 bg-white/10 dark:bg-black/20 backdrop-blur-md rounded-2xl opacity-30 hover:opacity-100 transition-opacity duration-300 overflow-visible"
      style={{ left: `${leftOffset}px` }}
      onMouseEnter={() => setIsTimelineHovered(true)}
      onMouseLeave={() => setIsTimelineHovered(false)}
    >
      <style>
        {`
          @keyframes chatgpt-scroller-shine {
            0% { transform: translateX(-120%); }
            100% { transform: translateX(220%); }
          }
        `}
      </style>
      <div
        ref={scrollContainerRef}
        className={`flex flex-col gap-2 chatgpt-scroller-scroll ${isScrollable ? 'overflow-y-auto' : 'overflow-y-visible'}`}
        style={{
          maxHeight: maxHeightPx > 0 ? `${maxHeightPx}px` : undefined,
          direction: 'rtl',
          paddingTop: `${PREVIEW_VERTICAL_BLEED}px`,
          paddingBottom: `${PREVIEW_VERTICAL_BLEED}px`
        }}
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
            <div
              key={row.key}
              ref={rowIsActive ? activeRowRef : null}
              className="relative shrink-0"
              style={{
                width: isTimelineHovered ? ROW_WIDTH + PREVIEW_GAP + PREVIEW_MAX_WIDTH : ROW_WIDTH,
                height: ROW_HEIGHT,
                direction: 'ltr'
              }}
            >
              {row.question?.article.previewText && (
                <div
                  className={`absolute top-1/2 -translate-y-1/2 transition-opacity duration-150 ${
                    isTimelineHovered ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                  }`}
                  style={{ left: `${ROW_WIDTH + PREVIEW_GAP}px` }}
                >
                  <button
                    type="button"
                    className="relative flex max-w-[280px] items-center gap-1.5 overflow-hidden rounded-md bg-black/70 px-2 py-1 text-[11px] leading-tight text-white transition-colors hover:bg-black/80"
                    onClick={() => void handlePreviewCopy(row)}
                    title="Copy question + answer"
                  >
                    <CopyIcon />
                    <span className="truncate">{row.question.article.previewText}</span>
                    {copiedRowKey === row.key && (
                      <span className="absolute inset-0 flex items-center justify-center bg-emerald-600/85 text-[10px] font-semibold tracking-wide text-white">
                        Copied
                        <span
                          className="pointer-events-none absolute inset-0 opacity-70"
                          style={{
                            background:
                              'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.45) 50%, transparent 70%)',
                            animation: 'chatgpt-scroller-shine 1s linear infinite'
                          }}
                        />
                      </span>
                    )}
                  </button>
                </div>
              )}

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
    </div>
  );
}
