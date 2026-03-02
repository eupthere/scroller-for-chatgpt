import type { Meta, StoryObj } from '@storybook/react-vite';

import { fn } from 'storybook/test';

import { TimelineDot } from './TimelineDot';

const meta = {
  title: 'Components/TimelineDot',
  component: TimelineDot,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered'
  },
  args: {
    role: 'user',
    isHighlighted: false,
    scale: 1,
    onClick: fn(),
    onHoverChange: fn()
  },
  argTypes: {
    role: {
      control: 'select',
      options: ['user', 'assistant', null]
    },
    scale: {
      control: {
        type: 'range',
        min: 0.5,
        max: 2,
        step: 0.05
      }
    }
  }
} satisfies Meta<typeof TimelineDot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UserIdle: Story = {};

export const UserActive: Story = {
  args: {
    isHighlighted: true,
    role: 'user'
  }
};

export const AssistantHoverScale: Story = {
  args: {
    role: 'assistant',
    scale: 1.5
  }
};

export const UnknownRole: Story = {
  args: {
    role: null
  }
};
