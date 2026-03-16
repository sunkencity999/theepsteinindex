// gen_favicon.js — generates public/favicon.ico (16x16, 32x32, 48x48)
// Pure Node.js, no external packages.
// Run once: node gen_favicon.js

'use strict';
const fs   = require('fs');
const path = require('path');

// ─── Draw the "E" icon at a given pixel size ───────────────────────────────
// Coordinates are mapped from the SVG viewBox (32×32).
// E shape:
//   Left bar:   x[7..11], y[6..26]
//   Top bar:    x[7..25], y[6..10]
//   Middle bar: x[11..23], y[14..18]
//   Bottom bar: x[7..25], y[22..26]
function drawIcon(size) {
  // BGRA pixel array
  const pix = new Uint8Array(size * size * 4);

  // Fill with crimson #8b1a1a  (BGRA: 0x1a, 0x1a, 0x8b, 0xff)
  for (let i = 0; i < size * size; i++) {
    pix[i * 4 + 0] = 0x1a;
    pix[i * 4 + 1] = 0x1a;
    pix[i * 4 + 2] = 0x8b;
    pix[i * 4 + 3] = 0xff;
  }

  const s = size / 32; // scale factor

  function rect(x1, y1, x2, y2) {
    const sx1 = Math.round(x1 * s);
    const sy1 = Math.round(y1 * s);
    const sx2 = Math.round(x2 * s);
    const sy2 = Math.round(y2 * s);
    for (let y = sy1; y < sy2; y++) {
      for (let x = sx1; x < sx2; x++) {
        const idx = (y * size + x) * 4;
        pix[idx + 0] = 0xff;
        pix[idx + 1] = 0xff;
        pix[idx + 2] = 0xff;
        pix[idx + 3] = 0xff;
      }
    }
  }

  rect(7,  6, 25, 10); // top bar
  rect(7,  6, 11, 26); // left bar
  rect(11, 14, 23, 18); // middle bar
  rect(7,  22, 25, 26); // bottom bar

  return pix;
}

// ─── Wrap pixels into a BMP-inside-ICO data block ─────────────────────────
function makeBMPData(size, pix) {
  // BITMAPINFOHEADER — 40 bytes
  const hdr = Buffer.alloc(40);
  hdr.writeUInt32LE(40,            0);   // biSize
  hdr.writeInt32LE(size,           4);   // biWidth
  hdr.writeInt32LE(size * 2,       8);   // biHeight (×2 per ICO spec)
  hdr.writeUInt16LE(1,            12);   // biPlanes
  hdr.writeUInt16LE(32,           14);   // biBitCount (32-bit BGRA)
  hdr.writeUInt32LE(0,            16);   // biCompression
  hdr.writeUInt32LE(size*size*4,  20);   // biSizeImage
  hdr.writeInt32LE(0,             24);
  hdr.writeInt32LE(0,             28);
  hdr.writeUInt32LE(0,            32);
  hdr.writeUInt32LE(0,            36);

  // Pixel rows — BMP stores bottom-up
  const px = Buffer.alloc(size * size * 4);
  for (let row = 0; row < size; row++) {
    const srcRow = size - 1 - row;
    for (let col = 0; col < size; col++) {
      const src = (srcRow * size + col) * 4;
      const dst = (row  * size + col) * 4;
      px[dst + 0] = pix[src + 0];
      px[dst + 1] = pix[src + 1];
      px[dst + 2] = pix[src + 2];
      px[dst + 3] = pix[src + 3];
    }
  }

  // AND mask (all 0 = fully opaque), padded to 4-byte rows
  const maskRowBytes = Math.ceil(size / 32) * 4;
  const mask = Buffer.alloc(size * maskRowBytes, 0);

  return Buffer.concat([hdr, px, mask]);
}

// ─── Assemble the ICO container ────────────────────────────────────────────
function makeICO(sizes) {
  const blobs = sizes.map(sz => makeBMPData(sz, drawIcon(sz)));

  const icoHdr = Buffer.alloc(6);
  icoHdr.writeUInt16LE(0,           0); // reserved
  icoHdr.writeUInt16LE(1,           2); // type = ICO
  icoHdr.writeUInt16LE(sizes.length,4); // image count

  const dir = Buffer.alloc(sizes.length * 16);
  let offset = 6 + sizes.length * 16;

  for (let i = 0; i < sizes.length; i++) {
    const sz = sizes[i];
    const e  = dir.subarray(i * 16, i * 16 + 16);
    e.writeUInt8(sz >= 256 ? 0 : sz, 0); // width  (0 = 256)
    e.writeUInt8(sz >= 256 ? 0 : sz, 1); // height (0 = 256)
    e.writeUInt8(0,                  2); // color count
    e.writeUInt8(0,                  3); // reserved
    e.writeUInt16LE(1,               4); // planes
    e.writeUInt16LE(32,              6); // bit depth
    e.writeUInt32LE(blobs[i].length, 8); // data size
    e.writeUInt32LE(offset,         12); // data offset
    offset += blobs[i].length;
  }

  return Buffer.concat([icoHdr, dir, ...blobs]);
}

// ─── Write the file ────────────────────────────────────────────────────────
const outPath = path.join(__dirname, 'public', 'favicon.ico');
fs.writeFileSync(outPath, makeICO([16, 32, 48]));
console.log(`favicon.ico written to ${outPath}`);
