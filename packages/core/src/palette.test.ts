import assert from "node:assert/strict";
import { test } from "node:test";
import { palette, paletteCss } from "./palette.ts";

test("every token becomes a kebab-case variable in both appearances", () => {
  const css = paletteCss();
  assert.match(css, /--accent-soft: rgba\(0, 52, 143, 0\.12\);/);
  assert.match(css, /prefers-color-scheme: dark\) \{ :root \{[^}]*--accent: #6fa8ff;/);
  for (const token of Object.keys(palette)) {
    const name = `--${token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:`;
    assert.equal(css.split(` ${name}`).length, 3, name);
  }
});
