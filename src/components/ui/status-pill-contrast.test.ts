/**
 * WCAG 2.1 AA contrast for StatusPill text vs its tinted fill.
 * Parses token hexes from `globals.css` so token drift fails the suite.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const n = Number.parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function srgbToLin(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (
    0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b)
  );
}

function contrastRatio(fg: string, bg: string): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

/** Approximate `color-mix(in oklab, color pct%, white)` in sRGB. */
function mixWithWhite(color: string, pct: number): string {
  const a = hexToRgb(color);
  const t = pct / 100;
  const m = {
    r: Math.round(a.r * t + 255 * (1 - t)),
    g: Math.round(a.g * t + 255 * (1 - t)),
    b: Math.round(a.b * t + 255 * (1 - t)),
  };
  return `#${[m.r, m.g, m.b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** Approximate `bg-color/20` over a solid surface. */
function alphaOver(fg: string, bg: string, alpha: number): string {
  const f = hexToRgb(fg);
  const b = hexToRgb(bg);
  const m = {
    r: Math.round(f.r * alpha + b.r * (1 - alpha)),
    g: Math.round(f.g * alpha + b.g * (1 - alpha)),
    b: Math.round(f.b * alpha + b.b * (1 - alpha)),
  };
  return `#${[m.r, m.g, m.b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function parseThemeTokens(css: string, blockSelector: string): Record<string, string> {
  const re = new RegExp(
    `${blockSelector.replace(".", "\\.")}\\s*\\{([^}]+)\\}`,
    "m",
  );
  const m = css.match(re);
  if (!m?.[1]) throw new Error(`Block ${blockSelector} not found`);
  const out: Record<string, string> = {};
  for (const line of m[1].split(";")) {
    const kv = line.match(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/);
    if (kv) out[kv[1]] = kv[2].toLowerCase();
  }
  return out;
}

const AA = 4.5;

describe("StatusPill text contrast (WCAG AA)", () => {
  const cssPath = path.resolve(__dirname, "../../app/globals.css");
  const css = fs.readFileSync(cssPath, "utf8");
  const light = parseThemeTokens(css, ":root");
  const dark = parseThemeTokens(css, ".dark");

  it("light theme: brand + slate pill pairs ≥ 4.5:1", () => {
    const pairs: { name: string; fg: string; bg: string }[] = [
      {
        name: "success",
        fg: light["success-text"]!,
        bg: mixWithWhite(light.success!, 10),
      },
      {
        name: "warning",
        fg: light["warning-text"]!,
        bg: mixWithWhite(light.warning!, 10),
      },
      {
        name: "error",
        fg: light["error-text"]!,
        bg: mixWithWhite(light.error!, 10),
      },
      {
        name: "slate",
        fg: light["tone-slate-fg"]!,
        bg: light["tone-slate-bg"]!,
      },
    ];
    for (const p of pairs) {
      expect(p.fg, p.name).toBeTruthy();
      expect(contrastRatio(p.fg, p.bg), `${p.name} ${p.fg} on ${p.bg}`).toBeGreaterThanOrEqual(
        AA,
      );
    }
  });

  it("dark theme: brand + slate pill pairs ≥ 4.5:1", () => {
    const card = dark["bg-card"]!;
    const pairs: { name: string; fg: string; bg: string }[] = [
      {
        name: "success",
        fg: dark["success-text"]!,
        bg: alphaOver(dark.success!, card, 0.2),
      },
      {
        name: "warning",
        fg: dark["warning-text"]!,
        bg: alphaOver(dark.warning!, card, 0.2),
      },
      {
        name: "error",
        fg: dark["error-text"]!,
        bg: alphaOver(dark.error!, card, 0.2),
      },
      {
        name: "slate",
        fg: dark["tone-slate-fg"]!,
        bg: dark["tone-slate-bg"]!,
      },
    ];
    for (const p of pairs) {
      expect(p.fg, p.name).toBeTruthy();
      expect(contrastRatio(p.fg, p.bg), `${p.name} ${p.fg} on ${p.bg}`).toBeGreaterThanOrEqual(
        AA,
      );
    }
  });
});
