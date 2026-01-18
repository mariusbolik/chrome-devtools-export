import { watch } from "fs";
import { cp, rm, mkdir } from "fs/promises";
import { join } from "path";

const isWatch = process.argv.includes("--watch");

async function build() {
  const distDir = "./dist";

  // Clean dist
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await mkdir(join(distDir, "icons"), { recursive: true });

  // Bundle TypeScript files
  const entrypoints = [
    "src/devtools.ts",
    "src/panel.ts",
    "src/background.ts",
    "src/content-main.ts",
    "src/content-bridge.ts",
  ];

  const result = await Bun.build({
    entrypoints,
    outdir: distDir,
    target: "browser",
    minify: !isWatch,
    sourcemap: isWatch ? "inline" : "none",
  });

  if (!result.success) {
    console.error("Build failed:");
    result.logs.forEach(log => console.error(log));
    process.exit(1);
  }

  // Copy static files
  await cp("./manifest.json", join(distDir, "manifest.json"));
  await cp("./devtools.html", join(distDir, "devtools.html"));
  await cp("./panel.html", join(distDir, "panel.html"));
  await cp("./panel.css", join(distDir, "panel.css"));
  await cp("./assets", join(distDir, "assets"), { recursive: true });

  // Copy icons if they exist
  try {
    await cp("./icons", join(distDir, "icons"), { recursive: true });
  } catch {
    // Icons directory might not exist yet
  }

  console.log("Build complete! Extension ready in ./dist");
}

// Initial build
await build();

// Watch mode
if (isWatch) {
  console.log("Watching for changes...");

  const watchDirs = ["./src"];
  const watchFiles = ["./manifest.json", "./devtools.html", "./panel.html", "./panel.css"];

  for (const dir of watchDirs) {
    watch(dir, { recursive: true }, async (event, filename) => {
      console.log(`\nFile changed: ${filename}`);
      await build();
    });
  }

  for (const file of watchFiles) {
    watch(file, async () => {
      console.log(`\nFile changed: ${file}`);
      await build();
    });
  }
}
