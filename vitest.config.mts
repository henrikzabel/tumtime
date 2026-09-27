import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    globalSetup: ["./vitest.global-setup.ts"],
    // Integration tests share one database and truncate overlapping tables (e.g. users, modules);
    // run files one after another when they are enabled.
    fileParallelism: !process.env.TEST_DATABASE_URL,
  },
});
