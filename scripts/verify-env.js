const required = [
  "NEXTAUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "DATABASE_URL",
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error("Missing required environment variables:", missing.join(", "));
  process.exit(1);
}

console.log("All required environment variables are set.");
