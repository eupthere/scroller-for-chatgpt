

export default defineContentScript({
  matches: ['*://chatgpt.com/*'],
  main() {
    console.log('Scroller for ChatGPT: Content script loaded');

    let currentIndex = -1;
    let articles: HTMLElement[] = [];
    const timelineContainer = document.createElement('div');
    timelineContainer.id = 'chatgpt-scroller-timeline';
    document.body.appendChild(timelineContainer);

    // CSS for timeline
    const style = document.createElement('style');
    style.textContent = `
      #chatgpt-scroller-timeline {
        position: fixed;
        left: 16px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        gap: 8px;
        z-index: 9999;
        pointer-events: auto;
        padding: 10px;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        border-radius: 20px;
        max-height: 80vh;
        overflow-y: auto;
        opacity: 0.3;
        transition: opacity 0.3s;
      }
      #chatgpt-scroller-timeline:hover {
        opacity: 1;
      }
      @media (prefers-color-scheme: dark) {
        #chatgpt-scroller-timeline {
          background: rgba(0, 0, 0, 0.2);
        }
      }
      .timeline-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background-color: #ccc;
        cursor: pointer;
        transition: transform 0.2s, background-color 0.2s;
      }
      .timeline-dot:hover {
        transform: scale(1.5);
        background-color: #888;
      }
      .timeline-dot.active {
        background-color: #10a37f; /* ChatGPT green */
        transform: scale(1.3);
      }
      .timeline-dot.user {
        border-radius: 4px; /* visually distinguish user messages */
      }
    `;
    document.head.appendChild(style);

    function updateArticles() {
      // Find all conversation items. They are inside div[data-testid^="conversation-turn"] usually, or article tags.
      articles = Array.from(document.querySelectorAll('article[data-testid^="conversation-turn"]'));
      renderTimeline();
      updateActiveTimelineDot();
    }

    function renderTimeline() {
      timelineContainer.innerHTML = '';
      articles.forEach((article, index) => {
        const dot = document.createElement('div');
        dot.className = 'timeline-dot';
        
        // Check if it's a user or assistant message
        const role = article.getAttribute('data-turn') || article.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role');
        if (role === 'user') {
          dot.classList.add('user');
          dot.title = 'User';
        } else {
          dot.title = 'ChatGPT';
        }

        dot.addEventListener('click', () => {
          focusArticle(index);
        });

        timelineContainer.appendChild(dot);
      });
    }

    function updateActiveTimelineDot() {
      const dots = timelineContainer.querySelectorAll('.timeline-dot');
      dots.forEach((dot, index) => {
        if (index === currentIndex) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    }

    function getCurrentVisibleIndex(): number {
      if (!articles.length) return -1;
      const middle = window.innerHeight / 2;
      
      let closestIndex = 0;
      let minDistance = Infinity;

      for (let i = 0; i < articles.length; i++) {
        const rect = articles[i].getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - middle);
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = i;
        }
      }
      return closestIndex;
    }

    function syncIndexWithScroll() {
      const visibleIndex = getCurrentVisibleIndex();
      if (visibleIndex !== -1 && visibleIndex !== currentIndex) {
        currentIndex = visibleIndex;
        updateActiveTimelineDot();
      }
    }

    function focusArticle(index: number) {
      if (!articles.length) return;
      currentIndex = Math.max(0, Math.min(index, articles.length - 1));
      
      const el = articles[currentIndex];
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      
      updateActiveTimelineDot();
      
      // Flash outline
      const originalOutline = el.style.outline;
      el.style.outline = '2px solid rgba(16, 163, 127, 0.5)';
      el.style.outlineOffset = '4px';
      el.style.transition = 'outline 0.3s ease-out';
      
      setTimeout(() => {
        el.style.outline = '2px solid rgba(16, 163, 127, 0)';
        setTimeout(() => {
          el.style.outline = originalOutline;
          el.style.transition = '';
        }, 300);
      }, 500);
    }

    let updateTimeout: ReturnType<typeof setTimeout>;
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

    function startObserving() {
      const mainContent = document.querySelector('main') || document.body;
      observer.observe(mainContent, { childList: true, subtree: true });
      updateArticles();
    }

    // Listen to scroll to update timeline
    window.addEventListener('scroll', () => {
      // Small debounce for scroll
      requestAnimationFrame(syncIndexWithScroll);
    }, { passive: true });
    
    // Some internal scrolling occurs on the application's specific containers, not window
    document.addEventListener('scroll', (e) => {
      if ((e.target as HTMLElement).tagName !== 'TEXTAREA') {
        requestAnimationFrame(syncIndexWithScroll);
      }
    }, { capture: true, passive: true });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Avoid interfering with typing
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) {
        return;
      }
      // Or if focus is in a contenteditable
      if ((document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const active = getCurrentVisibleIndex();
        focusArticle(active + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const active = getCurrentVisibleIndex();
        focusArticle(active - 1);
      }
    });

    // Initialize
    startObserving();
    // In case react renders late
    setTimeout(updateArticles, 1000);
    setTimeout(updateArticles, 3000);
  },
});
