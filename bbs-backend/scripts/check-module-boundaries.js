import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, "../src");
const MODULES_DIR = path.join(SRC_DIR, "modules");

const importRegex = /import\s+(?:[^"']+\s+from\s+)?["']([^"']+)["'];?/g;

function walk(dir, collected = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, collected);
      continue;
    }
    if (entry.isFile() && fullPath.endsWith(".js")) {
      collected.push(fullPath);
    }
  }
  return collected;
}

function normalizePath(p) {
  return p.split(path.sep).join("/");
}

function getModuleName(filePath) {
  const normalized = normalizePath(filePath);
  const marker = "/src/modules/";
  const start = normalized.indexOf(marker);
  if (start === -1) return null;
  const rest = normalized.slice(start + marker.length);
  return rest.split("/")[0] || null;
}

function isServiceFile(filePath) {
  return (
    normalizePath(filePath).includes("/src/modules/") &&
    normalizePath(filePath).includes("/service/")
  );
}

function isRestrictedCrossModuleImport(importerPath, importedPath) {
  const importerModule = getModuleName(importerPath);
  const importedModule = getModuleName(importedPath);

  if (!importerModule || !importedModule) return false;
  if (importerModule === importedModule) return false;

  const normalizedImported = normalizePath(importedPath);
  return (
    normalizedImported.includes(`/src/modules/${importedModule}/repository/`) ||
    normalizedImported.includes(`/src/modules/${importedModule}/model/`)
  );
}

function run() {
  const allJsFiles = walk(MODULES_DIR);
  const serviceFiles = allJsFiles.filter(isServiceFile);

  const violations = [];

  for (const serviceFile of serviceFiles) {
    const content = fs.readFileSync(serviceFile, "utf8");
    importRegex.lastIndex = 0;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (!importPath.startsWith(".")) {
        continue;
      }

      const resolvedBase = path.resolve(path.dirname(serviceFile), importPath);
      const candidatePaths = [
        resolvedBase,
        `${resolvedBase}.js`,
        path.join(resolvedBase, "index.js"),
      ];

      const resolvedImport = candidatePaths.find((candidate) =>
        fs.existsSync(candidate),
      );

      if (!resolvedImport) {
        continue;
      }

      if (isRestrictedCrossModuleImport(serviceFile, resolvedImport)) {
        violations.push({
          importer: normalizePath(path.relative(process.cwd(), serviceFile)),
          importPath,
          imported: normalizePath(path.relative(process.cwd(), resolvedImport)),
        });
      }
    }
  }

  if (violations.length === 0) {
    console.log("✅ Module boundary check passed.");
    process.exit(0);
  }

  console.error("❌ Module boundary violations found:");
  for (const violation of violations) {
    console.error(
      `- ${violation.importer} imports ${violation.importPath} (${violation.imported})`,
    );
  }
  console.error(
    "\nRule: modules may call other modules via service layer only (no cross-module model/repository imports from services).",
  );
  process.exit(1);
}

run();
