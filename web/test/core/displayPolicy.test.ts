import { expect, test } from "vitest";
import { sceneOf, showsUmbrella } from "../../src/core/displayPolicy";
import { at } from "../support";

test("sceneBoundaries", () => {
  expect(sceneOf(at(2026, 11, 19, 5, 59))).toBe("night");
  expect(sceneOf(at(2026, 11, 19, 6, 0))).toBe("day");
  expect(sceneOf(at(2026, 11, 19, 17, 59))).toBe("day");
  expect(sceneOf(at(2026, 11, 19, 18, 0))).toBe("night");
});

test("umbrellaRules", () => {
  const school = at(2026, 11, 19, 8, 20);
  const seven = at(2026, 11, 19, 7, 0);
  expect(showsUmbrella(50, seven, school)).toBe(true);
  expect(showsUmbrella(49, seven, school)).toBe(false);
  expect(showsUmbrella(80, school, school)).toBe(false);
  expect(showsUmbrella(80, seven, null)).toBe(false);
});
