import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Timeline } from './Timeline';
import { normalizeRole } from '../lib/normalizeRole';
import type { ViewportArticle } from '../types/timeline';

export function ScrollerApp() {
  const [articles, setArticles] = useState<ViewportArticle[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const domArticlesRef = useRef<HTMLElement[]>([]);
  
  // Track current outline clear timeout
  const outlineTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate the current active index directly from DOM
  const getCurrentVisibleIndex = useCallback((): number => {
    const domArticles = domArticlesRef.current;
    if (!domArticles.length) return -1;
    
    // ChatGPT frequently uses nested scroll containers
    const header = document.getElementById('page-header');
    const focalPoint = header ? header.getBoundingClientRect().bottom : 80;
    
    // We add a tiny 2px buffer to handle floating point sub-pixel rounding
    // during smooth scrolling that can cause the browser to stop at 80.0001
    for (let i = 0; i < domArticles.length; i++) {
      const rect = domArticles[i].getBoundingClientRect();
      
      // The "active" article is the first one whose bottom extends past our focal point.
      // This means we are currently reading it, or it is the first thing appearing below the header.
      if (rect.bottom > focalPoint + 2) {
        return i;
      }
    }

    return domArticles.length - 1;
  }, []);

  // Update indices based on scroll
  const syncIndexWithScroll = useCallback(() => {
    const visibleIndex = getCurrentVisibleIndex();
    if (visibleIndex !== -1) {
      setActiveIndex(visibleIndex);
    }
  }, [getCurrentVisibleIndex]);

  // Main scroll action
  const focusArticle = useCallback((index: number) => {
    const domArticles = domArticlesRef.current;
    if (!domArticles.length) return;
    
    const targetIndex = Math.max(0, Math.min(index, domArticles.length - 1));
    setActiveIndex(targetIndex);
    
    const el = domArticles[targetIndex];
    
    // Explicitly calculate scroll target to prevent jumping
    const header = document.getElementById('page-header');
    const focalPoint = header ? header.getBoundingClientRect().bottom : 80;
    
    // ChatGPT frequently uses nested scroll containers, find the actual parent that handles our overflow
    const getScrollParent = (node: HTMLElement | null): Element | Window => {
      if (!node || node === document.body || node === document.documentElement) return window;
      const overflowY = window.getComputedStyle(node).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') return node;
      return getScrollParent(node.parentElement);
    };

    const scrollContainer = getScrollParent(el);

    if (index >= domArticles.length) {
      scrollContainer.scrollTo({
        top: scrollContainer === window ? document.documentElement.scrollHeight : (scrollContainer as Element).scrollHeight,
        behavior: 'instant'
      });
      return;
    }

    const rectTop = el.getBoundingClientRect().top;
    
    // We want the element's top to hit the focal point perfectly.
    const distanceToScroll = rectTop - focalPoint;

    scrollContainer.scrollBy({
      top: distanceToScroll,
      behavior: 'instant'
    });

    // Flash outline
    if (outlineTimeoutRef.current) {
      clearTimeout(outlineTimeoutRef.current);
      // Clear all previous outlines before applying new ones
      domArticles.forEach(a => {
        a.style.outline = '';
        a.style.outlineOffset = '';
        a.style.transition = '';
      });
    }

    el.style.outline = '2px solid var(--color-scroller-focus-outline)';
    el.style.outlineOffset = '4px';
    el.style.transition = 'outline 0.3s ease-out';

    outlineTimeoutRef.current = setTimeout(() => {
      el.style.outline = '2px solid var(--color-scroller-focus-outline-clear)';
      setTimeout(() => {
        el.style.outline = '';
        el.style.outlineOffset = '';
        el.style.transition = '';
      }, 300);
    }, 500);
  }, []);


  // --- Event Listeners ---
  useEffect(() => {
    let updateTimeout: ReturnType<typeof setTimeout>;

    const updateArticles = () => {
      // Find all conversation items
      const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="conversation-turn"]'));
      domArticlesRef.current = elements;
      
      const newArticles = elements.map((article): ViewportArticle => {
        const roleFromTurn = article.getAttribute('data-turn');
        const roleFromAuthor = article
          .querySelector('[data-message-author-role]')
          ?.getAttribute('data-message-author-role');

        return {
          role: normalizeRole(roleFromTurn ?? roleFromAuthor)
        };
      });
      
      setArticles(newArticles);
      syncIndexWithScroll();
    };

    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldUpdate = true;
          break;
        }
      }
      if (shouldUpdate) {
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(updateArticles, 100);
      }
    });

    const mainContent = document.querySelector('main') || document.body;
    observer.observe(mainContent, { childList: true, subtree: true });
    updateArticles();

    // Setup scroll listener
    const onScroll = (e: Event) => {
      if ((e.target as HTMLElement)?.tagName !== 'TEXTAREA') {
        requestAnimationFrame(syncIndexWithScroll);
      }
    };
    
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });

    // Setup keyboard shortcuts
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't intercept OS-level navigation like Cmd+Up (Home) or Cmd+Down (End) on Mac, or Ctrl+Home on Windows
      if (e.metaKey || e.ctrlKey) return;

      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
      if ((document.activeElement as HTMLElement)?.isContentEditable) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const active = getCurrentVisibleIndex();
        focusArticle(active + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const active = getCurrentVisibleIndex();
        focusArticle(active - 1);
      }
    };
    
    document.addEventListener('keydown', onKeyDown);

    // Initial delayed render for deeply lazy react trees
    setTimeout(updateArticles, 1000);
    setTimeout(updateArticles, 3000);

    return () => {
      observer.disconnect();
      clearTimeout(updateTimeout);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('scroll', onScroll, { capture: true });
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [getCurrentVisibleIndex, syncIndexWithScroll, focusArticle]);


  return (
    <Timeline 
      articles={articles} 
      activeIndex={activeIndex} 
      onDotClick={focusArticle} 
    />
  );
}
