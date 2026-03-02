import React, { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { Timeline } from './Timeline';
import type { ViewportArticle } from '../types/timeline';

const sampleArticles: ViewportArticle[] = [
  {
    id: 't-001',
    role: 'user',
    previewText: 'How can I structure tests for a browser extension content script?'
  },
  {
    id: 't-002',
    role: 'assistant',
    previewText: null
  },
  {
    id: 't-003',
    role: 'user',
    previewText: 'What tradeoffs should I consider when debouncing scroll handlers?'
  },
  {
    id: 't-004',
    role: 'assistant',
    previewText: null
  },
  {
    id: 't-005',
    role: 'assistant',
    previewText: null
  },
  {
    id: 't-006',
    role: 'user',
    previewText: 'Can you suggest a compact Storybook setup for these components?'
  }
];

function TimelineDemo({
  initialActiveIndex,
  articles = sampleArticles
}: {
  initialActiveIndex: number;
  articles?: React.ComponentProps<typeof Timeline>['articles'];
}) {
  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);

  return (
    <div style={{ minHeight: '90vh' }}>
      <div
        id="thread"
        style={{
          width: 760,
          maxWidth: 'calc(100vw - 200px)',
          marginLeft: 120,
          height: 1
        }}
      />
      <Timeline articles={articles} activeIndex={activeIndex} onDotClick={setActiveIndex} />
    </div>
  );
}

const meta = {
  title: 'Components/Timeline',
  component: Timeline,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen'
  },
  args: {
    articles: sampleArticles,
    activeIndex: 1,
    onDotClick: () => {}
  },
  argTypes: {
    onDotClick: {
      table: {
        disable: true
      }
    }
  }
} satisfies Meta<typeof Timeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  render: (args) => <TimelineDemo initialActiveIndex={args.activeIndex} articles={args.articles} />
};

export const ActiveAtEnd: Story = {
  args: {
    activeIndex: sampleArticles.length - 1
  },
  render: (args) => <TimelineDemo initialActiveIndex={args.activeIndex} articles={args.articles} />
};

export const SingleTurn: Story = {
  args: {
    articles: [
      {
        id: 'single-1',
        role: 'assistant',
        previewText: null
      }
    ],
    activeIndex: 0
  },
  render: (args) => <TimelineDemo initialActiveIndex={args.activeIndex} articles={args.articles} />
};
