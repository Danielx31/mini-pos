<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { BrowserMultiFormatOneDReader, type IScannerControls } from "@zxing/browser";

const emit = defineEmits<{ detected: [code: string]; close: [] }>();
const video = ref<HTMLVideoElement | null>(null);
const state = ref<"idle" | "starting" | "scanning" | "paused">("idle");
const errorMessage = ref("");
const lastCode = ref("");
let controls: IScannerControls | null = null;
let requestVersion = 0;

function stopCamera(): void {
  requestVersion += 1;
  controls?.stop();
  controls = null;
  const stream = video.value?.srcObject as MediaStream | null;
  stream?.getTracks().forEach((track) => track.stop());
  if (video.value) video.value.srcObject = null;
  state.value = "idle";
}

function cameraError(cause: unknown): string {
  if (cause instanceof DOMException) {
    if (cause.name === "NotAllowedError" || cause.name === "PermissionDeniedError") return "Camera access was denied. Allow it in your browser settings, then try again.";
    if (cause.name === "NotFoundError" || cause.name === "DevicesNotFoundError") return "No camera was found on this device.";
    if (cause.name === "NotReadableError" || cause.name === "TrackStartError") return "The camera is in use by another app. Close it there and try again.";
  }
  return "Could not start the camera. Check camera access and try again, or type the barcode above.";
}

async function startCamera(): Promise<void> {
  if (state.value === "starting" || state.value === "scanning") return;
  errorMessage.value = "";
  lastCode.value = "";
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    errorMessage.value = "Camera scanning needs a supported browser over HTTPS or localhost. You can still type the barcode above.";
    return;
  }
  if (!video.value) return;
  const version = ++requestVersion;
  state.value = "starting";
  try {
    const reader = new BrowserMultiFormatOneDReader();
    const startedControls = await reader.decodeFromConstraints(
      { audio: false, video: { facingMode: { ideal: "environment" } } },
      video.value,
      (result, _error, scanControls) => {
        if (!result || version !== requestVersion) return;
        const code = result.getText().trim();
        if (!code) return;
        scanControls.stop();
        stopCamera();
        lastCode.value = code;
        state.value = "paused";
        emit("detected", code);
      },
    );
    if (version !== requestVersion) startedControls.stop();
    else {
      controls = startedControls;
      state.value = "scanning";
    }
  } catch (cause) {
    if (version !== requestVersion) return;
    stopCamera();
    errorMessage.value = cameraError(cause);
  }
}

function close(): void {
  stopCamera();
  emit("close");
}

onUnmounted(stopCamera);
</script>

<template>
  <section id="phone-barcode-scanner" aria-labelledby="phone-scanner-heading" class="mb-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 sm:p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 id="phone-scanner-heading" class="font-semibold text-slate-950">Scan with your phone camera</h3>
        <p class="mt-1 text-sm text-slate-600">Point the rear camera at a product barcode. One successful scan adds one item to the cart.</p>
      </div>
      <button type="button" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100" @click="close">Close camera</button>
    </div>
    <div class="relative mt-4 overflow-hidden rounded-2xl bg-slate-950">
      <video ref="video" autoplay muted playsinline class="aspect-[4/3] w-full object-cover sm:aspect-video" aria-label="Live barcode camera preview" />
      <div v-if="state === 'idle' || state === 'paused'" class="absolute inset-0 flex items-center justify-center bg-slate-950/80 px-5 text-center text-sm text-white">
        {{ state === 'paused' ? `Read ${lastCode}. Choose Scan again to read another barcode.` : 'Tap Start camera to scan a barcode.' }}
      </div>
      <div v-else class="pointer-events-none absolute inset-x-8 top-1/2 h-20 -translate-y-1/2 rounded-xl border-2 border-lime-300/90" aria-hidden="true" />
    </div>
    <div class="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" :disabled="state === 'starting' || state === 'scanning'" class="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60" @click="startCamera">{{ state === 'starting' ? 'Starting camera...' : state === 'paused' ? 'Scan again' : 'Start camera' }}</button>
      <button v-if="state === 'scanning'" type="button" class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100" @click="stopCamera">Stop scanning</button>
      <span v-if="state === 'scanning'" class="text-sm text-slate-600" role="status">Looking for a barcode...</span>
    </div>
    <p v-if="errorMessage" role="alert" class="mt-3 text-sm text-rose-800">{{ errorMessage }}</p>
    <p class="mt-3 text-xs text-slate-600">The barcode must match a product's Barcode / SKU in Products. Camera video stays on this device.</p>
  </section>
</template>
