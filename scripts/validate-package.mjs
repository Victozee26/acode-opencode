#!/usr/bin/env node
/**
 * Validates the built plugin zip against the rules Acode applies when it
 * installs a plugin (https://docs.acode.app/docs/plugin-essentials/manifest):
 *
 * - plugin.json must exist at the root of the zip
 * - the file named by `main` must exist at the path the manifest declares
 * - the icon must exist and be at most 50 KB
 * - the readme and changelogs must exist when the manifest points at them
 * - the packaged manifest must match the one in the repository
 * - the version must be identical in plugin.json and package.json
 *
 * The pack script flattens `dist/` into the zip root, so the manifest has to
 * name the file the way the zip actually stores it — otherwise the plugin
 * only loads through Acode's `main.js` fallback.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const zipPath = process.argv[2] ?? join(repoRoot, "dist.zip");

if (!existsSync(zipPath)) {
  console.error(`Package not found: ${zipPath} (run "npm run build" first)`);
  process.exit(1);
}

const zip = await JSZip.loadAsync(readFileSync(zipPath));
const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
const has = (name) => names.includes(name);

const problems = [];
const notes = [];

if (!has("plugin.json")) {
  console.error("plugin.json is not at the root of the zip - Acode rejects the plugin");
  process.exit(1);
}

const manifest = JSON.parse(await zip.file("plugin.json").async("string"));

if (!manifest.main) {
  problems.push("the manifest has no main");
} else if (!has(manifest.main)) {
  problems.push(
    `main "${manifest.main}" is not in the zip` +
      (has("main.js")
        ? " - Acode falls back to main.js, so the plugin loads by accident, but the manifest lies about the artifact"
        : " - and main.js is missing too, so the installation fails"),
  );
}

const icon = manifest.icon || "icon.png";
if (!has(icon)) {
  problems.push(`icon "${icon}" is missing from the zip`);
} else {
  const size = (await zip.file(icon).async("uint8array")).length;
  if (size > 50 * 1024) {
    problems.push(`icon ${icon} is ${size} bytes, the limit is 50KB`);
  } else {
    notes.push(`icon ${icon} = ${size} bytes`);
  }
}

for (const [field, fallback] of [
  ["readme", "readme.md"],
  ["changelogs", "changelogs.md"],
]) {
  const file = manifest[field] || fallback;
  if (!has(file)) problems.push(`${field} "${file}" is missing from the zip`);
}

for (const required of ["id", "name", "version", "author"]) {
  if (!manifest[required]) problems.push(`the manifest has no ${required}`);
}

if (typeof manifest.minVersionCode !== "number" || manifest.minVersionCode < 290) {
  problems.push(`minVersionCode ${manifest.minVersionCode} is invalid (the schema requires 290 or more)`);
}

const repoManifest = JSON.parse(readFileSync(join(repoRoot, "plugin.json"), "utf8"));
if (JSON.stringify(repoManifest) !== JSON.stringify(manifest)) {
  problems.push("the packaged plugin.json differs from the plugin.json in the repository");
}

const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
if (pkg.version !== manifest.version) {
  problems.push(`version mismatch: package.json says ${pkg.version}, plugin.json says ${manifest.version}`);
}

for (const entry of manifest.files ?? []) {
  const prefix = entry.endsWith("/") ? entry : `${entry}/`;
  if (!names.some((name) => name === entry || name.startsWith(prefix))) {
    problems.push(`the manifest lists "${entry}" in files, but the zip does not contain it`);
  }
}

console.log(`Package: ${zipPath}`);
console.log(
  `  id=${manifest.id} version=${manifest.version} main=${manifest.main} minVersionCode=${manifest.minVersionCode}`,
);
console.log(`  ${names.length} entries, root: ${names.filter((n) => !n.includes("/")).join(", ")}`);
for (const note of notes) console.log(`  ${note}`);

if (problems.length > 0) {
  console.error("The package does not satisfy Acode's install rules:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log("  OK - the package satisfies Acode's install rules");
