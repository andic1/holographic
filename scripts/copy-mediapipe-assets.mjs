import fs from "node:fs";
import https from "node:https";
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

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    const request = https.get(url, (res) => {
      if (res.statusCode !== 200) {
        file.close(() => {
          fs.existsSync(destPath) && fs.unlinkSync(destPath);
          reject(new Error(`[mediapipe] Download failed: ${url} (status ${res.statusCode})`));
        });
        return;
      }

      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    });

    request.on("error", (err) => {
      file.close(() => {
        fs.existsSync(destPath) && fs.unlinkSync(destPath);
        reject(err);
      });
    });
  });
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
    const modelUrl =
      process.env.MEDIAPIPE_HAND_LANDMARKER_URL ||
      "https://storage.googleapis.com/mediapipe-tasks/vision/hand_landmarker/hand_landmarker.task";

    console.warn(`[mediapipe] Missing model file: ${modelPath}`);
    console.log(`[mediapipe] Downloading model from: ${modelUrl}`);

    return download(modelUrl, modelPath)
      .then(() => {
        console.log(`[mediapipe] Downloaded model to ${modelPath}`);
      })
      .catch((err) => {
        console.warn(
          `[mediapipe] Failed to download model. You can manually place it at: ${modelPath}`
        );
        console.warn(String(err?.message || err));
      });
  }
}

Promise.resolve(main()).catch((err) => {
  console.error(String(err?.message || err));
  process.exit(1);
});
