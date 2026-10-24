import bdoGcashQr from "../assets/payment-qr-bdo-gcash.jpeg";
import maribankMayaQr from "../assets/payment-qr-maribank-maya.jpeg";

export type UtangImageCustomer = {
  name: string;
  contact: string | null;
  total: number;
  paid: number;
  balance: number;
};

const IMAGE_WIDTH = 1280;
const IMAGE_MARGIN = 64;
const CARD_GAP = 24;
const CARD_WIDTH = (IMAGE_WIDTH - IMAGE_MARGIN * 2 - CARD_GAP) / 2;
const CARD_HEIGHT = 710;
const QR_GRID_HEIGHT = CARD_HEIGHT * 2 + CARD_GAP;
const MAX_CUSTOMERS_PER_IMAGE = 25;
const ROW_HEIGHT = 66;
const IMAGE_SCALE = 1.75;
const FONT_FAMILY = "Arial, sans-serif";
const BDO_GCASH_SPLIT_X = 304;
const MARIBANK_MAYA_SPLIT_X = 286;
const COLORS = {
  background: "#f8fafc",
  white: "#ffffff",
  ink: "#0f172a",
  muted: "#475569",
  border: "#cbd5e1",
  amber: "#92400e",
  amberLight: "#fffbeb",
};

type QrPanel = { image: HTMLImageElement; half: "left" | "right"; splitX: number; label: string };

function currency(amount: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}

function reportDate(): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
  }).format(new Date());
}

function fitText(context: CanvasRenderingContext2D, value: string, maxWidth: number): string {
  if (context.measureText(value).width <= maxWidth) return value;
  let shortened = value;
  while (shortened.length > 0 && context.measureText(`${shortened}…`).width > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened}…`;
}

function drawText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  options: { size?: number; weight?: number; color?: string; maxWidth?: number; align?: CanvasTextAlign } = {},
): void {
  context.font = `${options.weight ?? 400} ${options.size ?? 22}px ${FONT_FAMILY}`;
  context.fillStyle = options.color ?? COLORS.ink;
  context.textAlign = options.align ?? "left";
  context.textBaseline = "top";
  context.fillText(options.maxWidth ? fitText(context, value, options.maxWidth) : value, x, y);
}

function fillRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, color: string): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fillStyle = color;
  context.fill();
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("A payment QR image could not be loaded."));
    image.src = source;
  });
}

async function loadQrPanels(): Promise<QrPanel[]> {
  const [bdoGcash, maribankMaya] = await Promise.all([loadImage(bdoGcashQr), loadImage(maribankMayaQr)]);
  return [
    { image: bdoGcash, half: "left", splitX: BDO_GCASH_SPLIT_X, label: "BDO" },
    { image: bdoGcash, half: "right", splitX: BDO_GCASH_SPLIT_X, label: "GCash" },
    { image: maribankMaya, half: "left", splitX: MARIBANK_MAYA_SPLIT_X, label: "MariBank" },
    { image: maribankMaya, half: "right", splitX: MARIBANK_MAYA_SPLIT_X, label: "Maya" },
  ];
}

function createCanvas(height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(IMAGE_WIDTH * IMAGE_SCALE);
  canvas.height = Math.ceil(height * IMAGE_SCALE);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot generate the Utang image.");
  context.scale(IMAGE_SCALE, IMAGE_SCALE);
  context.fillStyle = COLORS.background;
  context.fillRect(0, 0, IMAGE_WIDTH, height);
  return { canvas, context };
}

function drawHeader(context: CanvasRenderingContext2D, title: string, subtitle: string): void {
  fillRoundedRect(context, IMAGE_MARGIN, 48, IMAGE_WIDTH - IMAGE_MARGIN * 2, 128, 24, COLORS.ink);
  drawText(context, "MINI POS", IMAGE_MARGIN + 30, 73, { size: 21, weight: 700, color: "#fbbf24" });
  drawText(context, title, IMAGE_MARGIN + 30, 107, { size: 38, weight: 700, color: COLORS.white, maxWidth: 870 });
  drawText(context, subtitle, IMAGE_WIDTH - IMAGE_MARGIN - 30, 86, { size: 19, color: "#e2e8f0", align: "right" });
}

function drawQrCard(context: CanvasRenderingContext2D, panel: QrPanel, x: number, y: number): void {
  fillRoundedRect(context, x, y, CARD_WIDTH, CARD_HEIGHT, 20, COLORS.white);
  context.strokeStyle = COLORS.border;
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(x + 0.5, y + 0.5, CARD_WIDTH - 1, CARD_HEIGHT - 1, 20);
  context.stroke();
  drawText(context, panel.label, x + 24, y + 22, { size: 27, weight: 700 });

  // The supplied files contain two payment panels each. Preserve every QR and
  // its recipient details together so staff can verify the destination.
  const sourceX = panel.half === "left" ? 0 : panel.splitX;
  const sourceWidth = panel.half === "left" ? panel.splitX : panel.image.width - panel.splitX;
  const maxWidth = CARD_WIDTH - 36;
  const maxHeight = CARD_HEIGHT - 88;
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / panel.image.height);
  const drawWidth = sourceWidth * scale;
  const drawHeight = panel.image.height * scale;
  context.drawImage(
    panel.image, sourceX, 0, sourceWidth, panel.image.height,
    x + (CARD_WIDTH - drawWidth) / 2, y + 66 + (maxHeight - drawHeight) / 2,
    drawWidth, drawHeight,
  );
}

function drawQrSection(context: CanvasRenderingContext2D, panels: QrPanel[], top: number, instruction: string): void {
  drawText(context, "Payment QR codes", IMAGE_MARGIN, top, { size: 29, weight: 700 });
  drawText(context, instruction, IMAGE_MARGIN, top + 39, { size: 20, color: COLORS.muted });
  const gridTop = top + 88;
  panels.forEach((panel, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    drawQrCard(context, panel, IMAGE_MARGIN + column * (CARD_WIDTH + CARD_GAP), gridTop + row * (CARD_HEIGHT + CARD_GAP));
  });
  drawText(context, "These QR codes do not include the balance amount. Confirm the recipient and enter the amount manually.", IMAGE_MARGIN, gridTop + QR_GRID_HEIGHT + 27, { size: 19, color: COLORS.muted });
  drawText(context, "QR payments require separate confirmation; Mini POS does not verify them automatically.", IMAGE_MARGIN, gridTop + QR_GRID_HEIGHT + 55, { size: 19, color: COLORS.muted });
}

function drawCustomerReport(customer: UtangImageCustomer, panels: QrPanel[]): HTMLCanvasElement {
  const qrTop = 448;
  const height = qrTop + 88 + QR_GRID_HEIGHT + 130;
  const { canvas, context } = createCanvas(height);
  drawHeader(context, "Utang balance", reportDate());
  drawText(context, "Customer", IMAGE_MARGIN, 208, { size: 19, color: COLORS.muted });
  drawText(context, customer.name, IMAGE_MARGIN, 237, { size: 37, weight: 700, maxWidth: 1050 });
  if (customer.contact) drawText(context, customer.contact, IMAGE_MARGIN, 283, { size: 20, color: COLORS.muted, maxWidth: 1000 });

  fillRoundedRect(context, IMAGE_MARGIN, 330, IMAGE_WIDTH - IMAGE_MARGIN * 2, 94, 18, COLORS.amberLight);
  drawText(context, "AMOUNT STILL OWED", IMAGE_MARGIN + 26, 351, { size: 21, weight: 700, color: COLORS.amber });
  drawText(context, currency(customer.balance), IMAGE_WIDTH - IMAGE_MARGIN - 26, 345, { size: 43, weight: 700, color: COLORS.ink, align: "right" });
  drawQrSection(context, panels, qrTop, "Choose one payment method and send the amount shown above.");
  return canvas;
}

function drawAllReport(customers: UtangImageCustomer[], panels: QrPanel[], page: number, pageCount: number, overallBalance: number): HTMLCanvasElement {
  const tableTop = 282;
  const qrTop = tableTop + customers.length * ROW_HEIGHT + 115;
  const height = qrTop + 88 + QR_GRID_HEIGHT + 130;
  const { canvas, context } = createCanvas(height);
  drawHeader(context, "Open Utang balances", reportDate());
  drawText(context, `Page ${page} of ${pageCount} · ${customers.length} customers on this page`, IMAGE_MARGIN, 199, { size: 22, color: COLORS.muted });
  drawText(context, "Staff report: share only the individual customer's balance image with that customer.", IMAGE_MARGIN, 228, { size: 17, color: COLORS.muted });
  drawText(context, "Customer", IMAGE_MARGIN + 16, tableTop - 30, { size: 19, weight: 700, color: COLORS.muted });
  drawText(context, "Amount owed", IMAGE_WIDTH - IMAGE_MARGIN - 16, tableTop - 30, { size: 19, weight: 700, color: COLORS.muted, align: "right" });
  customers.forEach((customer, index) => {
    const y = tableTop + index * ROW_HEIGHT;
    if (index % 2 === 0) fillRoundedRect(context, IMAGE_MARGIN, y - 5, IMAGE_WIDTH - IMAGE_MARGIN * 2, ROW_HEIGHT - 2, 8, COLORS.white);
    drawText(context, customer.name, IMAGE_MARGIN + 16, y + 4, { size: 22, weight: 600, maxWidth: 790 });
    if (customer.contact) drawText(context, customer.contact, IMAGE_MARGIN + 16, y + 31, { size: 17, color: COLORS.muted, maxWidth: 790 });
    drawText(context, currency(customer.balance), IMAGE_WIDTH - IMAGE_MARGIN - 16, y + 17, { size: 23, weight: 700, align: "right" });
  });
  const totalTop = tableTop + customers.length * ROW_HEIGHT + 10;
  fillRoundedRect(context, IMAGE_MARGIN, totalTop, IMAGE_WIDTH - IMAGE_MARGIN * 2, 78, 14, COLORS.amberLight);
  const pageBalance = customers.reduce((sum, customer) => sum + Math.round(customer.balance * 100), 0) / 100;
  drawText(context, "Page balance", IMAGE_MARGIN + 18, totalTop + 14, { size: 20, weight: 700, color: COLORS.amber });
  drawText(context, currency(pageBalance), IMAGE_WIDTH - IMAGE_MARGIN - 18, totalTop + 12, { size: 29, weight: 700, align: "right" });
  if (pageCount > 1) drawText(context, `All pages total: ${currency(overallBalance)}`, IMAGE_MARGIN + 18, totalTop + 46, { size: 17, color: COLORS.muted });
  drawQrSection(context, panels, qrTop, "Use only the matching customer's amount above for a payment.");
  return canvas;
}

function safeFilename(value: string): string {
  return value.normalize("NFKD").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "customer";
}

async function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not create the Utang PNG image.");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Download the latest balance for one customer with all supplied payment QR codes. */
export async function downloadCustomerUtangImage(customer: UtangImageCustomer): Promise<void> {
  const panels = await loadQrPanels();
  await downloadCanvas(drawCustomerReport(customer, panels), `utang-${safeFilename(`${customer.name}-${customer.contact ?? ""}`)}.png`);
}

/** Download every open balance, splitting long lists into manageable PNG pages. */
export async function downloadAllUtangImages(customers: UtangImageCustomer[]): Promise<number> {
  const openCustomers = customers.filter((customer) => customer.balance > 0);
  if (openCustomers.length === 0) throw new Error("There are no open Utang balances to export.");
  const panels = await loadQrPanels();
  const pageCount = Math.ceil(openCustomers.length / MAX_CUSTOMERS_PER_IMAGE);
  const overallBalance = openCustomers.reduce((sum, customer) => sum + Math.round(customer.balance * 100), 0) / 100;
  for (let index = 0; index < pageCount; index += 1) {
    const pageCustomers = openCustomers.slice(index * MAX_CUSTOMERS_PER_IMAGE, (index + 1) * MAX_CUSTOMERS_PER_IMAGE);
    const canvas = drawAllReport(pageCustomers, panels, index + 1, pageCount, overallBalance);
    await downloadCanvas(canvas, pageCount === 1 ? "utang-open-balances.png" : `utang-open-balances-${index + 1}-of-${pageCount}.png`);
  }
  return pageCount;
}
