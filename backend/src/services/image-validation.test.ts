import { describe, expect, it } from 'vitest';
import { isSupportedImageFile } from './image-validation';

describe('asset image validation', () => {
  it('accepts matching JPEG, PNG, and WebP signatures', () => {
    expect(isSupportedImageFile({
      mimetype: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00])
    })).toBe(true);
    expect(isSupportedImageFile({
      mimetype: 'image/png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    })).toBe(true);
    expect(isSupportedImageFile({
      mimetype: 'image/webp',
      buffer: Buffer.from('RIFF1234WEBP', 'ascii')
    })).toBe(true);
  });

  it('rejects unsupported MIME types and mismatched file signatures', () => {
    expect(isSupportedImageFile({
      mimetype: 'image/gif',
      buffer: Buffer.from('GIF89a')
    })).toBe(false);
    expect(isSupportedImageFile({
      mimetype: 'image/png',
      buffer: Buffer.from('not a PNG')
    })).toBe(false);
  });
});
