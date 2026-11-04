import fs from 'node:fs/promises';

/**
 * Click a download button and return the captured download, its bytes and its
 * suggested filename. `download.path()` is only available for downloads the
 * browser actually completed, which also proves the blob was valid.
 */
export const downloadAndRead = async (page, buttonName) => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: buttonName }).click()
  ]);
  const filePath = await download.path();
  const bytes = await fs.readFile(filePath);

  return { download, bytes, filename: download.suggestedFilename() };
};

export const isPng = (bytes) => (
  bytes.length > 8
  && bytes[0] === 0x89
  && bytes[1] === 0x50
  && bytes[2] === 0x4e
  && bytes[3] === 0x47
);

export const isJpeg = (bytes) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;

export const isWebp = (bytes) => (
  bytes.length > 12
  && bytes.toString('ascii', 0, 4) === 'RIFF'
  && bytes.toString('ascii', 8, 12) === 'WEBP'
);

/** Read width/height straight from the PNG IHDR chunk. */
export const pngSize = (bytes) => {
  if (!isPng(bytes) || bytes.length < 24) throw new Error('Not a PNG buffer');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

/** Walk JPEG markers until a Start-Of-Frame segment carries the dimensions. */
export const jpegSize = (bytes) => {
  if (!isJpeg(bytes)) throw new Error('Not a JPEG buffer');

  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    // Standalone markers carry no length payload.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    // 0xff padding bytes.
    if (marker === 0xff) {
      offset += 1;
      continue;
    }

    const segmentLength = bytes.readUInt16BE(offset + 2);
    const isStartOfFrame = marker >= 0xc0
      && marker <= 0xcf
      && marker !== 0xc4
      && marker !== 0xc8
      && marker !== 0xcc;

    if (isStartOfFrame && offset + 9 < bytes.length) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7)
      };
    }

    offset += 2 + segmentLength;
  }

  throw new Error('JPEG has no Start-Of-Frame marker');
};
