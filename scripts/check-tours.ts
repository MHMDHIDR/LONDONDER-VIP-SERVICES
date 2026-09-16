/**
 * Fails the build when a registered tour points at an anchor that no component renders.
 * Run with `bun run check:tours`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { TOURS } from "../src/tours/registry";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const source = walk("src")
  .filter((file) => /\.(tsx?|css)$/.test(file))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

const missing: string[] = [];
let total = 0;
for (const tour of TOURS) {
  for (const step of tour.steps) {
    total += 1;
    // Anchors are written as data-tour="x", ChartCard tourId="x", or a nav item tour: "x".
    const present = [
      `data-tour="${step.anchor}"`,
      `tourId="${step.anchor}"`,
      `tour: "${step.anchor}"`,
    ].some((needle) => source.includes(needle));
    if (!present) missing.push(`${tour.id} → ${step.anchor}`);
  }
}

if (missing.length > 0) {
  console.error(`Tour anchors missing from src/:\n  ${missing.join("\n  ")}`);
  process.exit(1);
}
console.log(`All ${total} tour anchors are present.`);
