<script setup lang="ts">
import { ref, watch } from "vue";
import { prepareProductImage } from "../lib/productImageUpload";
import { useProductsStore } from "../stores/products";

type ProductImage = { id: string; url: string; byteSize: number };
type Product = { id: string; name: string };
type QueuedImage = { id: string; file: File };

const props = defineProps<{ product: Product }>();
defineEmits<{ close: [] }>();

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

watch(() => props.product.id, async (productId) => {
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
  queue.value.push(...files.map((file) => ({ id: crypto.randomUUID(), file })));
  input.value = "";
  notice.value = "";
}

function removeQueued(id: string): void {
  queue.value = queue.value.filter((item) => item.id !== id);
  prepared.delete(id);
}

async function uploadImages(): Promise<void> {
  if (uploading.value || !queue.value.length) return;
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
      <button type="button" class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" @click="$emit('close')">Close</button>
    </div>

    <div class="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <label :for="`product-photo-input-${product.id}`" class="block text-sm font-semibold text-slate-800">Choose product photos</label>
      <p class="mt-1 text-xs text-slate-600">JPEG, PNG, or WebP. Photos are resized before upload; each saved image must be under 2 MB. There is no photo count limit.</p>
      <input :id="`product-photo-input-${product.id}`" type="file" accept="image/jpeg,image/png,image/webp" multiple :disabled="uploading" class="mt-3 block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-4 file:py-2 file:font-semibold file:text-emerald-900 hover:file:bg-emerald-200 disabled:opacity-50" @change="chooseFiles" />
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
