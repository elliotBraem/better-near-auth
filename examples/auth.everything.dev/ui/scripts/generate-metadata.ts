import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDotIconSvg,
  createPngIcoBuffer,
  SOCIAL_IMAGE_HEIGHT,
  SOCIAL_IMAGE_WIDTH,
} from "everything-dev/ui/metadata";
import sharp from "sharp";

const APP_NAME = "everything.dev";
const BRAND_DOT_COLOR = "#111111";
const METADATA_IMAGE_ALT = "everything.dev splash screen with an under construction banner";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uiDir = path.resolve(__dirname, "..");
const publicDir = path.join(uiDir, "public");
const assetsDir = path.join(uiDir, "src", "assets");

const metadataPath = path.join(publicDir, "metadata.png");
const underConstructionPath = path.join(assetsDir, "under-construction.gif");

async function main() {
  await mkdir(publicDir, { recursive: true });

  const underConstructionBuffer = await readFile(underConstructionPath);
  const underConstructionPngBuffer = await sharp(underConstructionBuffer, { animated: false })
    .png()
    .toBuffer();
  const underConstructionDataUri = `data:image/png;base64,${underConstructionPngBuffer.toString("base64")}`;

  await writeFile(
    path.join(publicDir, "icon.svg"),
    createDotIconSvg({ size: 64, color: BRAND_DOT_COLOR }),
  );
  await writeFile(
    path.join(publicDir, "icon_rev.svg"),
    createDotIconSvg({ size: 64, color: BRAND_DOT_COLOR }),
  );

  const favicon32 = await renderPngBuffer(32, 32);
  await writeFile(path.join(publicDir, "favicon.ico"), createPngIcoBuffer(favicon32, 32, 32));

  await Promise.all([
    renderPng(path.join(publicDir, "favicon-16x16.png"), 16, 16),
    writeFile(path.join(publicDir, "favicon-32x32.png"), favicon32),
    renderPng(path.join(publicDir, "android-chrome-192x192.png"), 192, 192),
    renderPng(path.join(publicDir, "android-chrome-512x512.png"), 512, 512),
    renderPng(path.join(publicDir, "apple-touch-icon.png"), 180, 180),
    renderPng(path.join(publicDir, "logo192.png"), 192, 192),
    renderPng(path.join(publicDir, "logo512.png"), 512, 512),
  ]);

  const metadataSvg = buildMetadataSvg(underConstructionDataUri);
  await sharp(Buffer.from(metadataSvg)).png().toFile(metadataPath);
}

function buildMetadataSvg(underConstructionDataUri: string) {
  const imageWidth = 860;
  const imageHeight = 52.462;
  const imageX = (SOCIAL_IMAGE_WIDTH - imageWidth) / 2;
  const imageY = 330;
  const framePadding = 18;
  const frameX = imageX - framePadding;
  const frameY = imageY - framePadding;
  const frameWidth = imageWidth + framePadding * 2;
  const frameHeight = imageHeight + framePadding * 2;
  const titleX = SOCIAL_IMAGE_WIDTH / 2;
  const titleY = 250;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SOCIAL_IMAGE_WIDTH}" height="${SOCIAL_IMAGE_HEIGHT}" viewBox="0 0 ${SOCIAL_IMAGE_WIDTH} ${SOCIAL_IMAGE_HEIGHT}">
  <defs>
    <filter id="frame-shadow" x="-20%" y="-100%" width="140%" height="300%">
      <feDropShadow dx="0" dy="20" stdDeviation="24" flood-color="#000000" flood-opacity="0.12"/>
    </filter>
    <clipPath id="banner-clip">
      <rect x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" rx="16" ry="16"/>
    </clipPath>
  </defs>
  <rect width="100%" height="100%" fill="#fafafa"/>
  <text x="${titleX + 3}" y="${titleY + 3}" text-anchor="middle" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="86" font-weight="600" fill="rgba(0,0,0,0.06)">${APP_NAME}</text>
  <text x="${titleX + 1}" y="${titleY + 1}" text-anchor="middle" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="86" font-weight="600" fill="rgba(0,0,0,0.08)">${APP_NAME}</text>
  <text x="${titleX}" y="${titleY}" text-anchor="middle" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="86" font-weight="600" fill="#111111">${APP_NAME}</text>
  <g filter="url(#frame-shadow)">
    <rect x="${frameX}" y="${frameY}" width="${frameWidth}" height="${frameHeight}" rx="24" ry="24" fill="#ffffff" stroke="#e0e0e0" stroke-width="2"/>
    <image href="${underConstructionDataUri}" x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="none" clip-path="url(#banner-clip)"/>
  </g>
  <title>${METADATA_IMAGE_ALT}</title>
</svg>`;
}

async function renderPng(filePath: string, width: number, height: number) {
  await writeFile(filePath, await renderPngBuffer(width, height));
}

async function renderPngBuffer(width: number, height: number) {
  const svg = createDotIconSvg({ size: Math.max(width, height), color: BRAND_DOT_COLOR });
  return sharp(Buffer.from(svg)).resize(width, height).png().toBuffer();
}

await main();
