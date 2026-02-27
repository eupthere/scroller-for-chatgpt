import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Timeline } from './Timeline';
import type { ViewportArticle } from './Timeline';

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
    
    const middle = window.innerHeight / 2;
    let closestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < domArticles.length; i++) {
      const rect = domArticles[i].getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - middle);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }

    // If we are significantly scrolled above the first message, return -1 so that Down arrow goes to 0.
    if (closestIndex === 0 && domArticles[0].getBoundingClientRect().top > middle + 200) {
      return -1;
    }
    return closestIndex;
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
    el.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
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

    el.style.outline = '2px solid rgba(16, 163, 127, 0.5)';
    el.style.outlineOffset = '4px';
    el.style.transition = 'outline 0.3s ease-out';

    outlineTimeoutRef.current = setTimeout(() => {
      el.style.outline = '2px solid transparent';
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
      
      const newArticles = elements.map(article => ({
        role: article.getAttribute('data-turn') || article.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role')
      }));
      
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
