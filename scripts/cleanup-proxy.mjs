/**
 * Prebuild cleanup: removes src/middleware.ts before each build.
 *
 * Next.js 16 errors if both middleware.ts and proxy.ts exist in src/.
 * proxy.ts is the new canonical convention; middleware.ts is deprecated.
 * This script ensures middleware.ts is gone before Next.js scans the directory.
 */
import { unlinkSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Delete the deprecated middleware.ts — proxy.ts is now the canonical file.
const middleware = join(root, "src", "middleware.ts");
if (existsSync(middleware)) {
  unlinkSync(middleware);
  console.log("cleanup-proxy: removed src/middleware.ts (deprecated — proxy.ts is canonical)");
} else {
  console.log("cleanup-proxy: src/middleware.ts not present, nothing to do");
}
