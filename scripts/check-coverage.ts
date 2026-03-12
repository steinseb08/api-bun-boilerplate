import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type FileCoverage = {
  file: string;
  covered: number;
  total: number;
  pct: number;
};

const GLOBAL_LINE_THRESHOLD = 85;
const CRITICAL_LINE_THRESHOLD = 90;

const CRITICAL_FILE_PATTERNS: RegExp[] = [
  /^src\/routes\//,
  /^src\/middleware\//,
  /^src\/provider\/express\.ts$/,
  /^src\/utils\/problem\.ts$/,
];

function normalizePath(filePath: string): string {
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  const relative = path.relative(process.cwd(), absolute);
  return relative.split(path.sep).join("/");
}

function parseLcov(content: string): FileCoverage[] {
  const results: FileCoverage[] = [];
  let currentFile: string | null = null;
  let covered = 0;
  let total = 0;

  const flush = () => {
    if (!currentFile) return;
    const normalized = normalizePath(currentFile);
    if (!normalized.startsWith("src/")) {
      currentFile = null;
      covered = 0;
      total = 0;
      return;
    }

    const pct = total === 0 ? 100 : (covered / total) * 100;
    results.push({
      file: normalized,
      covered,
      total,
      pct,
    });
    currentFile = null;
    covered = 0;
    total = 0;
  };

  for (const line of content.split("\n")) {
    if (line.startsWith("SF:")) {
      flush();
      currentFile = line.slice(3).trim();
      continue;
    }

    if (line.startsWith("DA:")) {
      const [, hitRaw] = line.slice(3).split(",");
      const hits = Number(hitRaw ?? "0");
      total += 1;
      if (hits > 0) covered += 1;
      continue;
    }

    if (line === "end_of_record") {
      flush();
    }
  }

  flush();
  return results;
}

function isCritical(file: string): boolean {
  return CRITICAL_FILE_PATTERNS.some((pattern) => pattern.test(file));
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const lcovPath = path.resolve(process.cwd(), "coverage", "lcov.info");
if (!existsSync(lcovPath)) {
  fail(
    "Coverage report not found at coverage/lcov.info. Run coverage with lcov reporter first, e.g. bun test --coverage --coverage-reporter lcov.",
  );
}

const lcovContent = readFileSync(lcovPath, "utf8");
const files = parseLcov(lcovContent);

if (files.length === 0) {
  fail("No source file coverage entries found in coverage/lcov.info");
}

const globalCovered = files.reduce((sum, file) => sum + file.covered, 0);
const globalTotal = files.reduce((sum, file) => sum + file.total, 0);
const globalPct = globalTotal === 0 ? 100 : (globalCovered / globalTotal) * 100;

const criticalFiles = files.filter((file) => isCritical(file.file));
const globalFailed = globalPct < GLOBAL_LINE_THRESHOLD;
const criticalFailed = criticalFiles.filter((file) => file.pct < CRITICAL_LINE_THRESHOLD);

if (!globalFailed && criticalFailed.length === 0) {
  console.log(
    `Coverage gate passed: global ${globalPct.toFixed(2)}% (min ${GLOBAL_LINE_THRESHOLD}%), critical files >= ${CRITICAL_LINE_THRESHOLD}%.`,
  );
  process.exit(0);
}

console.error("Coverage gate failed.");
console.error(`Global line coverage: ${globalPct.toFixed(2)}% (required >= ${GLOBAL_LINE_THRESHOLD}%)`);

if (criticalFiles.length === 0) {
  console.error("No critical files detected in lcov report.");
}

if (criticalFailed.length > 0) {
  console.error(`Critical file threshold failures (required >= ${CRITICAL_LINE_THRESHOLD}%):`);
  for (const file of criticalFailed) {
    console.error(`- ${file.file}: ${file.pct.toFixed(2)}% (${file.covered}/${file.total})`);
  }
}

process.exit(1);

