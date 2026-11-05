/**
 * Uploads: the workspace's size limit, and shrinking photos before they leave
 * the browser.
 *
 * The server is the authority on both: it holds every file to the limit an
 * admin set (Settings → Company → Workspace) and compresses every file before
 * it is stored. The browser only gets there first, so a person hears "too
 * large" the moment they pick a file, and a 6 MB phone photo goes up as a few
 * hundred kilobytes on a slow connection.
 */

/** Until an admin chooses, and for pages with no signed-in workspace. */
export const DEFAULT_UPLOAD_MB = 10;
/** The choices an admin has, in MB. The server accepts any whole number 1–25. */
export const UPLOAD_LIMIT_CHOICES = [1, 2, 5, 10, 15, 20, 25] as const;

const MB = 1024 * 1024;

/** A size as people read it: "10 MB", "12.4 MB", "600 KB". `up` rounds up, for a file over a limit. */
export function sizeLabel(bytes: number, up = false): string {
  if (bytes >= MB) {
    const tenths = (up ? Math.ceil : Math.round)((bytes / MB) * 10) / 10;
    return `${Number.isInteger(tenths) ? tenths : tenths.toFixed(1)} MB`;
  }
  return `${Math.max(1, (up ? Math.ceil : Math.round)(bytes / 1024))} KB`;
}

/** The reason a file is refused for its size, or null when it fits. */
export function tooLarge(file: File, maxBytes: number): string | null {
  if (file.size <= maxBytes) return null;
  return `“${file.name}” is ${sizeLabel(file.size, true)}. The upload limit is ${sizeLabel(maxBytes)}.`;
}

/** The longer side of a photo after shrinking: an A4 page at about 200 dpi stays readable. */
const MAX_SIDE = 2400;
/** Photos smaller than this go up as they are. */
const WORTH_SHRINKING = 300 * 1024;
const LOSSY: Record<string, number> = { "image/jpeg": 0.82, "image/webp": 0.82 };

/**
 * A smaller copy of a photo, or the same file when there is none.
 *
 * JPEG and WebP only: they are re-encoded anyway, so scaling and re-saving loses
 * nothing a viewer would notice. PNGs (logos, screenshots with text) and PDFs
 * are left to the server, which compresses them without loss. Any failure (an
 * image the browser cannot draw, a canvas too large for the device) sends the
 * original.
 */
export async function shrinkPhoto(file: File): Promise<File> {
  const quality = LOSSY[file.type];
  if (quality === undefined || file.size < WORTH_SHRINKING || typeof createImageBitmap !== "function") {
    return file;
  }
  try {
    // "from-image" turns a sideways phone photo upright, as viewers show it.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type, quality));
    // Kept only when it really is smaller: re-saving a small, already
    // compressed photo can come out larger.
    if (!blob || blob.type !== file.type || blob.size > file.size * 0.9) return file;
    return new File([blob], file.name, { type: file.type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}
