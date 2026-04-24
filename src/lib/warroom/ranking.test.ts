import { describe, expect, it } from "vitest"
import { tierFromScore } from "./ranking"

describe("tierFromScore", () => {
  it("returns 'hot' for scores >= 80", () => {
    expect(tierFromScore(80)).toBe("hot")
    expect(tierFromScore(100)).toBe("hot")
    expect(tierFromScore(95.5)).toBe("hot")
  })

  it("returns 'warm' for scores 60..79", () => {
    expect(tierFromScore(60)).toBe("warm")
    expect(tierFromScore(79.9)).toBe("warm")
    expect(tierFromScore(70)).toBe("warm")
  })

  it("returns 'cool' for scores 40..59", () => {
    expect(tierFromScore(40)).toBe("cool")
    expect(tierFromScore(59)).toBe("cool")
    expect(tierFromScore(50)).toBe("cool")
  })

  it("returns 'cold' for scores < 40", () => {
    expect(tierFromScore(39)).toBe("cold")
    expect(tierFromScore(0)).toBe("cold")
    expect(tierFromScore(-10)).toBe("cold")
  })

  it("holds the tier boundary contract: thresholds 80/60/40", () => {
    // Exact boundaries — regression guard for threshold drift.
    expect(tierFromScore(79)).toBe("warm")
    expect(tierFromScore(80)).toBe("hot")
    expect(tierFromScore(59)).toBe("cool")
    expect(tierFromScore(60)).toBe("warm")
    expect(tierFromScore(39)).toBe("cold")
    expect(tierFromScore(40)).toBe("cool")
  })
})
