// Generates clean, synthetic product photos for E2E uploads (no third-party imagery).
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const scenes = {
  'shoe.jpg': ['#E9E4DA', '#FFFFFF', '#10252C'],
  'bag.jpg': ['#EFE7F3', '#5B2A86', '#C9A227'],
  'dress.jpg': ['#F4EEDF', '#E9B713', '#8A5A00'],
};
for (const [name, [bg, main, accent]] of Object.entries(scenes)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">
    <defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#ffffff" stop-opacity=".7"/><stop offset="1" stop-color="${bg}"/></radialGradient></defs>
    <rect width="1080" height="1080" fill="url(#g)"/>
    <ellipse cx="540" cy="840" rx="330" ry="38" fill="#000" opacity=".08"/>
    <rect x="250" y="360" width="580" height="440" rx="120" fill="${main}" stroke="${accent}" stroke-width="10"/>
    <rect x="330" y="300" width="420" height="120" rx="60" fill="none" stroke="${accent}" stroke-width="22"/>
    <circle cx="540" cy="580" r="34" fill="${accent}"/>
  </svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(path.join(dir, name));
}
console.log('fixtures ready');
