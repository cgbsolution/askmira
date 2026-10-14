/**
 * A punch photo, shrunk in the browser before it is sent.
 *
 * A phone camera frame is several megabytes; the API takes up to 600 KB. A
 * face only needs to be recognisable to the reviewer, so the longest side is
 * cut to 640 px and the frame re-encoded as JPEG. Nothing is kept: the data
 * URL lives in component state until the punch is sent.
 */

const LONGEST_SIDE = 640;
const QUALITY = 0.8;

export async function shrinkPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a photo, not another kind of file.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, LONGEST_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot prepare the photo.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", QUALITY);
  } finally {
    bitmap.close();
  }
}
