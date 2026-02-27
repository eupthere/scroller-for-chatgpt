import '~/assets/tailwind.css';

export default defineContentScript({
  matches: ['*://chatgpt.com/*'],
  main() {
    console.log('Scroller for ChatGPT: Content script loaded');

    let currentIndex = -1;
    let articles: HTMLElement[] = [];
    const timelineContainer = document.createElement('div');
    timelineContainer.id = 'chatgpt-scroller-timeline';

    function mountTimeline() {
      if (!document.body.contains(timelineContainer)) {
        document.body.appendChild(timelineContainer);
      }
      return true;
    }

    timelineContainer.className = 'fixed top-1/2 -translate-y-1/2 flex flex-col gap-2 z-[9999] pointer-events-auto p-2.5 bg-white/10 dark:bg-black/20 backdrop-blur-md rounded-2xl max-h-[80vh] overflow-y-auto opacity-30 hover:opacity-100 transition-opacity duration-300';
    timelineContainer.style.left = '16px'; // Default fallback

    function updateTimelinePosition() {
      const thread = document.getElementById('thread');
      if (thread) {
        const rect = thread.getBoundingClientRect();
        // Position it just inside the left edge of the thread container
        // or slightly outside depending on available space.
        // Let's place it 16px from the left edge of the thread if visible,
        // or fallback to viewport edge if it's too snug.
        const targetLeft = Math.max(16, rect.left + 16);
        timelineContainer.style.left = `${targetLeft}px`;
      }
    }

    function updateArticles() {
      if (!mountTimeline()) return;
      updateTimelinePosition();
      // Find all conversation turns by searching for any element with the relevant data-testid prefix.
      articles = Array.from(document.querySelectorAll('[data-testid^="conversation-turn"]'));
      renderTimeline();
      updateActiveTimelineDot();
    }

    function renderTimeline() {
      timelineContainer.innerHTML = '';
      articles.forEach((article, index) => {
        const dot = document.createElement('div');

        // Base tailwind classes for the dot
        let dotClasses = 'w-[10px] h-[10px] bg-[#ccc] cursor-pointer transition-all duration-200 hover:scale-150 hover:bg-[#888] chatgpt-scroller-dot'; // Added a common class for selection

        // Check if it's a user or assistant message
        const role = article.getAttribute('data-turn') || article.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role');
        if (role === 'user') {
          dotClasses += ' rounded-md'; // User messages are square-ish
          dot.title = 'User';
        } else {
          dotClasses += ' rounded-full'; // Assistant messages are full circles
          dot.title = 'ChatGPT';
        }

        dot.className = dotClasses;

        dot.addEventListener('click', () => {
          focusArticle(index);
        });

        timelineContainer.appendChild(dot);
      });
    }

    function updateActiveTimelineDot() {
      const dots = timelineContainer.querySelectorAll('.chatgpt-scroller-dot');
      dots.forEach((dot, index) => {
        if (index === currentIndex) {
          dot.classList.add('bg-[#10a37f]', 'scale-125'); // Active state
          dot.classList.remove('bg-[#ccc]');
        } else {
          dot.classList.remove('bg-[#10a37f]', 'scale-125');
          dot.classList.add('bg-[#ccc]');
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

      // If we are significantly scrolled above the first message, return -1 so that Down arrow goes to 0.
      if (closestIndex === 0 && articles[0].getBoundingClientRect().top > middle + 200) {
        return -1;
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

    // Keep track of any active timeout to prevent lingering outlines from interrupted highlights
    let outlineTimeout: ReturnType<typeof setTimeout>;

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
      if (outlineTimeout) {
        clearTimeout(outlineTimeout);
        // Clear all previous outlines before applying new ones
        articles.forEach(a => {
          a.style.outline = '';
          a.style.outlineOffset = '';
          a.style.transition = '';
        });
      }

      el.style.outline = '2px solid rgba(16, 163, 127, 0.5)';
      el.style.outlineOffset = '4px';
      el.style.transition = 'outline 0.3s ease-out';

      outlineTimeout = setTimeout(() => {
        el.style.outline = '2px solid transparent';
        setTimeout(() => {
          el.style.outline = '';
          el.style.outlineOffset = '';
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
