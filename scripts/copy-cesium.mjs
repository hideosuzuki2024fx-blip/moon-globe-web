import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const sourceDir = resolve("node_modules", "cesium", "Build", "Cesium");
const targetDir = resolve("public", "cesium", "Cesium");

if (!existsSync(sourceDir)) {
  console.log("[postinstall] Cesium source not found, skipping copy.");
  process.exit(0);
}

mkdirSync(targetDir, { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true, force: true });
console.log("[postinstall] Copied Cesium static assets.");
