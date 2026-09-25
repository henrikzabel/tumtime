// Side-effect import for CLI scripts: load .env.local / .env like Next.js does.
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });
