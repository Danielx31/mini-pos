<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from "vue";
import { prepareProductImage } from "../lib/productImageUpload";
import { useProductsStore } from "../stores/products";

type ProductImage = { id: string; url: string; byteSize: number };
type Product = { id: string; name: string };
type QueuedImage = { id: string; file: File };
const MAX_CAPTURE_DIMENSION = 1600;
const CAPTURE_QUALITY = 0.9;

const props = defineProps<{ product: Product }>();
const emit = defineEmits<{ close: [] }>();

const productsStore = useProductsStore();
const queue = ref<QueuedImage[]>([]);
const prepared = new Map<string, Promise<{ mimeType: string; data: string }>>();
const uploading = ref(false);
const removingId = ref("");
const progress = ref("");
const notice = ref("");
const error = ref(false);
const images = ref<ProductImage[]>([]);
const loading = ref(false);
const cameraVideo = ref<HTMLVideoElement | null>(null);
const cameraOpen = ref(false);
const cameraStarting = ref(false);
const cameraReady = ref(false);
const cameraBusy = ref(false);
const cameraError = ref("");
let cameraStream: MediaStream | null = null;
let cameraRequestVersion = 0;

function stopCamera(): void {
  cameraRequestVersion += 1;
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  if (cameraVideo.value) cameraVideo.value.srcObject = null;
  cameraOpen.value = false;
  cameraStarting.value = false;
  cameraReady.value = false;
}

function cameraFailure(cause: unknown): string {
  if (cause instanceof DOMException) {
    if (cause.name === "NotAllowedError" || cause.name === "PermissionDeniedError") return "Camera access was denied. Allow it in your browser settings, then try again.";
    if (cause.name === "NotFoundError" || cause.name === "DevicesNotFoundError") return "No camera was found on this device.";
    if (cause.name === "NotReadableError" || cause.name === "TrackStartError") return "The camera is in use by another app. Close it there and try again.";
  }
  return "Could not open the camera. Check camera access and try again, or choose a file.";
}

async function openCamera(): Promise<void> {
  if (cameraOpen.value || cameraStarting.value) return;
  cameraError.value = "";
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    cameraError.value = "Camera access needs a supported browser over HTTPS or localhost. You can still choose a file.";
    return;
  }
  cameraOpen.value = true;
  cameraStarting.value = true;
  const version = ++cameraRequestVersion;
  await nextTick();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
    const video = cameraVideo.value;
    if (version !== cameraRequestVersion || !video) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    cameraStream = stream;
    video.srcObject = stream;
    await video.play();
    if (version === cameraRequestVersion) {
      cameraReady.value = video.videoWidth > 0;
      cameraStarting.value = false;
    }
  } catch (cause) {
    if (version !== cameraRequestVersion) return;
    stopCamera();
    cameraError.value = cameraFailure(cause);
  }
}

function queueFiles(files: File[]): void {
  queue.value.push(...files.map((file) => ({ id: crypto.randomUUID(), file })));
  notice.value = "";
  error.value = false;
}

async function capturePhoto(): Promise<void> {
  const video = cameraVideo.value;
  if (!video || !cameraReady.value || cameraBusy.value || !video.videoWidth || !video.videoHeight) return;
  const version = cameraRequestVersion;
  const productId = props.product.id;
  cameraBusy.value = true;
  cameraError.value = "";
  try {
    const scale = Math.min(1, MAX_CAPTURE_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not capture the photo. Try again.");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Could not capture the photo. Try again.")), "image/jpeg", CAPTURE_QUALITY);
    });
    if (blob.type !== "image/jpeg") throw new Error("This browser could not capture a JPEG photo. Choose a file instead.");
    if (version !== cameraRequestVersion || productId !== props.product.id) return;
    queueFiles([new File([blob], `product-photo-${Date.now()}.jpg`, { type: "image/jpeg" })]);
  } catch (cause) {
    cameraError.value = cause instanceof Error ? cause.message : "Could not capture the photo. Try again.";
  } finally {
    cameraBusy.value = false;
  }
}

function closeImages(): void {
  stopCamera();
  emit("close");
}

onUnmounted(stopCamera);

watch(() => props.product.id, async (productId) => {
  stopCamera();
  cameraError.value = "";
  queue.value = [];
  prepared.clear();
  images.value = [];
  notice.value = "";
  error.value = false;
  loading.value = true;
  try {
    const result = await productsStore.loadProductImages(productId) as ProductImage[];
    if (props.product.id === productId) images.value = result;
  } catch (cause) {
    if (props.product.id === productId) {
      error.value = true;
      notice.value = cause instanceof Error ? cause.message : "Could not load product photos.";
    }
  } finally {
    if (props.product.id === productId) loading.value = false;
  }
}, { immediate: true });

function chooseFiles(event: Event): void {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (files.length) queueFiles(files);
  input.value = "";
}

function removeQueued(id: string): void {
  queue.value = queue.value.filter((item) => item.id !== id);
  prepared.delete(id);
}

async function uploadImages(): Promise<void> {
  if (uploading.value || !queue.value.length) return;
  stopCamera();
  uploading.value = true;
  error.value = false;
  notice.value = "";
  const total = queue.value.length;
  const productId = props.product.id;
  let completed = 0;
  try {
    for (const item of [...queue.value]) {
      progress.value = `Uploading ${completed + 1} of ${total}: ${item.file.name}`;
      if (!prepared.has(item.id)) prepared.set(item.id, prepareProductImage(item.file));
      const image = await prepared.get(item.id)!;
      const result = await productsStore.addProductImage(productId, { imageKey: item.id, ...image });
      if (!result.ok) throw new Error(result.message || "Upload failed.");
      if (props.product.id === productId) images.value = result.images;
      removeQueued(item.id);
      completed += 1;
    }
    notice.value = `${completed} ${completed === 1 ? "image" : "images"} uploaded.`;
  } catch (cause) {
    error.value = true;
    notice.value = cause instanceof Error ? cause.message : "Could not upload the image.";
  } finally {
    uploading.value = false;
    progress.value = "";
  }
}

async function removeImage(image: ProductImage): Promise<void> {
  if (removingId.value || uploading.value || !window.confirm("Remove this product photo?")) return;
  removingId.value = image.id;
  const productId = props.product.id;
  error.value = false;
  notice.value = "";
  try {
    const result = await productsStore.deleteProductImage(productId, image.id);
    if (!result.ok) throw new Error(result.message || "Could not remove the image.");
    if (props.product.id === productId) images.value = result.images;
    notice.value = result.message;
  } catch (cause) {
    error.value = true;
    notice.value = cause instanceof Error ? cause.message : "Could not remove the image.";
  } finally {
    removingId.value = "";
  }
}
</script>

<template>
  <section id="product-images" aria-labelledby="product-images-heading" class="mb-6 scroll-mt-6 rounded-[1.75rem] border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 id="product-images-heading" class="text-lg font-bold text-slate-950">Photos for {{ product.name }}</h2>
        <p class="mt-1 text-sm text-slate-600">Add as many photos as you need. Customers can slide through them. When there are no photos, they see the product icon.</p>
      </div>
      <button type="button" class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" @click="closeImages">Close</button>
    </div>

    <div class="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <label :for="`product-photo-input-${product.id}`" class="block text-sm font-semibold text-slate-800">Add product photos</label>
      <p class="mt-1 text-xs text-slate-600">Choose files or take photos with your camera. JPEG, PNG, or WebP photos are resized before upload; each saved image must be under 2 MB. There is no photo count limit.</p>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <input :id="`product-photo-input-${product.id}`" type="file" accept="image/jpeg,image/png,image/webp" multiple :disabled="uploading" class="block min-w-0 max-w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-4 file:py-2 file:font-semibold file:text-emerald-900 hover:file:bg-emerald-200 disabled:opacity-50" @change="chooseFiles" />
        <button type="button" :disabled="uploading" :aria-expanded="cameraOpen" aria-controls="product-photo-camera" class="rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 transition-colors hover:bg-sky-100 disabled:opacity-50" @click="cameraOpen ? stopCamera() : openCamera()">{{ cameraOpen ? 'Close camera' : 'Open camera' }}</button>
      </div>
      <p v-if="cameraError" role="alert" class="mt-3 text-sm text-rose-800">{{ cameraError }}</p>
      <div v-if="cameraOpen" id="product-photo-camera" class="mt-4 rounded-2xl border border-sky-200 bg-white p-3 sm:p-4">
        <p class="text-sm font-semibold text-slate-800">Camera preview</p>
        <div class="relative mt-3 overflow-hidden rounded-xl bg-slate-950">
          <video ref="cameraVideo" autoplay muted playsinline aria-label="Live product photo camera preview" class="aspect-[4/3] w-full object-contain sm:aspect-video" @loadedmetadata="cameraReady = true" />
          <p v-if="cameraStarting" class="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-sm text-white" role="status">Starting camera...</p>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" :disabled="!cameraReady || cameraBusy || uploading" class="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50" @click="capturePhoto">{{ cameraBusy ? 'Taking photo...' : 'Take photo' }}</button>
          <span class="text-xs text-slate-600">Take more photos or close the camera, then upload your selection below.</span>
        </div>
      </div>
      <ul v-if="queue.length" class="mt-3 space-y-1 text-xs text-slate-700">
        <li v-for="item in queue" :key="item.id" class="flex items-center justify-between gap-3">
          <span class="min-w-0 truncate">{{ item.file.name }}</span>
          <button type="button" :disabled="uploading" class="font-semibold text-rose-700 hover:underline disabled:opacity-50" :aria-label="`Remove ${item.file.name} from upload queue`" @click="removeQueued(item.id)">Remove</button>
        </li>
      </ul>
      <button type="button" :disabled="uploading || !queue.length" class="mt-4 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50" @click="uploadImages">{{ uploading ? 'Uploading...' : `Upload ${queue.length} ${queue.length === 1 ? 'photo' : 'photos'}` }}</button>
      <p v-if="progress" class="mt-2 text-xs text-slate-600" role="status">{{ progress }}</p>
    </div>

    <p v-if="notice" :role="error ? 'alert' : 'status'" aria-live="polite" class="mt-4 rounded-xl px-4 py-3 text-sm" :class="error ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-900'">{{ notice }}</p>
    <p v-if="loading" class="mt-5 text-sm text-slate-600" role="status">Loading photos...</p>
    <div v-else-if="images.length" class="mt-5 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      <figure v-for="(image, index) in images" :key="image.id" class="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <img :src="image.url" :alt="`${product.name} photo ${index + 1}`" loading="lazy" class="aspect-square w-full object-cover" />
        <figcaption class="flex items-center justify-between gap-2 p-2 text-xs text-slate-600">
          <span>Photo {{ index + 1 }}</span>
          <button type="button" :disabled="Boolean(removingId) || uploading" class="font-semibold text-rose-700 hover:underline disabled:opacity-50" @click="removeImage(image)">{{ removingId === image.id ? 'Removing...' : 'Remove' }}</button>
        </figcaption>
      </figure>
    </div>
    <p v-else class="mt-5 text-sm text-slate-600">No photos yet. The customer menu uses the current icon.</p>
  </section>
</template>
