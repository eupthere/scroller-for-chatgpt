import '~/assets/tailwind.css';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ScrollerApp } from '../../components/ScrollerApp';

export default defineContentScript({
  matches: ['*://chatgpt.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    console.log('Scroller for ChatGPT: Content script loaded (React mode)');

    // Dev reload/HMR safety: clean stale mounted hosts before injecting a fresh UI.
    document.querySelectorAll('chatgpt-scroller-ui').forEach((node) => node.remove());
    document
      .querySelectorAll('style[wxt-shadow-root-document-styles]')
      .forEach((styleNode) => styleNode.remove());
    
    const ui = await createShadowRootUi<Root>(ctx, {
      name: 'chatgpt-scroller-ui',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      isolateEvents: [
        'click',
        'mousedown',
        'mouseup',
        'pointerdown',
        'pointerup',
        'touchstart',
        'touchend',
      ],
      onMount: (container) => {
        const root = createRoot(container);
        root.render(React.createElement(ScrollerApp));
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
