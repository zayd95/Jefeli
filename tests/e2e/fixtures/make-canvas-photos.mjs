// Synthetic, photo-like test images for the canvas test (P1 addendum, 15 Nov): a beige dress on a
// warm studio backdrop and a white phone on a light table. No third-party imagery (the network
// policy blocks image libraries); film grain + soft light so they read like product photos.
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const grain = `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .07 0"/></filter>`;
const dress = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350">
  <defs>${grain}
    <radialGradient id="bg" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="#F3EBDD"/><stop offset="1" stop-color="#D9CBB4"/></radialGradient>
    <linearGradient id="fab" x1="0" x2="1"><stop offset="0" stop-color="#C9AE8A"/><stop offset=".45" stop-color="#E4D0B1"/><stop offset=".55" stop-color="#E9D7BA"/><stop offset="1" stop-color="#B99B74"/></linearGradient>
    <linearGradient id="fold" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".5" stop-color="#000" stop-opacity=".10"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="1080" height="1350" fill="url(#bg)"/>
  <rect x="0" y="1090" width="1080" height="260" fill="#CDBCA2" opacity=".55"/>
  <line x1="540" y1="60" x2="540" y2="170" stroke="#7A6A55" stroke-width="5"/>
  <path d="M470 170 Q540 140 610 170 L640 210 L440 210 Z" fill="#6E5E4A"/>
  <path d="M420 230 Q540 200 660 230 L700 420 Q690 470 660 500 L760 1130 Q540 1180 320 1130 L420 500 Q390 470 380 420 Z" fill="url(#fab)"/>
  <path d="M470 520 L430 1120" stroke="url(#fold)" stroke-width="60"/><path d="M600 520 L650 1125" stroke="url(#fold)" stroke-width="70"/><path d="M540 520 L540 1150" stroke="url(#fold)" stroke-width="40"/>
  <path d="M420 500 Q540 540 660 500" stroke="#A88B66" stroke-width="10" fill="none"/>
  <ellipse cx="540" cy="1190" rx="300" ry="26" fill="#000" opacity=".10"/>
  <rect width="1080" height="1350" filter="url(#n)"/>
</svg>`;
const phone = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350">
  <defs>${grain}
    <linearGradient id="t" y1="0" y2="1"><stop offset="0" stop-color="#F7F7F5"/><stop offset="1" stop-color="#E4E4E0"/></linearGradient>
    <linearGradient id="body" x1="0" x2="1"><stop offset="0" stop-color="#FDFDFC"/><stop offset=".5" stop-color="#F1F1EF"/><stop offset="1" stop-color="#DCDCD8"/></linearGradient>
    <linearGradient id="scr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2B2F33"/><stop offset="1" stop-color="#111316"/></linearGradient>
  </defs>
  <rect width="1080" height="1350" fill="url(#t)"/>
  <ellipse cx="560" cy="1150" rx="330" ry="40" fill="#000" opacity=".12"/>
  <g transform="rotate(-8 540 680)">
    <rect x="330" y="230" width="420" height="880" rx="70" fill="url(#body)" stroke="#CFCFCB" stroke-width="4"/>
    <rect x="352" y="252" width="376" height="836" rx="54" fill="url(#scr)"/>
    <rect x="490" y="272" width="100" height="26" rx="13" fill="#000"/>
    <path d="M360 300 L720 260 L720 420 L360 560 Z" fill="#fff" opacity=".06"/>
    <rect x="752" y="420" width="8" height="90" rx="4" fill="#D5D5D1"/>
  </g>
  <rect width="1080" height="1350" filter="url(#n)"/>
</svg>`;
await sharp(Buffer.from(dress)).jpeg({ quality: 90 }).toFile(path.join(dir, 'photo-beige-dress.jpg'));
await sharp(Buffer.from(phone)).jpeg({ quality: 90 }).toFile(path.join(dir, 'photo-white-phone.jpg'));
console.log('canvas photos ready');
