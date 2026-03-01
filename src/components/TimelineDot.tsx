import React from 'react';
import type { Role } from '../types/timeline';

export interface TimelineDotProps {
  role: Role | null;
  isActive: boolean;
  onClick: () => void;
}

export function TimelineDot({ role, isActive, onClick }: TimelineDotProps) {
  // Base tailwind classes for the dot
  let classes = 'w-[10px] h-[10px] cursor-pointer transition-all duration-200 hover:scale-150 chatgpt-scroller-dot'; // Removed background color as it depends on active state

  if (isActive) {
    classes += ' bg-scroller-dot-active scale-125';
  } else {
    classes += ' bg-scroller-dot-idle hover:bg-scroller-dot-idle-hover';
  }

  // Check if it's a user or assistant message
  if (role === 'user') {
    classes += ' rounded-md'; // User messages are square-ish
  } else {
    classes += ' rounded-full'; // Assistant messages are full circles
  }

  return (
    <div
      className={classes}
      title={role === 'user' ? 'User' : 'ChatGPT'}
      onClick={onClick}
    />
  );
}
