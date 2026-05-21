import { execSync } from "node:child_process";
import { readdirSync, unlinkSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "public");

// ── images: png → webp ──────────────────────────────────────────────────────

const WEBP_QUALITY = 80;

function* walkImages(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkImages(full);
    } else if (/\.png$/i.test(entry.name)) {
      yield full;
    }
  }
}

async function compressImages() {
  const imgDir = join(PUBLIC, "img");
  const files = [...walkImages(imgDir)];

  console.log(`\n🎨 Images: converting ${files.length} PNG(s) → WebP\n`);

  let saved = 0;
  for (const png of files) {
    const webp = png.replace(/\.png$/i, ".webp");
    const before = statSync(png).size;

    await sharp(png)
      .webp({ quality: WEBP_QUALITY, effort: 6 })
      .toFile(webp);

    const after = statSync(webp).size;
    saved += before - after;

    console.log(
      `  ${png.replace(ROOT, "")}  ${fmtSize(before)} → ${fmtSize(after)}  (${pct(before, after)}%)`
    );
    unlinkSync(png);
  }

  if (saved > 0) console.log(`\n  Images saved: ${fmtSize(saved)}`);
}

// ── audio: mp3 re-encode ────────────────────────────────────────────────────

const ffmpeg = "ffmpeg";

function hasFfmpeg() {
  try {
    execSync(`which ${ffmpeg}`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function* walkAudio(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkAudio(full);
    } else if (/\.mp3$/i.test(entry.name)) {
      yield full;
    }
  }
}

async function compressAudio() {
  if (!hasFfmpeg()) {
    console.log(
      "\n🔇 audio: ffmpeg not found — skipping.\n" +
        "   Install it:  sudo apt install ffmpeg"
    );
    return;
  }

  const audioDir = join(PUBLIC, "audio");
  const files = [...walkAudio(audioDir)];

  console.log(`\n🔊 Audio: re-encoding ${files.length} MP3(s)\n`);

  let saved = 0;

  for (const mp3 of files) {
    const tmp = mp3 + ".tmp.mp3";
    const before = statSync(mp3).size;

    // 64k for the main track, 48k for sound effects
    const isMain = mp3.endsWith("audio.mp3");
    const bitrate = isMain ? "64k" : "48k";

    execSync(
      `${ffmpeg} -y -i "${mp3}" -ac 1 -b:a ${bitrate} "${tmp}"`,
      { stdio: "pipe" }
    );

    const after = statSync(tmp).size;
    saved += before - after;

    console.log(
      `  ${mp3.replace(ROOT, "")}  ${fmtSize(before)} → ${fmtSize(after)}  (${pct(before, after)}%)\n` +
      `    bitrate: ${bitrate} mono`
    );

    // replace original
    unlinkSync(mp3);
    execSync(`mv "${tmp}" "${mp3}"`);
  }

  if (saved > 0) console.log(`\n  Audio saved: ${fmtSize(saved)}`);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtSize(bytes) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${(bytes / 1024).toFixed(1)} KB`;
}

function pct(before, after) {
  return ((after / before) * 100).toFixed(0);
}

// ── run ─────────────────────────────────────────────────────────────────────

await compressImages();
await compressAudio();

console.log("\n✅ Done.\n");
