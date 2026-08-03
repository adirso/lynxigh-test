// Single source of truth for which image MIME types the app accepts for photo
// uploads, and the on-disk extension each one maps to. Used both by the
// multer fileFilter (to reject anything else with a clean 400) and by
// LocalDiskStorage (to derive the saved file's extension from the validated
// MIME type rather than trusting the client-supplied filename) — keeping
// these in one place means the allowlist and the extension mapping can never
// drift apart.
export const ALLOWED_IMAGE_MIME_TYPES: Readonly<Record<string, string>> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export function isAllowedImageMimeType(mimeType: string): boolean {
  return Object.prototype.hasOwnProperty.call(ALLOWED_IMAGE_MIME_TYPES, mimeType);
}
