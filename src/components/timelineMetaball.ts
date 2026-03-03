import {
  CONNECTOR_BLEND,
  CONNECTOR_HANDLE_RATE,
  CONNECTOR_MAX_DISTANCE
} from './timelineUi';

interface Point {
  x: number;
  y: number;
}

interface Circle {
  x: number;
  y: number;
  r: number;
}

function vec(angle: number, length: number): Point {
  return {
    x: Math.cos(angle) * length,
    y: Math.sin(angle) * length
  };
}

function dist(a: Point, b: Point) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function metaballPath(
  ball1: Circle,
  ball2: Circle,
  v = CONNECTOR_BLEND,
  handleLenRate = CONNECTOR_HANDLE_RATE,
  maxDistance = CONNECTOR_MAX_DISTANCE
) {
  const center1 = { x: ball1.x, y: ball1.y };
  const center2 = { x: ball2.x, y: ball2.y };
  let radius1 = ball1.r;
  let radius2 = ball2.r;
  const pi2 = Math.PI / 2;
  const d = dist(center1, center2);
  let u1: number;
  let u2: number;

  if (radius1 === 0 || radius2 === 0) return null;

  if (d > maxDistance || d <= Math.abs(radius1 - radius2)) {
    return null;
  } else if (d < radius1 + radius2) {
    u1 = Math.acos((radius1 * radius1 + d * d - radius2 * radius2) / (2 * radius1 * d));
    u2 = Math.acos((radius2 * radius2 + d * d - radius1 * radius1) / (2 * radius2 * d));
  } else {
    u1 = 0;
    u2 = 0;
  }

  const angle1 = Math.atan2(center2.y - center1.y, center2.x - center1.x);
  const angle2 = Math.acos((radius1 - radius2) / d);
  const angle1a = angle1 + u1 + (angle2 - u1) * v;
  const angle1b = angle1 - u1 - (angle2 - u1) * v;
  const angle2a = angle1 + Math.PI - u2 - (Math.PI - u2 - angle2) * v;
  const angle2b = angle1 - Math.PI + u2 + (Math.PI - u2 - angle2) * v;

  const p1a = { x: center1.x + vec(angle1a, radius1).x, y: center1.y + vec(angle1a, radius1).y };
  const p1b = { x: center1.x + vec(angle1b, radius1).x, y: center1.y + vec(angle1b, radius1).y };
  const p2a = { x: center2.x + vec(angle2a, radius2).x, y: center2.y + vec(angle2a, radius2).y };
  const p2b = { x: center2.x + vec(angle2b, radius2).x, y: center2.y + vec(angle2b, radius2).y };

  const totalRadius = radius1 + radius2;
  let d2 = Math.min(v * handleLenRate, dist(p1a, p2a) / totalRadius);
  d2 *= Math.min(1, (d * 2) / (radius1 + radius2));

  radius1 *= d2;
  radius2 *= d2;

  const h0 = vec(angle1a - pi2, radius1);
  const h1 = vec(angle2a + pi2, radius2);
  const h2 = vec(angle2b - pi2, radius2);
  const h3 = vec(angle1b + pi2, radius1);

  return [
    `M ${p1a.x} ${p1a.y}`,
    `C ${p1a.x + h0.x} ${p1a.y + h0.y}, ${p2a.x + h1.x} ${p2a.y + h1.y}, ${p2a.x} ${p2a.y}`,
    `L ${p2b.x} ${p2b.y}`,
    `C ${p2b.x + h2.x} ${p2b.y + h2.y}, ${p1b.x + h3.x} ${p1b.y + h3.y}, ${p1b.x} ${p1b.y}`,
    'Z'
  ].join(' ');
}
