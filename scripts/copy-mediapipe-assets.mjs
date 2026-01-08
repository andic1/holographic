import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const srcDir = path.join(
  projectRoot,
  "node_modules",
  "@mediapipe",
  "tasks-vision",
  "wasm"
);

const destDir = path.join(
  projectRoot,
  "public",
  "mediapipe",
  "wasm"
);

const modelDir = path.join(
  projectRoot,
  "public",
  "mediapipe",
  "models"
);

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
}

function main() {
  if (!fs.existsSync(srcDir)) {
    console.error(
      `[mediapipe] Source wasm directory not found: ${srcDir}. Did you run npm install?`
    );
    process.exit(1);
  }

  ensureDir(destDir);
  ensureDir(modelDir);

  const files = fs.readdirSync(srcDir);
  const copied = [];

  for (const file of files) {
    if (!file.endsWith(".js") && !file.endsWith(".wasm")) continue;
    const src = path.join(srcDir, file);
    const dest = path.join(destDir, file);
    copyFile(src, dest);
    copied.push(file);
  }

  const modelPath = path.join(modelDir, "hand_landmarker.task");
  const modelExists = fs.existsSync(modelPath);

  console.log(`[mediapipe] Copied wasm assets to ${destDir}: ${copied.length} files`);

  if (!modelExists) {
    console.warn(
      `[mediapipe] Missing model file: ${modelPath}.\n` +
        `Please add hand_landmarker.task under public/mediapipe/models/ so ESA can load it.`
    );
  }
}

main();
