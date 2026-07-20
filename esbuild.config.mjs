import * as esbuild from "esbuild";
import { exec } from "child_process";
import { cpSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const isServe = process.argv.includes("--serve");

// Copy CSS files from src/ui/styles/ to dist/styles/
function copyStyles() {
  const src = join(__dirname, "src", "ui", "styles");
  const dest = join(__dirname, "dist", "styles");
  if (existsSync(src)) {
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }
    cpSync(src, dest, { recursive: true });
    console.log("Styles copied to dist/styles/");
  }
}

// Function to pack the ZIP file
function packZip() {
  exec("node .vscode/pack-zip.js", (err, stdout, stderr) => {
    if (err) {
      console.error("Error packing zip:", err);
      return;
    }
    console.log(stdout.trim());
  });
}

// Custom plugin to copy styles and pack ZIP after build
const buildPlugin = {
  name: "build-plugin",
  setup(build) {
    build.onEnd(() => {
      copyStyles();
      packZip();
    });
  },
};

// Base build configuration
let buildConfig = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  minify: true,
  logLevel: "info",
  color: true,
  outdir: "dist",
  plugins: [buildPlugin],
};

// Main function to handle both serve and production builds
(async function () {
  if (isServe) {
    console.log("Starting development server...");

    // Watch and Serve Mode
    const ctx = await esbuild.context(buildConfig);

    await ctx.watch();
    const { host, port } = await ctx.serve({
      servedir: ".",
      port: 3000,
    });

  } else {
    console.log("Building for production...");
    await esbuild.build(buildConfig);
    console.log("Production build complete.");
  }
})();