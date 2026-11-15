import sharp from "sharp";
import { readFile } from "node:fs/promises";
for (const name of ["gaba", "janek", "konrad", "julia"]) {
  await sharp(`public/avatars/${name}.png`)
    .resize(384, 384, { fit: "cover" })
    .webp({ quality: 86 })
    .toFile(`public/avatars/${name}.webp`);
}
const icon = await readFile("public/icon.svg");
for (const size of [192, 512])
  await sharp(icon).resize(size, size).png().toFile(`public/icon-${size}.png`);
await sharp(icon).resize(180, 180).png().toFile("public/apple-touch-icon.png");
console.log("Prepared four avatar thumbnails and install icons.");
