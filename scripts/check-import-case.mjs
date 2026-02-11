import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

/**
 * Verifies that TypeScript/Next import paths match the real on-disk casing.
 * This catches issues that can pass on case-insensitive macOS FS but fail in Linux CI.
 */

const repoRoot = process.cwd();
const aliasPrefix = "@/"; // maps to src/

function listTrackedSourceFiles() {
  const out = execSync("git ls-files", { encoding: "utf8" });
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((f) => f.startsWith("src/") && (f.endsWith(".ts") || f.endsWith(".tsx")));
}

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function getDirEntries(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return null;
  }
}

function existsPathCaseSensitive(absPath) {
  const normalized = path.resolve(absPath);
  const parsed = path.parse(normalized);
  // On macOS, parsed.root is like "/" and the path starts with it.
  let current = parsed.root;
  const rest = normalized.slice(parsed.root.length);
  const segments = rest.split(path.sep).filter(Boolean);

  for (const seg of segments) {
    const entries = getDirEntries(current);
    if (!entries) return false;
    const exact = entries.find((e) => e === seg);
    if (!exact) return false;
    current = path.join(current, exact);
  }

  return true;
}

function resolveImportToAbs(fromFileAbs, spec) {
  if (spec.startsWith(aliasPrefix)) {
    const rel = spec.slice(aliasPrefix.length);
    return path.join(repoRoot, "src", rel);
  }
  if (spec.startsWith(".")) {
    return path.resolve(path.dirname(fromFileAbs), spec);
  }
  return null; // external package
}

function candidatePaths(baseAbs) {
  const exts = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
  const out = [];

  // direct file with extension
  for (const ext of exts) out.push(baseAbs + ext);

  // direct file if spec already had extension
  out.push(baseAbs);

  // index files
  for (const ext of exts) out.push(path.join(baseAbs, "index" + ext));

  return out;
}

function extractImports(source) {
  const specs = [];

  // import ... from "x"
  for (const m of source.matchAll(/\bfrom\s+["']([^"']+)["']/g)) specs.push(m[1]);
  // import("x")
  for (const m of source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) specs.push(m[1]);
  // require("x")
  for (const m of source.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g)) specs.push(m[1]);

  return specs;
}

const files = listTrackedSourceFiles();
const failures = [];

for (const file of files) {
  const abs = path.join(repoRoot, file);
  const src = readFileSafe(abs);
  if (!src) continue;

  for (const spec of extractImports(src)) {
    const base = resolveImportToAbs(abs, spec);
    if (!base) continue;

    const candidates = candidatePaths(base);
    const found = candidates.find((p) => existsPathCaseSensitive(p));
    if (!found) {
      failures.push({ file, spec, resolvedBase: path.relative(repoRoot, base) });
    }
  }
}

if (failures.length) {
  console.error("Import casing/path resolution failures (case-sensitive):");
  for (const f of failures) {
    console.error(`- ${f.file}: cannot resolve '${f.spec}' (base: ${f.resolvedBase})`);
  }
  process.exit(1);
}

console.log(`OK: ${files.length} files scanned; no case-sensitive import resolution issues found.`);

