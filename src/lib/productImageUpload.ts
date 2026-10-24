export const MAX_PRODUCT_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const IMAGE_QUALITIES = [0.86, 0.7, 0.55];
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not prepare the image.")), "image/webp", quality);
  });
}

function asBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.readAsDataURL(blob);
  });
}

/** Resize a selected photo before uploading; the server validates the final bytes again. */
export async function prepareProductImage(file: File): Promise<{ mimeType: string; data: string }> {
  if (!IMAGE_TYPES.has(file.type)) throw new Error(`${file.name}: choose a JPEG, PNG, or WebP image.`);
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error(`${file.name}: source images must be under 20 MB.`);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`${file.name}: this file could not be opened as an image.`);
  }
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the image.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of IMAGE_QUALITIES) {
      const blob = await canvasBlob(canvas, quality);
      if (blob.type !== "image/webp") throw new Error("This browser cannot prepare WebP images.");
      if (blob.size <= MAX_PRODUCT_IMAGE_BYTES) return { mimeType: blob.type, data: await asBase64(blob) };
    }
    throw new Error(`${file.name}: the prepared image is over 2 MB. Try a smaller photo.`);
  } finally {
    bitmap.close();
  }
}
