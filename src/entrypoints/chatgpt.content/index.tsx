import '~/assets/tailwind.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ScrollerApp } from '../../components/ScrollerApp';

export default defineContentScript({
  matches: ['*://chatgpt.com/*'],
  main(ctx) {
    console.log('Scroller for ChatGPT: Content script loaded (React mode)');
    
    const ui = createIntegratedUi(ctx, {
      position: 'inline',
      anchor: 'body',
      append: 'last',
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
