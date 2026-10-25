<script setup lang="ts">
import { computed, ref, watch } from "vue";

type ProductImage = { id: string; url: string };
const props = defineProps<{ images: ProductImage[]; productName: string; fallbackIcon: string; imageFit?: "cover" | "contain" }>();

const activeIndex = ref(0);
const failedIds = ref<Set<string>>(new Set());
const availableImages = computed(() => props.images.filter((image) => !failedIds.value.has(image.id)));
const activeImage = computed(() => availableImages.value[activeIndex.value % availableImages.value.length]);
let touchStartX = 0;

watch(() => props.images, () => {
  activeIndex.value = 0;
  failedIds.value = new Set();
});

function step(amount: number): void {
  const count = availableImages.value.length;
  if (count > 1) activeIndex.value = (activeIndex.value + amount + count) % count;
}

function imageFailed(id: string): void {
  failedIds.value = new Set([...failedIds.value, id]);
  activeIndex.value = 0;
}

function finishSwipe(event: TouchEvent): void {
  const distance = event.changedTouches[0]?.clientX - touchStartX;
  if (distance && Math.abs(distance) > 40) step(distance < 0 ? 1 : -1);
}
</script>

<template>
  <div class="relative flex h-full w-full items-center justify-center overflow-hidden" @touchstart.passive="touchStartX = $event.touches[0]?.clientX ?? 0" @touchend.passive="finishSwipe">
    <img v-if="activeImage" :key="activeImage.id" :src="activeImage.url" :alt="`${productName}, photo ${activeIndex + 1} of ${availableImages.length}`" loading="lazy" decoding="async" class="h-full w-full" :class="imageFit === 'contain' ? 'object-contain' : 'object-cover'" @error="imageFailed(activeImage.id)" />
    <span v-else class="relative text-6xl transition duration-200 group-hover:scale-110" aria-hidden="true">{{ fallbackIcon }}</span>
    <template v-if="availableImages.length > 1">
      <button type="button" class="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl font-bold text-slate-900 shadow-sm hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700" :aria-label="`Previous photo of ${productName}`" @click.stop="step(-1)">‹</button>
      <button type="button" class="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl font-bold text-slate-900 shadow-sm hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700" :aria-label="`Next photo of ${productName}`" @click.stop="step(1)">›</button>
      <span class="absolute bottom-2 right-2 rounded-full bg-slate-950/75 px-2.5 py-1 text-[0.7rem] font-semibold text-white" aria-live="polite">{{ activeIndex + 1 }} / {{ availableImages.length }}</span>
    </template>
  </div>
</template>
