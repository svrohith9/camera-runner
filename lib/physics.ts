export type Vector2 = {
  x: number;
  y: number;
};

export type Aabb = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type JumpState = {
  y: number;
  vy: number;
  grounded: boolean;
};

export function integrateJump(
  state: JumpState,
  dt: number,
  gravity: number
): JumpState {
  const nextVy = state.vy - gravity * dt;
  const nextY = state.y + nextVy * dt;

  if (nextY <= 0) {
    return {
      y: 0,
      vy: 0,
      grounded: true,
    };
  }

  return {
    y: nextY,
    vy: nextVy,
    grounded: false,
  };
}

export function aabbIntersect(a: Aabb, b: Aabb): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
