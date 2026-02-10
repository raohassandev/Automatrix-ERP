import fs from "node:fs";
import path from "node:path";

// Best-effort local `.env` loader (deploy environments should set env vars via PM2/systemd).
function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv(path.resolve(process.cwd(), ".env"));

const required = ["DATABASE_URL", "NEXTAUTH_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"];

const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
if (!authSecret) {
  console.error("Missing required environment variables: AUTH_SECRET (or NEXTAUTH_SECRET)");
  process.exit(1);
}

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error("Missing required environment variables:", missing.join(", "));
  process.exit(1);
}

console.log("All required environment variables are set.");
