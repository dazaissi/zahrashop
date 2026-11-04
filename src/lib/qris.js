// Fungsi standar perhitungan CRC16 untuk QRIS
function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    crc ^= c << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) > 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function generateDynamicQris(staticQris, amount) {
  if (!staticQris || !amount) return '';

  // 1. Pecah teks QRIS menjadi potongan kecil (TLV)
  let elements = [];
  let i = 0;
  while (i < staticQris.length) {
    if (i + 4 > staticQris.length) break;
    const tag = staticQris.slice(i, i + 2);
    const length = parseInt(staticQris.slice(i + 2, i + 4), 10);
    const value = staticQris.slice(i + 4, i + 4 + length);
    elements.push({ tag, length, value });
    i += 4 + length;
  }

  // 2. Ubah tipe dari Statis (11) menjadi Dinamis (12)
  elements = elements.map(el => {
    if (el.tag === '01') return { tag: '01', length: 2, value: '12' };
    return el;
  });
  
  // 3. Hapus nominal lama (jika ada) dan hapus checksum lama
  elements = elements.filter(el => el.tag !== '54');
  elements = elements.filter(el => el.tag !== '63');

  // 4. Format nominal (hilangkan desimal .00 jika ada)
  const amountStr = Number(amount).toFixed(2).replace(/\.00$/, '');
  const amountLen = amountStr.length.toString().padStart(2, '0');
  
  // 5. Tambahkan nominal baru
  elements.push({ tag: '54', length: amountLen, value: amountStr });

  // 6. Susun ulang teks QRIS
  let newString = '';
  elements.forEach(el => {
    newString += el.tag + String(el.value.length).padStart(2, '0') + el.value;
  });

  // 7. Tambahkan tag checksum (6304) dan hitung ulang
  newString += '6304';
  return newString + crc16(newString);
}