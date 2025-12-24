import { describe, expect, it } from "vitest";
import { aabbIntersect, integrateJump } from "../lib/physics";

describe("integrateJump", () => {
  it("falls under gravity", () => {
    const state = integrateJump({ y: 100, vy: 0, grounded: false }, 0.1, 2000);
    expect(state.y).toBeLessThan(100);
    expect(state.vy).toBeLessThan(0);
  });

  it("stops at ground", () => {
    const state = integrateJump({ y: 5, vy: -300, grounded: false }, 0.1, 2000);
    expect(state.y).toBe(0);
    expect(state.vy).toBe(0);
    expect(state.grounded).toBe(true);
  });
});

describe("aabbIntersect", () => {
  it("detects overlap", () => {
    const hit = aabbIntersect(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 5, y: 5, width: 10, height: 10 }
    );
    expect(hit).toBe(true);
  });

  it("detects separation", () => {
    const hit = aabbIntersect(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 20, y: 20, width: 5, height: 5 }
    );
    expect(hit).toBe(false);
  });
});
