import jsPDF from "jspdf";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";

type GuestRow = {
  id: string;
  identity_no: string | null;
  event_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  dept_class: string | null;
  unique_code: string;
  guest_type?: "regular" | "vip";
  status: "registered" | "confirmed" | "checked_in";
  checkin_time: string | null;
};

type EventRow = {
  id: string;
  name: string;
  slug: string;
  event_date: string | null;
  location: string | null;
  status: string;
  theme?: any;
  event_code?: string | null;
};

type GenerateGuestTicketPdfArgs = {
  guest: GuestRow;
  event: EventRow;
  buildQrPayload: () => Promise<string>;
};

type Rgb = { r: number; g: number; b: number };
type BoxIconType = "organization" | "event" | "time" | "location" | "dresscode" | "dept_class";

function safeText(value: string | null | undefined, fallback = "-") {
  return String(value ?? "").trim() || fallback;
}

function hexToRgb(hex: string, fallback: Rgb = { r: 0, g: 0, b: 0 }): Rgb {
  const clean = String(hex || "").replace("#", "").trim();

  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if ([r, g, b].some(Number.isNaN)) return fallback;
    return { r, g, b };
  }

  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return fallback;
    return { r, g, b };
  }

  return fallback;
}

function lighten(rgb: Rgb, amount = 0.12): Rgb {
  return {
    r: Math.round(rgb.r + (255 - rgb.r) * amount),
    g: Math.round(rgb.g + (255 - rgb.g) * amount),
    b: Math.round(rgb.b + (255 - rgb.b) * amount),
  };
}

function darken(rgb: Rgb, amount = 0.12): Rgb {
  return {
    r: Math.round(rgb.r * (1 - amount)),
    g: Math.round(rgb.g * (1 - amount)),
    b: Math.round(rgb.b * (1 - amount)),
  };
}

function splitText(doc: jsPDF, text: string, maxWidth: number) {
  return doc.splitTextToSize(String(text || ""), maxWidth) as string[];
}

function fitText(doc: jsPDF, text: string, maxWidth: number, startSize: number, minSize = 7) {
  let size = startSize;
  doc.setFontSize(size);

  while (size > minSize && doc.getTextWidth(text) > maxWidth) {
    size -= 0.4;
    doc.setFontSize(size);
  }

  return size;
}

function formatDateOnly(iso: string | null) {
  if (!iso) return "Tanggal menyusul";
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "Tanggal menyusul";
  }
}

function formatDateSimple(iso: string | null) {
  if (!iso) return "Tanggal menyusul";
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "Tanggal menyusul";
  }
}

function formatTimeOnly(iso: string | null) {
  if (!iso) return "Waktu menyusul";
  try {
    return (
      new Date(iso).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  } catch {
    return "Waktu menyusul";
  }
}

function formatTimeEnd(iso: string | null) {
  if (!iso) return "Waktu menyusul";
  try {
    return (
      new Date(iso).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      })
    );
  } catch {
    return "Waktu menyusul";
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Gagal membaca gambar"));
    };

    img.src = objectUrl;
  });
}

async function urlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return await blobToDataUrl(blob);
}

async function urlToOptimizedImageDataUrl(
  url: string,
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    mimeType?: "image/jpeg" | "image/png";
  }
): Promise<{ dataUrl: string; format: "JPEG" | "PNG" }> {
  const response = await fetch(url);
  const blob = await response.blob();

  const maxWidth = options?.maxWidth ?? 900;
  const maxHeight = options?.maxHeight ?? 900;
  const quality = options?.quality ?? 0.72;
  const mimeType = options?.mimeType ?? "image/jpeg";

  const img = await loadImageFromBlob(blob);
  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;

  const ratio = Math.min(
    1,
    maxWidth / naturalWidth,
    maxHeight / naturalHeight
  );

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(naturalHeight * ratio));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia");

  if (mimeType === "image/jpeg") {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return {
    dataUrl: canvas.toDataURL(mimeType, quality),
    format: mimeType === "image/png" ? "PNG" : "JPEG",
  };
}

async function getImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function drawLogoContain(
  doc: jsPDF,
  logoUrl: string,
  x: number,
  y: number,
  boxW: number,
  boxH: number
) {
  const { dataUrl: logoData, format: logoFormat } = await urlToOptimizedImageDataUrl(logoUrl, {
    maxWidth: 500,
    maxHeight: 350,
    quality: 0.75,
    mimeType: "image/png",
  });
  const { width: naturalWidth, height: naturalHeight } = await getImageSize(logoData);

  const ratio = Math.min(boxW / naturalWidth, boxH / naturalHeight);
  const drawW = naturalWidth * ratio;
  const drawH = naturalHeight * ratio;
  const drawX = x + (boxW - drawW) / 2;
  const drawY = y + (boxH - drawH) / 2;

  doc.addImage(logoData, logoFormat, drawX, drawY, drawW, drawH);
}

function drawFallbackLogo(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("LOGO", x + w / 2, y + h / 2 - 2, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("ACARA", x + w / 2, y + h / 2 + 5, { align: "center" });
}

function drawLineIcon(
  doc: jsPDF,
  x: number,
  y: number,
  size: number,
  type: BoxIconType,
  color: Rgb
) {
  const cx = x + size / 2;
  const cy = y + size / 2;

  doc.setDrawColor(color.r, color.g, color.b);
  doc.setLineWidth(0.85);

  if (type === "organization") {
    doc.rect(x + 1.6, y + 3, size - 3.2, size - 4.6, "S");
    doc.line(x + 4.2, y + 6, x + 4.2, y + size - 2.8);
    doc.line(cx, y + 6, cx, y + size - 2.8);
    doc.line(x + size - 4.2, y + 6, x + size - 4.2, y + size - 2.8);
    doc.line(x + 1.6, y + size - 4.2, x + size - 1.6, y + size - 4.2);
  }

  if (type === "event") {
    doc.rect(x + 2, y + 3.6, size - 4, size - 4.8, "S");
    doc.line(x + 4.4, y + 1.5, x + 4.4, y + 5.8);
    doc.line(x + size - 4.4, y + 1.5, x + size - 4.4, y + 5.8);
    doc.line(x + 2, y + 7.6, x + size - 2, y + 7.6);
  }

  if (type === "time") {
    doc.circle(cx, cy, size / 2 - 2.3, "S");
    doc.line(cx, cy, cx, cy - 3.8);
    doc.line(cx, cy, cx + 3.1, cy + 2.3);
  }

  if (type === "location") {
    doc.circle(cx, y + 5.3, 1.8, "S");
    doc.line(cx, y + 7.3, x + 4.3, y + size - 2.1);
    doc.line(cx, y + 7.3, x + size - 4.3, y + size - 2.1);
  }

  if (type === "dresscode") {
    doc.line(cx, y + 2, x + 3, y + 7);
    doc.line(cx, y + 2, x + size - 3, y + 7);
    doc.line(x + 3, y + 7, x + 5.8, y + size - 2);
    doc.line(x + size - 3, y + 7, x + size - 5.8, y + size - 2);
    doc.line(x + 5.8, y + size - 2, x + size - 5.8, y + size - 2);
  }

  if (type === "dept_class") {
    doc.rect(x + 2, y + 3.6, size - 4, size - 4.8, "S");
    doc.line(x + 4.4, y + 1.5, x + 4.4, y + 5.8);
    doc.line(x + size - 4.4, y + 1.5, x + size - 4.4, y + 5.8);
  }

}

function drawInfoCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  lines: string[],
  icon: BoxIconType,
  config: {
    cardBg: Rgb;
    titleColor: Rgb;
    bodyColor: Rgb;
    iconColor: Rgb;
    separatorColor?: Rgb;
  },
  options?: {
    separatorAfterLine?: number;
  }
) {
  doc.setFillColor(config.cardBg.r, config.cardBg.g, config.cardBg.b);
  doc.roundedRect(x, y, w, h, 7, 7, "F");

  const iconSize = 11;
  const iconX = x + 8;
  const iconY = y + 2;

  drawLineIcon(doc, iconX, iconY, iconSize, icon, config.iconColor);

  // title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(
    config.titleColor.r,
    config.titleColor.g,
    config.titleColor.b
  );

  const titleY = iconY + iconSize + 6;
  doc.text(title, x + 8, titleY);

  // body
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(
    config.bodyColor.r,
    config.bodyColor.g,
    config.bodyColor.b
  );

  const wrapped: string[] = [];
  for (const line of lines) {
    wrapped.push(...splitText(doc, line, w - 16));
  }

  const textStartY = titleY + 6;
  const textEndY = y + h - 2;
  const lineHeight = 4.4;
  const maxLines = Math.floor((textEndY - textStartY) / lineHeight);

  const visibleLines = wrapped.slice(0, maxLines);

  if (wrapped.length > maxLines && visibleLines.length > 0) {
    const lastIndex = visibleLines.length - 1;
    visibleLines[lastIndex] = visibleLines[lastIndex] + "...";
  }

  let yy = textStartY;

  visibleLines.forEach((line, index) => {
    doc.text(line, x + 8, yy);

    const separatorAfterLine = options?.separatorAfterLine;

    if (
      typeof separatorAfterLine === "number" &&
      index === separatorAfterLine &&
      index < visibleLines.length - 1
    ) {
      const lineY = yy + 4;

      const separatorColor = config.separatorColor ?? {
        r: 200,
        g: 200,
        b: 200,
      };

      doc.setDrawColor(
        separatorColor.r,
        separatorColor.g,
        separatorColor.b
      );
      doc.setLineWidth(0.35);

      doc.line(x + 15, lineY, x + w - 15, lineY);

      // kasih jarak ekstra setelah separator
      yy += 4;
    }

    yy += lineHeight;
  });
}

function drawPerforationDots(doc: jsPDF, x: number, y: number, h: number, color: Rgb) {
  doc.setFillColor(color.r, color.g, color.b);
  const start = y + 9;
  const end = y + h - 9;
  const step = 5.8;

  for (let yy = start; yy <= end; yy += step) {
    doc.circle(x, yy, 0.7, "F");
  }
}

function drawTicketConnectorCuts(
  doc: jsPDF,
  seamX: number,
  ticketY: number,
  ticketH: number,
  cutSize: number,
  cutColor: Rgb
) {
  doc.setFillColor(cutColor.r, cutColor.g, cutColor.b);

  // segitiga atas, masuk ke QR dan ke ticket orange
  // kiri
  doc.triangle(
    seamX, ticketY,
    seamX - cutSize, ticketY,
    seamX, ticketY + cutSize,
    "F"
  );

  // kanan
  doc.triangle(
    seamX, ticketY,
    seamX + cutSize, ticketY,
    seamX, ticketY + cutSize,
    "F"
  );

  // segitiga bawah
  // kiri bawah
  doc.triangle(
    seamX,
    ticketY + ticketH,
    seamX - cutSize,
    ticketY + ticketH,
    seamX,
    ticketY + ticketH - cutSize,
    "F"
  );

  // kanan bawah
  doc.triangle(
    seamX,
    ticketY + ticketH,
    seamX + cutSize,
    ticketY + ticketH,
    seamX,
    ticketY + ticketH - cutSize,
    "F"
  );
}

function drawLeftBlackCircleNotch(
  doc: jsPDF,
  seamX: number,
  centerY: number,
  radius: number,
  color: Rgb
) {
  doc.setFillColor(color.r, color.g, color.b);
  doc.circle(seamX, centerY, radius, "F");
}

async function generateBarcodeDataUrl(value: string): Promise<string> {
  const canvas = document.createElement("canvas");

  JsBarcode(canvas, value, {
    format: "CODE128",
    displayValue: false,
    margin: 0,
    width: 2,
    height: 40,
    background: "transparent",
    lineColor: "#000000",
  });

  return canvas.toDataURL("image/png");
}

function mixColor(base: Rgb, mixWith: Rgb, ratio = 0.6): Rgb {
  return {
    r: Math.round(base.r * ratio + mixWith.r * (1 - ratio)),
    g: Math.round(base.g * ratio + mixWith.g * (1 - ratio)),
    b: Math.round(base.b * ratio + mixWith.b * (1 - ratio)),
  };
}

function createOverlayImage(color: Rgb, alpha = 0.7) {
  const canvas = document.createElement("canvas");
  canvas.width = 10;
  canvas.height = 10;

  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
  ctx.fillRect(0, 0, 10, 10);

  return canvas.toDataURL("image/png");
}

export async function generateGuestTicketPdf({
  guest,
  event,
  buildQrPayload,
  autoDownload = true,
}: GenerateGuestTicketPdfArgs & { autoDownload?: boolean }) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const theme = event.theme ?? {};
  const brand = theme.brand ?? theme ?? {};
  const colors = theme.colors ?? {};
  const locationData = theme.locationData ?? {};

  const isVIP = guest.guest_type === "vip";
  const vipAccentHex =
    theme?.vip?.badgeColor ??
    "#D6C6A5";

  const vipAccent = hexToRgb(vipAccentHex, { r: 214, g: 198, b: 165 });
  const vipPrimary = hexToRgb(theme?.vip?.backColor ?? "#614C21", { r: 97, g: 76, b: 33 });

  const logoUrl = brand.logoUrl ?? brand.logo ?? null;

  // ===== COLOR SYSTEM FULL DYNAMIC =====
  const pageBg = isVIP
    ? hexToRgb("#FFFBF2")
    : hexToRgb(colors.pageBg ?? colors.backgroundColor ?? "#F4F4F4");

  const stripColor = isVIP
    ? hexToRgb("#111111")
    : hexToRgb(colors.stripColor ?? brand.primary ?? "#1F234D");

  const ticketColor = isVIP
    ? hexToRgb("#614C21")
    : hexToRgb(colors.ticketColor ?? brand.accent ?? "#232323");

  const cardBg = isVIP
    ? hexToRgb("#161616")
    : hexToRgb(colors.boxColor ?? "#F9F9F9");

  const iconColor = isVIP
    ? vipAccent
    : hexToRgb(colors.iconColor ?? colors.accent ?? "#000000");

  const titleColor = isVIP
    ? vipPrimary
    : hexToRgb(colors.boxTitleColor ?? "#141414");

  const bodyColor = isVIP
    ? hexToRgb("#FFFBF2")
    : hexToRgb(colors.boxBodyColor ?? "#232323");

  const cutColor = isVIP
    ? vipAccent
    : hexToRgb(colors.cutColor ?? "#000000");

  const ticketTextColor = isVIP
    ? hexToRgb("#FFFBF2")
    : hexToRgb(colors.ticketTextColor ?? "#141414");

  // ===== DATA =====
  const codeText = safeText(guest.unique_code, "-");
  const identityNo = safeText(guest.identity_no, "-");
  const guestName = safeText(guest.full_name, "Nama Tamu");
  const guestOrg = safeText(guest.organization, "Sekolah Pesat");
  const deptClass = safeText(guest.dept_class, "-");
  const taglineText = safeText(theme.tagline ?? event.name, event.name).toUpperCase();
  const headlineText = safeText(theme.headline ?? event.name, event.name).toUpperCase();

  const greetingTitle = safeText(theme.greetingTitle, "Kepada Yth.");
  const guestGreeting = safeText(theme.guestGreeting, "Orang Tua/ Wali Murid");
  const salamText = safeText(theme.salam, "Assalamualaikum, Wr. Wb. Selamat Pagi,");

  const venueName = safeText(locationData.name ?? event.location, "Lokasi Acara");
  const venueAddress = safeText(locationData.address ?? event.location, "Lokasi menyusul");

  const dressMale = safeText(theme.dresscodeMale, "-");
  const dressFemale = safeText(theme.dresscodeFemale, "-");

  const paragraphText =
    safeText(theme.about, "") ||
    `Sehubungan dengan diadakannya acara wisuda siswa-siswi kelas 12 ${guestOrg} dengan nama : “${safeText(
      theme.headline ?? event.name,
      event.name
    )}” kami mengundang orang tua/wali murid kelas 12 untuk menghadiri acara tersebut yang akan diselenggarakan pada :`;
  
  const effectiveGuestGreeting = isVIP
    ? theme.guestGreetingVip ?? "VIP Guest"
    : guestGreeting;

  const effectiveAbout = isVIP
    ? theme.aboutVip ??
      "Dengan hormat, kami mengundang Bapak/Ibu untuk menghadiri acara kami sebagai tamu VIP dengan informasi acara sebagai berikut:"
    : paragraphText;  

  const eventDateLong = formatDateOnly(event.event_date);
  const eventDateSimple = formatDateSimple(event.event_date);
  const eventTime = formatTimeOnly(event.event_date);
  const endTime = formatTimeEnd(theme.eventEndDate ?? null);

  const qrPayload = await buildQrPayload();
  const qrData = await QRCode.toDataURL(qrPayload, {
    margin: 0,
    width: 420,
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  const barcodeValue = guest.id;
  const barcodeData = await generateBarcodeDataUrl(barcodeValue);

  // ===== PAGE BG =====
  doc.setFillColor(pageBg.r, pageBg.g, pageBg.b);
  doc.rect(0, 0, pageW, pageH, "F");

  // ===== TOP AREA =====
  const topCodeX = 22;
  const topCodeY = 27;

  const logoX = 126;
  const logoY = 15;
  const logoW = 54;
  const logoH = 40;

  const introX = 22;
  const introY = 57;
  const introW = 140;

  // ===== BARCODE TOP =====
  const barcodeTopW = 60;
  const barcodeTopH = 10;

  const barcodeTopX = topCodeX; // sejajar dengan text
  const barcodeTopY = topCodeY - 18; // di atas ID

  // background putih biar kebaca
  doc.setFillColor(255, 255, 255);
  doc.rect(
    barcodeTopX - 2,
    barcodeTopY - 1,
    barcodeTopW + 4,
    barcodeTopH + 2,
    "F"
  );

  // barcode
  doc.addImage(
    barcodeData,
    "PNG",
    barcodeTopX,
    barcodeTopY,
    barcodeTopW,
    barcodeTopH
  );

  doc.setFont("helvetica", "bold");
  doc.setTextColor(lighten(titleColor, 0.4).r, lighten(titleColor, 0.4).g, lighten(titleColor, 0.4).b);
  doc.setFontSize(21);
  doc.text(codeText, topCodeX, topCodeY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);  
  doc.text(isVIP ? "VIP PASS" : "E-TICKET", topCodeX, topCodeY + 10);  
  
  if (logoUrl) {
    try {
      await drawLogoContain(doc, logoUrl, logoX, logoY, logoW, logoH);
    } catch {
      drawFallbackLogo(doc, logoX, logoY, logoW, logoH);
    }
  } else {
    drawFallbackLogo(doc, logoX, logoY, logoW, logoH);
  }

  let y = introY;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(titleColor.r, titleColor.g, titleColor.b);
  doc.setFontSize(11);
  doc.text(greetingTitle, introX, y);

  y += 6.5;
  doc.setFontSize(10);  
  doc.setTextColor(lighten(titleColor, 0.4).r, lighten(titleColor, 0.4).g, lighten(titleColor, 0.4).b);
  doc.text(effectiveGuestGreeting, introX, y);

  y += 11;
  doc.setFont("helvetica", "bold");  
  doc.setTextColor(titleColor.r, titleColor.g, titleColor.b);
  doc.setFontSize(18);
  doc.text(guestName.toUpperCase(), introX, y);

  y += 7.5;
  doc.setFont("helvetica", "normal");  
  doc.setTextColor(lighten(titleColor, 0.4).r, lighten(titleColor, 0.4).g, lighten(titleColor, 0.4).b);
  doc.setFontSize(10);

  const iconSize = 8;
  const iconGap = 12;

  // posisi awal
  let currentX = introX;

  // ===== ORGANIZATION =====
  drawLineIcon(doc, currentX, y - 6, iconSize, "organization", iconColor);

  currentX += iconGap;
  doc.text(guestOrg, currentX, y);

  // hitung lebar text organization
  const orgWidth = doc.getTextWidth(guestOrg);

  // geser ke kanan + spacing
  currentX += orgWidth + 6;

  doc.setFontSize(10);  
  doc.setTextColor(lighten(titleColor, 0.4).r, lighten(titleColor, 0.4).g, lighten(titleColor, 0.4).b);

  currentX += 6;

  // ===== DEPT / CLASS =====
  if (deptClass !== "-") {    
    doc.text("•", currentX - 4, y);
    drawLineIcon(doc, currentX, y - 6, iconSize - 1, "dept_class", iconColor);

    currentX += iconGap;
    doc.text(deptClass, currentX, y);
  }

  const maxWidth = 180;

  if (currentX + doc.getTextWidth(deptClass) > maxWidth) {
    // turun ke baris baru kalau kepanjangan
    y += 11;
    currentX = introX;

    drawLineIcon(doc, currentX, y - 6, iconSize, "dept_class", iconColor);
    doc.text(deptClass, currentX + iconGap, y);
  }

  y += 16;
  doc.setFontSize(11);  
  doc.setTextColor(titleColor.r, titleColor.g, titleColor.b);
  doc.text(salamText, introX, y);

  y += 8;
  doc.setFontSize(11);
  doc.setTextColor(titleColor.r, titleColor.g, titleColor.b);
  const introLines = splitText(doc, effectiveAbout, introW);
  for (const line of introLines.slice(0, 5)) {
    doc.text(line, introX, y);
    y += 5.4;
  }

  // ===== STRIP =====
  const stripY = 129;
  const stripH = 80;
  doc.setFillColor(stripColor.r, stripColor.g, stripColor.b);
  doc.rect(0, stripY, pageW, stripH, "F");

  // ===== CARD SYSTEM PROPORSIONAL =====
  const cardOuterX = 7;
  const cardGap = 4;
  const totalWidth = pageW - cardOuterX * 2;
  const cardW = (totalWidth - cardGap * 3) / 4;
  const cardH = 60;
  const cardY = stripY + 10;

  // biar lebih pas: title 1 baris, body max 4 baris, padding tetap
  const cardConfig = {
    cardBg,
    titleColor,
    bodyColor,
    iconColor,
    separatorColor: lighten(bodyColor, 0.7),
  };

  drawInfoCard(doc, cardOuterX, cardY, cardW, cardH, "Acara", [event.name], "event", cardConfig);

  drawInfoCard(
    doc,
    cardOuterX + (cardW + cardGap),
    cardY,
    cardW,
    cardH,
    "Tanggal & Waktu",
    [eventDateLong, `${eventTime}${theme.eventEndDate ? ` - ${endTime}` : ""}`],
    "time",
    cardConfig,
  { separatorAfterLine: 1 }
  );

  drawInfoCard(
    doc,
    cardOuterX + 2 * (cardW + cardGap),
    cardY,
    cardW,
    cardH,
    "Lokasi",
    [venueName, venueAddress],
    "location",
    cardConfig,
  { separatorAfterLine: 1 }
  );

  drawInfoCard(
    doc,
    cardOuterX + 3 * (cardW + cardGap),
    cardY,
    cardW,
    cardH,
    "Dresscode",
    [`Laki-laki: ${dressMale}`, `Perempuan: ${dressFemale}`],
    "dresscode",
    cardConfig,
  { separatorAfterLine: 1 }
  );

  // ===== BOTTOM TICKET =====
  const qrBlockX = 10;
  const qrBlockY = 205;
  const qrBlockW = 70;
  const qrBlockH = 84;

  const qrSize = 60;
  const qrX = qrBlockX + 5;
  const qrY = qrBlockY + 18;

  const seamX = 90;
  const ticketY = 209;
  const ticketW = pageW - seamX;
  const ticketH = 90;


  const hero = theme.hero ?? {};
  const heroImageUrl =
    hero.imageUrl ??
    brand.heroImageUrl ??
    brand.heroImage ??
    null;

  let heroImageData: string | null = null;
  let heroImageFormat: "PNG" | "JPEG" = "JPEG";

  if (heroImageUrl) {
    try {
      const optimizedHero = await urlToOptimizedImageDataUrl(heroImageUrl, {
        maxWidth: 900,
        maxHeight: 700,
        quality: 0.62,
        mimeType: "image/jpeg",
      });

      heroImageData = optimizedHero.dataUrl;
      heroImageFormat = optimizedHero.format;
    } catch {
      heroImageData = null;
    }
  }

  // ===== HERO BACKGROUND =====
  if (heroImageData) {
    doc.addImage(
      heroImageData,
      heroImageFormat,
      seamX,
      ticketY,
      ticketW,
      ticketH
    );

    const overlayImg = createOverlayImage(ticketColor, 0.85);

    doc.addImage(
      overlayImg,
      "PNG",
      seamX,
      ticketY,
      ticketW,
      ticketH
    );
  } else {
    doc.setFillColor(ticketColor.r, ticketColor.g, ticketColor.b);
    doc.rect(seamX, ticketY, ticketW, ticketH, "F");
  }

  // potongan sambungan atas & bawah, nyambung visual ke seam
  drawTicketConnectorCuts(doc, seamX, ticketY, ticketH, 10, cutColor);

  // perforation
  drawPerforationDots(doc, seamX, ticketY, ticketH, cutColor);

  // notch kanan
  doc.circle(pageW, ticketY + ticketH / 1.5, 10, "F");

  // QR
  doc.addImage(qrData, "PNG", qrX, qrY, qrSize, qrSize);

  // text ticket
  const tx = seamX + 14;

  const barcodeY = ticketY + 12;
  const priorityY = barcodeY + 16;
  const identityY = isVIP ? barcodeY + 24 : barcodeY + 18;
  const nameY = identityY + 12;

  // barcode
  const barcodeW = 52;
  const barcodeH = 10;
  doc.setFillColor(255, 255, 255);
  doc.rect(tx - 2, barcodeY - 1, barcodeW + 4, barcodeH + 2, "F");
  doc.addImage(barcodeData, "PNG", tx, barcodeY, barcodeW, barcodeH);

  if (isVIP) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(vipAccent.r, vipAccent.g, vipAccent.b);
    doc.text("PRIORITY ACCESS", tx, priorityY);
  }

  // identity
  doc.setTextColor(ticketTextColor.r, ticketTextColor.g, ticketTextColor.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(identityNo, tx, identityY);

  // ===== NAMA =====
  const nameBoxY = nameY - 4;
  const nameBoxH = 9;
  doc.setFillColor(
    lighten(ticketColor, 0.4).r,
    lighten(ticketColor, 0.4).g,
    lighten(ticketColor, 0.4).b
  );
  doc.rect(tx - 2, nameBoxY, barcodeW, nameBoxH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(ticketTextColor.r, ticketTextColor.g, ticketTextColor.b);

  const maxNameWidth = ticketW - 48;
  const nameLines = splitText(doc, guestName.toUpperCase(), maxNameWidth).slice(0, 2);

  // line height dibikin rapet
  const nameLineHeight = 8;

  // hitung tinggi block nama
  const nameBlockHeight = nameLines.length * nameLineHeight;

  // gambar nama
  let currentNameY = nameY;
  for (const line of nameLines) {
    doc.text(line, tx, currentNameY);
    currentNameY += nameLineHeight;
  }

  // ===== BADGE / HEADLINE / DATE =====
  // posisi bawah jangan terlalu ikut panjang nama
  const afterNameY = nameY + Math.max(nameBlockHeight, 14);

  let vipBadgeY = afterNameY + 2;
  let headlineY = isVIP ? vipBadgeY + 10 : afterNameY + 8;
  let dateY = headlineY + 5;

  if (isVIP) {
    doc.setFillColor(vipAccent.r, vipAccent.g, vipAccent.b);
    doc.roundedRect(tx - 2, vipBadgeY - 4, 36, 6, 2, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(10, 10, 10);
    doc.text("VIP GUEST", tx + 16, vipBadgeY, { align: "center" });
  }

  doc.setFont("helvetica", "normal");
  doc.setTextColor(ticketTextColor.r, ticketTextColor.g, ticketTextColor.b);

  fitText(doc, headlineText, ticketW - 24, 9, 9);
  doc.text(headlineText, tx, headlineY);

  fitText(doc, eventDateSimple, ticketW - 24, 9, 9);
  doc.text(eventDateSimple, tx, dateY);

  if (autoDownload) {
    doc.save(`e-ticket-${guest.unique_code}-${guest.full_name.replace(/\s/g, '-')}.pdf`);
    return null;
  }

  return doc.output("blob");
}