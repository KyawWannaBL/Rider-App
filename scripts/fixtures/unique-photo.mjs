import { deflateSync } from 'node:zlib';
function crc32(bytes) { let crc=0xffffffff; for(const byte of bytes) { crc^=byte; for(let i=0;i<8;i++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); } return (crc^0xffffffff)>>>0; }
function chunk(type, data) { const name=Buffer.from(type), size=Buffer.alloc(4), crc=Buffer.alloc(4); size.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([name,data]))); return Buffer.concat([size,name,data,crc]); }
/** Different fixtures must depict different pixels, rather than rename one image. */
export function uniquePhoto(seed) {
  let hash=2166136261; for(const c of String(seed)) hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
  const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(4,0); ihdr.writeUInt32BE(4,4); ihdr[8]=8; ihdr[9]=2;
  const row=Buffer.from([0,...Array.from({length:4},()=>[hash&255,(hash>>>8)&255,(hash>>>16)&255]).flat()]);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(Buffer.concat(Array(4).fill(row)))),chunk('IEND',Buffer.alloc(0))]);
}
