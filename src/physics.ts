export interface Vector2 {
  x: number;
  y: number;
}

export interface SpringBody {
  position: Vector2;
  velocity: Vector2;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function hashString(value: string): number {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}

export function seededRandom(seed: number): () => number {
  let value = seed || 1;
  return () => {
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Independent X/Y spring integration. `response` describes roughly how quickly
 * the body answers a new target; damping 1 is critically damped. Motion starts
 * from the body's live position and velocity, so retargeting stays continuous.
 */
export function stepSpring(
  body: SpringBody,
  target: Vector2,
  deltaSeconds: number,
  response = 0.46,
  dampingRatio = 1,
): void {
  const delta = clamp(deltaSeconds, 0, 1 / 24);
  const omega = (Math.PI * 2) / Math.max(0.16, response);
  const damping = 2 * dampingRatio * omega;
  const stiffness = omega * omega;
  const accelerationX = stiffness * (target.x - body.position.x) - damping * body.velocity.x;
  const accelerationY = stiffness * (target.y - body.position.y) - damping * body.velocity.y;
  body.velocity.x += accelerationX * delta;
  body.velocity.y += accelerationY * delta;
  body.position.x += body.velocity.x * delta;
  body.position.y += body.velocity.y * delta;
}

export function applyPairRepulsion(
  first: SpringBody,
  second: SpringBody,
  minimumDistance: number,
  strength: number,
  deltaSeconds: number,
): void {
  const dx = second.position.x - first.position.x;
  const dy = second.position.y - first.position.y;
  const distance = Math.max(0.01, Math.hypot(dx, dy));
  if (distance >= minimumDistance) return;
  const pressure = ((minimumDistance - distance) / minimumDistance) * strength * deltaSeconds;
  const nx = dx / distance;
  const ny = dy / distance;
  first.velocity.x -= nx * pressure;
  first.velocity.y -= ny * pressure;
  second.velocity.x += nx * pressure;
  second.velocity.y += ny * pressure;
}

/** Apple-style exponential momentum projection. */
export function projectMomentum(velocity: number, decelerationRate = 0.99): number {
  const rate = clamp(decelerationRate, 0.8, 0.999);
  return (velocity / 1000) * rate / (1 - rate);
}

/** Soft resistance after a body crosses a spatial boundary. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  if (!overshoot) return 0;
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

export function limitVelocity(velocity: Vector2, maximum = 1_250): void {
  const magnitude = Math.hypot(velocity.x, velocity.y);
  if (magnitude <= maximum || magnitude === 0) return;
  const scale = maximum / magnitude;
  velocity.x *= scale;
  velocity.y *= scale;
}

export function distanceSquared(first: Vector2, second: Vector2): number {
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  return dx * dx + dy * dy;
}
