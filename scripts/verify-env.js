const required = ["DATABASE_URL"];

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
