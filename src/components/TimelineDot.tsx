import React from 'react';
import type { Role } from '../types/timeline';
import { DOT_SIZE } from './timelineUi';

export interface TimelineDotProps {
  role: Role | null;
  isHighlighted: boolean;
  scale: number;
  onClick: () => void;
  onHoverChange?: (isHovered: boolean) => void;
  style?: React.CSSProperties;
}

export function TimelineDot({ role, isHighlighted, scale, onClick, onHoverChange, style }: TimelineDotProps) {
  let classes = 'absolute cursor-pointer transition-transform duration-200 chatgpt-scroller-dot z-20 border-0 p-0 rounded-full';

  if (isHighlighted) {
    classes += ' bg-scroller-dot-active';
  } else {
    classes += ' bg-scroller-dot-idle hover:bg-scroller-dot-idle-hover';
  }

  return (
    <button
      type="button"
      className={classes}
      title={role === 'user' ? 'User' : 'ChatGPT'}
      onClick={onClick}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      style={{
        width: `${DOT_SIZE}px`,
        height: `${DOT_SIZE}px`,
        transform: `scale(${scale})`,
        transformOrigin: 'center',
        ...style
      }}
    />
  );
}
