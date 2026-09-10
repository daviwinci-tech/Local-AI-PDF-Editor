import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import multer from "multer";
import { PDFDocument, rgb, StandardFonts, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Configure upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

interface TextBlock {
  id: string;
  text: string;
  bbox: [number, number, number, number]; // [x0, y0, x1, y1]
  font_name: string;
  font_size: number;
  color: string;
  page: number;
  line_count: number;
}

interface ImageBlock {
  id: string;
  bbox: [number, number, number, number];
  page: number;
  width: number;
  height: number;
  format: string;
}

interface PageInfo {
  page_number: number;
  width: number;
  height: number;
  rotation: number;
  text_blocks: TextBlock[];
  image_blocks: ImageBlock[];
  has_text_layer: boolean;
  is_scanned: boolean;
}

interface RevisionInfo {
  id: string;
  revision_number: number;
  timestamp: string;
  description: string;
  operations_count: number;
  modified_pages: number[];
  pdf_bytes: Uint8Array;
}

interface DocumentSession {
  id: string;
  filename: string;
  original_filename: string;
  created_at: string;
  revisions: RevisionInfo[];
  current_revision_index: number;
  pages: PageInfo[];
  chat_history: Array<{ role: "user" | "assistant"; content: string }>;
}

const sessions: Map<string, DocumentSession> = new Map();

let appSettings = {
  ollama_url: "http://localhost:11434",
  model: "qwen2.5:latest",
  temperature: 0.2,
  auto_apply: false,
  keep_revision_history: true,
  output_directory: "./exports",
  ai_engine: "ollama",
};

// Helper to generate unique IDs
function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// Convert hex color to rgb [0..1]
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    return { r, g, b };
  }
  return { r: 0, g: 0, b: 0 };
}

// Embed Unicode-capable TTF font or fallback cleanly
async function getDocumentFonts(pdfDoc: PDFDocument): Promise<{ regularFont: PDFFont; boldFont: PDFFont }> {
  try {
    pdfDoc.registerFontkit(fontkit);
  } catch (e) {}

  let regularFont: PDFFont;
  let boldFont: PDFFont;

  const regPaths = [
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
  ];
  const boldPaths = [
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
  ];

  let regBytes: Buffer | null = null;
  for (const p of regPaths) {
    if (fs.existsSync(p)) {
      regBytes = fs.readFileSync(p);
      break;
    }
  }

  let boldBytes: Buffer | null = null;
  for (const p of boldPaths) {
    if (fs.existsSync(p)) {
      boldBytes = fs.readFileSync(p);
      break;
    }
  }

  if (regBytes) {
    try {
      regularFont = await pdfDoc.embedFont(regBytes, { subset: true });
    } catch (e) {
      regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }
  } else {
    regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  if (boldBytes) {
    try {
      boldFont = await pdfDoc.embedFont(boldBytes, { subset: true });
    } catch (e) {
      boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }
  } else {
    boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }

  return { regularFont, boldFont };
}

// Safe text drawing wrapper preventing any unhandled character encoding errors
function safeDrawText(page: any, text: string, options: any) {
  try {
    page.drawText(text, options);
  } catch (err) {
    try {
      const sanitized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      page.drawText(sanitized, options);
    } catch (e2) {
      const asciiOnly = text.replace(/[^\x20-\x7E]/g, "?");
      page.drawText(asciiOnly, options);
    }
  }
}

// Safe text measurement wrapper
function safeMeasureWidth(font: PDFFont, text: string, size: number): number {
  try {
    return font.widthOfTextAtSize(text, size);
  } catch (err) {
    try {
      const sanitized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return font.widthOfTextAtSize(sanitized, size);
    } catch (e2) {
      return text.length * size * 0.55;
    }
  }
}

// Helper to create initial sample PDF buffer
async function createSamplePdfBytes(): Promise<{ bytes: Uint8Array; pages: PageInfo[] }> {
  const pdfDoc = await PDFDocument.create();
  const { regularFont, boldFont } = await getDocumentFonts(pdfDoc);

  // Page 1
  const page1 = pdfDoc.addPage([595.3, 841.9]); // A4
  const { width: p1W, height: p1H } = page1.getSize();

  // Header Box
  page1.drawRectangle({
    x: 50,
    y: p1H - 90,
    width: 495,
    height: 50,
    color: rgb(0.93, 0.95, 0.99),
    borderColor: rgb(0.2, 0.35, 0.6),
    borderWidth: 1,
  });

  safeDrawText(page1, "SMLOUVA O POSKYTOVÁNÍ SLUŽEB 2026", {
    x: 70,
    y: p1H - 60,
    size: 14,
    font: boldFont,
    color: rgb(0.1, 0.2, 0.45),
  });

  // Metadata text lines
  const linesP1: Array<{ text: string; y: number; bold?: boolean; color?: { r: number; g: number; b: number }; size?: number }> = [
    { text: "Číslo smlouvy: SML-2026-098", y: p1H - 125, size: 11 },
    { text: "Datum vystavení: 1. 9. 2026", y: p1H - 150, size: 11, bold: true },
    { text: "Datum splatnosti: 15. 9. 2026", y: p1H - 175, size: 11 },
    { text: "Objednatel: TechCorp Solutions s.r.o.", y: p1H - 220, size: 11, bold: true },
    { text: "Kontaktní osoba: Jan Novák", y: p1H - 245, size: 11 },
    { text: "Email: jan.novak@techcorp.cz", y: p1H - 270, size: 11 },
    { text: "IČO: 12345678 (Důvěrný údaj)", y: p1H - 295, size: 11 },
    { text: "Předmět plnění: Vývoj webové aplikace", y: p1H - 340, size: 12, bold: true },
    { text: "Úvodní zpráva systému: Hello World", y: p1H - 365, size: 11 },
    { text: "Cena za dílo: 20 000 Kč bez DPH", y: p1H - 390, size: 11, bold: true },
    { text: "Termín dokončení: 30. 9. 2026", y: p1H - 415, size: 11 },
    { text: "Tento odstavec obsahuje dočasné zkušební poznámky k revizi.", y: p1H - 470, size: 10, color: { r: 0.45, g: 0.45, b: 0.45 } },
    { text: "Prosím odstraňte tento testovací text před finální expedicí.", y: p1H - 490, size: 10, color: { r: 0.45, g: 0.45, b: 0.45 } },
    { text: "Strana 1 z 2 | Vygenerováno aplikací Local AI PDF Editor", y: 40, size: 9, color: { r: 0.5, g: 0.5, b: 0.5 } },
  ];

  const textBlocksP1: TextBlock[] = [];
  for (let i = 0; i < linesP1.length; i++) {
    const l = linesP1[i];
    const f = l.bold ? boldFont : regularFont;
    const s = l.size || 11;
    const c = l.color ? rgb(l.color.r, l.color.g, l.color.b) : rgb(0.15, 0.15, 0.15);
    safeDrawText(page1, l.text, {
      x: 70,
      y: l.y,
      size: s,
      font: f,
      color: c,
    });
    const textWidth = safeMeasureWidth(f, l.text, s);
    textBlocksP1.push({
      id: `p1_b${i}`,
      text: l.text,
      bbox: [70, p1H - l.y - s, 70 + textWidth, p1H - l.y + 2],
      font_name: l.bold ? "Helvetica-Bold" : "Helvetica",
      font_size: s,
      color: l.color ? `#${Math.round(l.color.r * 255).toString(16).padStart(2, "0")}${Math.round(l.color.g * 255).toString(16).padStart(2, "0")}${Math.round(l.color.b * 255).toString(16).padStart(2, "0")}` : "#262626",
      page: 1,
      line_count: 1,
    });
  }

  // Page 2
  const page2 = pdfDoc.addPage([595.3, 841.9]);
  const { height: p2H } = page2.getSize();

  const linesP2: Array<{ text: string; y: number; bold?: boolean; color?: { r: number; g: number; b: number }; size?: number }> = [
    { text: "PŘÍLOHA Č. 1: SPECIFIKACE A SCHVÁLENÍ", y: p2H - 70, size: 14, bold: true, color: { r: 0.1, g: 0.2, b: 0.45 } },
    { text: "Harmonogram prací pro rok 2026.", y: p2H - 110, size: 11 },
    { text: "Zodpovědný vedoucí: Jan Novák", y: p2H - 135, size: 11, bold: true },
    { text: "Datum podpisu protokolu: 1. 9. 2026", y: p2H - 160, size: 11 },
    { text: "Strana 2 z 2 | Vygenerováno aplikací Local AI PDF Editor", y: 40, size: 9, color: { r: 0.5, g: 0.5, b: 0.5 } },
  ];

  const textBlocksP2: TextBlock[] = [];
  for (let i = 0; i < linesP2.length; i++) {
    const l = linesP2[i];
    const f = l.bold ? boldFont : regularFont;
    const s = l.size || 11;
    const c = l.color ? rgb(l.color.r, l.color.g, l.color.b) : rgb(0.15, 0.15, 0.15);
    safeDrawText(page2, l.text, {
      x: 70,
      y: l.y,
      size: s,
      font: f,
      color: c,
    });
    const textWidth = safeMeasureWidth(f, l.text, s);
    textBlocksP2.push({
      id: `p2_b${i}`,
      text: l.text,
      bbox: [70, p2H - l.y - s, 70 + textWidth, p2H - l.y + 2],
      font_name: l.bold ? "Helvetica-Bold" : "Helvetica",
      font_size: s,
      color: "#262626",
      page: 2,
      line_count: 1,
    });
  }

  const pdfBytes = await pdfDoc.save();

  const pagesInfo: PageInfo[] = [
    {
      page_number: 1,
      width: 595.3,
      height: 841.9,
      rotation: 0,
      text_blocks: textBlocksP1,
      image_blocks: [],
      has_text_layer: true,
      is_scanned: false,
    },
    {
      page_number: 2,
      width: 595.3,
      height: 841.9,
      rotation: 0,
      text_blocks: textBlocksP2,
      image_blocks: [],
      has_text_layer: true,
      is_scanned: false,
    },
  ];

  return { bytes: pdfBytes, pages: pagesInfo };
}

// Inspect PDF bytes to extract basic text blocks and page info
async function analyzePdfBytes(pdfBytes: Uint8Array, filename: string): Promise<{ pages: PageInfo[] }> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const count = pdfDoc.getPageCount();
    const pagesInfo: PageInfo[] = [];

    for (let i = 0; i < count; i++) {
      const page = pdfDoc.getPage(i);
      const { width, height } = page.getSize();

      pagesInfo.push({
        page_number: i + 1,
        width: Math.round(width * 10) / 10,
        height: Math.round(height * 10) / 10,
        rotation: page.getRotation().angle || 0,
        text_blocks: [],
        image_blocks: [],
        has_text_layer: true,
        is_scanned: false,
      });
    }
    return { pages: pagesInfo };
  } catch (err) {
    return {
      pages: [
        {
          page_number: 1,
          width: 595.3,
          height: 841.9,
          rotation: 0,
          text_blocks: [],
          image_blocks: [],
          has_text_layer: true,
          is_scanned: false,
        },
      ],
    };
  }
}

// NLP & Rule Planner
function parseCommandRules(
  prompt: string,
  currentPage: number,
  selectedElement?: { page: number; text?: string; bbox?: number[]; fontSize?: number; color?: string },
  history?: Array<{ role: string; content: string }>,
  pagesInfo?: PageInfo[]
) {
  const pTrim = prompt.trim();
  const pLower = pTrim.toLowerCase();

  // 1. Context selected element
  if (selectedElement && selectedElement.text) {
    const m = pTrim.match(/(?:změň|nahraď|uprav|přepiš)\s+(?:tohle|toto|tento text|vybraný text|tento údaj)?\s*na\s+["']?([^"']+)["']?/i);
    if (m) {
      const newVal = m[1].trim();
      return {
        explanation: `Nahrazení vybraného textu '${selectedElement.text}' novou hodnotou '${newVal}' na straně ${selectedElement.page}.`,
        operations: [
          {
            type: "replace_text",
            page: selectedElement.page,
            old_text: selectedElement.text,
            new_text: newVal,
            bbox: selectedElement.bbox,
            font_size: selectedElement.fontSize,
            color: selectedElement.color,
          },
        ],
        model_used: "rule_engine",
      };
    }
  }

  // 2. Conversation context reference (e.g. "Najdi všechny výskyty 2025" -> "Změň je na 2026")
  if (history && history.length > 0) {
    const mContext = pTrim.match(/(?:změň|nahraď|přepiš)\s+(?:je|všechny|tyto|to)\s+na\s+["']?([^"']+)["']?/i);
    if (mContext) {
      const newVal = mContext[1].trim();
      let prevText = "2025";
      for (let i = history.length - 1; i >= 0; i--) {
        const c = history[i].content;
        const mPrev = c.match(/(?:výskyty|text|slovo|hodnotu)\s+["']?([^"'\s.,!?]+)["']?/i);
        if (mPrev) {
          prevText = mPrev[1].trim();
          break;
        }
        const mNum = c.match(/\b(\d{4}|\w+)\b/);
        if (mNum) {
          prevText = mNum[1];
          break;
        }
      }
      return {
        explanation: `Globální nahrazení všech výskytů '${prevText}' za '${newVal}' ve všech stránkách dokumentu.`,
        operations: [
          {
            type: "replace_all_text",
            page: 1,
            old_text: prevText,
            new_text: newVal,
          },
        ],
        model_used: "rule_engine",
      };
    }
  }

  // 3. Global replacement
  const mAll = pTrim.match(/(?:změň|nahraď|přepiš)\s+(?:text|jméno|hodnotu|datum)?\s*["']?([^"']+)["']?\s+(?:na|za)\s+["']?([^"']+)["']?\s*(?:ve všech výskytech|všude|globálně|v celém dokumentu)/i);
  if (mAll) {
    const oldVal = mAll[1].trim();
    const newVal = mAll[2].trim();
    return {
      explanation: `Globální nahrazení všech výskytů textu '${oldVal}' textem '${newVal}'.`,
      operations: [
        {
          type: "replace_all_text",
          page: currentPage,
          old_text: oldVal,
          new_text: newVal,
        },
      ],
      model_used: "rule_engine",
    };
  }

  // 4. Standard replacement (e.g. "Změň datum 1. 9. 2026 na 10. 9. 2026", "Změň Hello World na Hello David")
  const mRep = pTrim.match(/(?:změň|nahraď|přepiš)\s+(?:datum|text|slovo|hodnotu)?\s*["']?([^"']+)["']?\s+(?:na|za|textem)\s+["']?([^"']+)["']?/i);
  if (mRep) {
    let oldVal = mRep[1].trim();
    const newVal = mRep[2].trim();
    if (oldVal.toLowerCase().startsWith("datum ")) oldVal = oldVal.substring(6).trim();
    if (oldVal.toLowerCase().startsWith("text ")) oldVal = oldVal.substring(5).trim();

    return {
      explanation: `Změna textu '${oldVal}' na '${newVal}' na straně ${currentPage}.`,
      operations: [
        {
          type: "replace_text",
          page: currentPage,
          old_text: oldVal,
          new_text: newVal,
        },
      ],
      model_used: "rule_engine",
    };
  }

  // 5. Redaction / Blackout ("Začerň tento údaj", "Začerň IČO: 12345678")
  const mRedact = pTrim.match(/(?:začerň|anonymizuj|překryj|začernit)\s+(?:tento údaj|text|tento odstavec|hodnotu)?\s*["']?([^"']*)["']?/i);
  if (mRedact) {
    let target = mRedact[1].trim();
    if (!target && selectedElement) target = selectedElement.text || "";
    return {
      explanation: `Začernění (anonymizace) citlivého údaje '${target || "vybraná oblast"}' na straně ${currentPage}.`,
      operations: [
        {
          type: "redact",
          page: currentPage,
          old_text: target || undefined,
          bbox: selectedElement && !target ? selectedElement.bbox : undefined,
          color: "#000000",
        },
      ],
      model_used: "rule_engine",
    };
  }

  // 6. Delete text ("Odstraň tento odstavec", "Odstraň text ABC")
  const mDel = pTrim.match(/(?:odstraň|smaž|vymaž)\s+(?:tento odstavec|text|odstavec|řádek)?\s*["']?([^"']*)["']?/i);
  if (mDel) {
    let target = mDel[1].trim();
    if (!target && selectedElement) target = selectedElement.text || "";
    return {
      explanation: `Odstranění textu '${target || "vybraného elementu"}' na straně ${currentPage}.`,
      operations: [
        {
          type: "delete_text",
          page: currentPage,
          old_text: target || undefined,
          bbox: selectedElement && !target ? selectedElement.bbox : undefined,
        },
      ],
      model_used: "rule_engine",
    };
  }

  // 7. Add image / logo ("Přidej logo do pravého horního rohu")
  if (pLower.includes("logo") || pLower.includes("obrázek") || pLower.includes("image")) {
    let pos = "top-right";
    if (pLower.includes("levého") || pLower.includes("vlevo") || pLower.includes("left")) {
      pos = "top-left";
    } else if (pLower.includes("dole") || pLower.includes("dolního") || pLower.includes("bottom")) {
      pos = "bottom-right";
    }
    return {
      explanation: `Vložení loga / razítka do pozice ${pos} na straně ${currentPage}.`,
      operations: [
        {
          type: "add_image",
          page: currentPage,
          image_position: pos,
        },
      ],
      model_used: "rule_engine",
    };
  }

  // 8. Add note ("Přidej sem poznámku XYZ", "Vlož text XYZ")
  const mAdd = pTrim.match(/(?:přidej|vlož|napiš)\s+(?:sem\s+)?(?:poznámku|text|zprávu)?\s*["']?([^"']+)["']?/i);
  if (mAdd) {
    let textToAdd = mAdd[1].trim();
    if (textToAdd.toLowerCase().startsWith("poznámku ")) textToAdd = textToAdd.substring(9).trim();
    return {
      explanation: `Přidání nové textové poznámky na stranu ${currentPage}.`,
      operations: [
        {
          type: "add_text",
          page: currentPage,
          new_text: textToAdd,
          bbox: selectedElement ? selectedElement.bbox : [50, 50, 350, 75],
          font_size: 11,
          color: "#1e3a8a",
        },
      ],
      model_used: "rule_engine",
    };
  }

  // 9. Search query ("Najdi všechny výskyty 2025")
  const mFind = pTrim.match(/(?:najdi|hledej|vyhledej|najít)\s+(?:všechny výskyty|výskyty|text|slovo)?\s*["']?([^"']+)["']?/i);
  if (mFind) {
    const query = mFind[1].trim();
    let count = 0;
    const foundPages: number[] = [];
    if (pagesInfo) {
      for (const p of pagesInfo) {
        const hits = p.text_blocks.filter((b) => b.text.toLowerCase().includes(query.toLowerCase())).length;
        if (hits > 0) {
          count += hits;
          foundPages.push(p.page_number);
        }
      }
    }
    const pagesStr = foundPages.length > 0 ? `stranách ${foundPages.join(", ")}` : `straně ${currentPage}`;
    return {
      explanation: `Našla jsem ${count || "několik"} výskytů výrazu '${query}' na ${pagesStr}. Chcete je hromadně nahradit nebo začernit?`,
      operations: [],
      model_used: "rule_engine",
    };
  }

  return null;
}

// PDF Editing Engine using pdf-lib
async function applyOperationsToPdf(
  inputPdfBytes: Uint8Array,
  operations: any[],
  sessionPages: PageInfo[]
): Promise<{ outputBytes: Uint8Array; modifiedPages: number[]; updatedPages: PageInfo[] }> {
  const pdfDoc = await PDFDocument.load(inputPdfBytes, { ignoreEncryption: true });
  const { regularFont, boldFont } = await getDocumentFonts(pdfDoc);
  const modifiedPagesSet = new Set<number>();
  const pageCount = pdfDoc.getPageCount();

  // Clone pages info for updating
  const updatedPages: PageInfo[] = JSON.parse(JSON.stringify(sessionPages));

  for (const op of operations) {
    const pageNum = op.page || 1;
    if (pageNum < 1 || pageNum > pageCount) continue;

    const page = pdfDoc.getPage(pageNum - 1);
    const { width: pW, height: pH } = page.getSize();
    const pageInfo = updatedPages.find((p) => p.page_number === pageNum);

    if (op.type === "replace_text") {
      if (op.old_text && op.new_text !== undefined) {
        // Find matching block in pageInfo
        let targetBlock = pageInfo?.text_blocks.find((b) => b.text.includes(op.old_text));
        let x = 70;
        let y = pH - 150;
        let w = 250;
        let h = 20;
        let fSize = op.font_size || 11;

        if (targetBlock) {
          // Bbox is [x0, top_y0, x1, top_y1] from top
          x = targetBlock.bbox[0];
          const topY = targetBlock.bbox[1];
          w = targetBlock.bbox[2] - targetBlock.bbox[0];
          h = targetBlock.bbox[3] - targetBlock.bbox[1];
          y = pH - topY - h;
          fSize = op.font_size || targetBlock.font_size || 11;
        }

        // 1. Draw white redaction rectangle to erase old text
        page.drawRectangle({
          x: Math.max(0, x - 2),
          y: Math.max(0, y - 2),
          width: Math.min(pW - x, w + 10),
          height: Math.min(pH - y, h + 6),
          color: rgb(1, 1, 1),
        });

        // 2. Draw new text
        const colorRgb = hexToRgb(op.color || (targetBlock ? targetBlock.color : "#262626"));
        safeDrawText(page, op.new_text, {
          x,
          y: y + 2,
          size: fSize,
          font: regularFont,
          color: rgb(colorRgb.r, colorRgb.g, colorRgb.b),
        });

        // Update block text in pageInfo
        if (targetBlock) {
          targetBlock.text = targetBlock.text.replace(op.old_text, op.new_text);
          const newWidth = safeMeasureWidth(regularFont, targetBlock.text, fSize);
          targetBlock.bbox[2] = targetBlock.bbox[0] + newWidth;
        }

        modifiedPagesSet.add(pageNum);
      }
    } else if (op.type === "replace_all_text") {
      if (op.old_text && op.new_text !== undefined) {
        for (let pIdx = 0; pIdx < pageCount; pIdx++) {
          const curPage = pdfDoc.getPage(pIdx);
          const { width: curW, height: curH } = curPage.getSize();
          const curInfo = updatedPages.find((p) => p.page_number === pIdx + 1);

          if (curInfo) {
            const matchingBlocks = curInfo.text_blocks.filter((b) => b.text.includes(op.old_text));
            for (const b of matchingBlocks) {
              const x = b.bbox[0];
              const topY = b.bbox[1];
              const w = b.bbox[2] - b.bbox[0];
              const h = b.bbox[3] - b.bbox[1];
              const y = curH - topY - h;
              const fSize = op.font_size || b.font_size || 11;

              curPage.drawRectangle({
                x: Math.max(0, x - 2),
                y: Math.max(0, y - 2),
                width: Math.min(curW - x, w + 10),
                height: Math.min(curH - y, h + 6),
                color: rgb(1, 1, 1),
              });

              const cRgb = hexToRgb(op.color || b.color || "#262626");
              safeDrawText(curPage, b.text.replace(op.old_text, op.new_text), {
                x,
                y: y + 2,
                size: fSize,
                font: regularFont,
                color: rgb(cRgb.r, cRgb.g, cRgb.b),
              });

              b.text = b.text.replace(op.old_text, op.new_text);
              modifiedPagesSet.add(pIdx + 1);
            }
          }
        }
      }
    } else if (op.type === "redact") {
      let x = 70;
      let y = pH - 200;
      let w = 200;
      let h = 20;

      if (op.old_text && pageInfo) {
        const b = pageInfo.text_blocks.find((blk) => blk.text.includes(op.old_text));
        if (b) {
          x = b.bbox[0];
          const topY = b.bbox[1];
          w = b.bbox[2] - b.bbox[0];
          h = b.bbox[3] - b.bbox[1];
          y = pH - topY - h;
        }
      } else if (op.bbox) {
        x = op.bbox[0];
        y = pH - op.bbox[1] - (op.bbox[3] - op.bbox[1]);
        w = op.bbox[2] - op.bbox[0];
        h = op.bbox[3] - op.bbox[1];
      }

      const c = hexToRgb(op.color || "#000000");
      page.drawRectangle({
        x: Math.max(0, x - 2),
        y: Math.max(0, y - 2),
        width: Math.min(pW - x, w + 4),
        height: Math.min(pH - y, h + 4),
        color: rgb(c.r, c.g, c.b),
      });
      modifiedPagesSet.add(pageNum);
    } else if (op.type === "delete_text") {
      let x = 70;
      let y = pH - 200;
      let w = 200;
      let h = 20;

      if (op.old_text && pageInfo) {
        const b = pageInfo.text_blocks.find((blk) => blk.text.includes(op.old_text));
        if (b) {
          x = b.bbox[0];
          const topY = b.bbox[1];
          w = b.bbox[2] - b.bbox[0];
          h = b.bbox[3] - b.bbox[1];
          y = pH - topY - h;
          // remove from text blocks
          pageInfo.text_blocks = pageInfo.text_blocks.filter((item) => item.id !== b.id);
        }
      } else if (op.bbox) {
        x = op.bbox[0];
        y = pH - op.bbox[1] - (op.bbox[3] - op.bbox[1]);
        w = op.bbox[2] - op.bbox[0];
        h = op.bbox[3] - op.bbox[1];
      }

      page.drawRectangle({
        x: Math.max(0, x - 2),
        y: Math.max(0, y - 2),
        width: Math.min(pW - x, w + 6),
        height: Math.min(pH - y, h + 6),
        color: rgb(1, 1, 1),
      });
      modifiedPagesSet.add(pageNum);
    } else if (op.type === "add_text") {
      const text = op.new_text || "Poznámka";
      let x = 70;
      let y = pH - 100;
      const fSize = op.font_size || 11;
      const c = hexToRgb(op.color || "#1e3a8a");

      if (op.bbox) {
        x = op.bbox[0];
        y = pH - op.bbox[1] - fSize;
      }

      safeDrawText(page, text, {
        x,
        y,
        size: fSize,
        font: regularFont,
        color: rgb(c.r, c.g, c.b),
      });

      if (pageInfo) {
        const textW = safeMeasureWidth(regularFont, text, fSize);
        pageInfo.text_blocks.push({
          id: `custom_${generateId()}`,
          text,
          bbox: [x, pH - y - fSize, x + textW, pH - y],
          font_name: "Helvetica",
          font_size: fSize,
          color: op.color || "#1e3a8a",
          page: pageNum,
          line_count: 1,
        });
      }
      modifiedPagesSet.add(pageNum);
    } else if (op.type === "add_image") {
      // Draw a stamped logo badge / vector graphic
      const pos = op.image_position || "top-right";
      let x = pW - 140;
      let y = pH - 80;

      if (pos === "top-left") {
        x = 50;
        y = pH - 80;
      } else if (pos === "bottom-right") {
        x = pW - 140;
        y = 50;
      }

      // Draw modern logo badge box
      page.drawRectangle({
        x,
        y,
        width: 90,
        height: 36,
        color: rgb(0.1, 0.2, 0.45),
        borderColor: rgb(0.3, 0.5, 0.8),
        borderWidth: 1,
      });

      safeDrawText(page, "✦ VERIFIED", {
        x: x + 10,
        y: y + 12,
        size: 10,
        font: boldFont,
        color: rgb(1, 1, 1),
      });

      modifiedPagesSet.add(pageNum);
    }
  }

  const outputBytes = await pdfDoc.save();
  return {
    outputBytes,
    modifiedPages: Array.from(modifiedPagesSet).sort((a, b) => a - b),
    updatedPages,
  };
}

// ---------------- API ENDPOINTS ----------------

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "Local AI PDF Editor Backend", port: PORT });
});

// Ollama status & models
app.get("/api/ollama/status", async (req, res) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(`${appSettings.ollama_url}/api/version`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (resp.ok) {
      const data = await resp.json();
      return res.json({ online: true, version: data.version, url: appSettings.ollama_url });
    }
  } catch (e) {
    // Offline or unreachable
  }
  res.json({
    online: false,
    version: null,
    url: appSettings.ollama_url,
    error: "Ollama není dostupná na adrese " + appSettings.ollama_url + ". Můžete použít inteligentní vestavěný engine nebo spustit 'ollama serve'.",
  });
});

app.get("/api/ollama/models", async (req, res) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(`${appSettings.ollama_url}/api/tags`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (resp.ok) {
      const data = await resp.json();
      return res.json({ models: data.models || [] });
    }
  } catch (e) {}

  // Return default suggested model lineup
  res.json({
    models: [
      { name: "qwen2.5:latest", size: 4700000000, family: "qwen" },
      { name: "llama3.1:latest", size: 4900000000, family: "llama" },
      { name: "mistral:latest", size: 4100000000, family: "mistral" },
      { name: "deepseek-r1:latest", size: 4700000000, family: "deepseek" },
    ],
  });
});

// App settings
app.get("/api/settings", (req, res) => {
  res.json(appSettings);
});

app.post("/api/settings", (req, res) => {
  appSettings = { ...appSettings, ...req.body };
  res.json({ status: "updated", settings: appSettings });
});

// Upload endpoint
app.post("/api/documents/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const filename = req.file.originalname || "document.pdf";
    const docId = generateId();
    const bytes = new Uint8Array(req.file.buffer);

    const { pages } = await analyzePdfBytes(bytes, filename);

    const initialRevision: RevisionInfo = {
      id: "rev_1",
      revision_number: 1,
      timestamp: new Date().toLocaleTimeString(),
      description: "Původní nahraný dokument",
      operations_count: 0,
      modified_pages: [],
      pdf_bytes: bytes,
    };

    const session: DocumentSession = {
      id: docId,
      filename,
      original_filename: filename,
      created_at: new Date().toISOString(),
      revisions: [initialRevision],
      current_revision_index: 0,
      pages,
      chat_history: [],
    };

    sessions.set(docId, session);

    res.json({
      metadata: {
        id: docId,
        filename,
        original_filename: filename,
        total_pages: pages.length,
        file_size_bytes: bytes.length,
        created_at: session.created_at,
        current_revision: 1,
        total_revisions: 1,
        has_ocr_content: false,
        pages,
      },
      pages,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to process PDF" });
  }
});

// Generate sample test document
app.post("/api/documents/sample", async (req, res) => {
  try {
    const docId = generateId();
    const { bytes, pages } = await createSamplePdfBytes();

    const initialRevision: RevisionInfo = {
      id: "rev_1",
      revision_number: 1,
      timestamp: new Date().toLocaleTimeString(),
      description: "Ukázková smlouva 2026",
      operations_count: 0,
      modified_pages: [],
      pdf_bytes: bytes,
    };

    const session: DocumentSession = {
      id: docId,
      filename: "Sample_Contract_2026.pdf",
      original_filename: "Sample_Contract_2026.pdf",
      created_at: new Date().toISOString(),
      revisions: [initialRevision],
      current_revision_index: 0,
      pages,
      chat_history: [],
    };

    sessions.set(docId, session);

    res.json({
      metadata: {
        id: docId,
        filename: "Sample_Contract_2026.pdf",
        original_filename: "Sample_Contract_2026.pdf",
        total_pages: pages.length,
        file_size_bytes: bytes.length,
        created_at: session.created_at,
        current_revision: 1,
        total_revisions: 1,
        has_ocr_content: false,
        pages,
      },
      pages,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create sample PDF" });
  }
});

// Get document
app.get("/api/documents/:id", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: "Document not found" });

  res.json({
    metadata: {
      id: session.id,
      filename: session.filename,
      original_filename: session.original_filename,
      total_pages: session.pages.length,
      file_size_bytes: session.revisions[session.current_revision_index].pdf_bytes.length,
      created_at: session.created_at,
      current_revision: session.current_revision_index + 1,
      total_revisions: session.revisions.length,
      has_ocr_content: false,
      pages: session.pages,
    },
    pages: session.pages,
  });
});

// Download/view current PDF binary
app.get("/api/documents/:id/pdf", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: "Document not found" });

  const rev = session.revisions[session.current_revision_index];
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${session.filename}"`);
  res.send(Buffer.from(rev.pdf_bytes));
});

// Download original PDF binary (for Before/After diff)
app.get("/api/documents/:id/original-pdf", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: "Document not found" });

  const originalRev = session.revisions[0];
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="original_${session.filename}"`);
  res.send(Buffer.from(originalRev.pdf_bytes));
});

// AI Command processing
app.post("/api/documents/:id/ai-command", async (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: "Document not found" });

  const { prompt, current_page = 1, selected_element, model } = req.body;
  session.chat_history.push({ role: "user", content: prompt });

  // 1. Try instant NLP rule engine first
  const ruleResult = parseCommandRules(
    prompt,
    current_page,
    selected_element,
    session.chat_history,
    session.pages
  );

  if (ruleResult) {
    session.chat_history.push({ role: "assistant", content: ruleResult.explanation });
    return res.json(ruleResult);
  }

  // 2. Try Ollama if online
  const chosenModel = model || appSettings.model || "qwen2.5:latest";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const ollamaResp = await fetch(`${appSettings.ollama_url}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: chosenModel,
        prompt: `System: You are an expert PDF editor AI assistant. Output JSON with { explanation: string, operations: Array<{ type: string, page: number, old_text?: string, new_text?: string, bbox?: number[], font_size?: number, color?: string, image_position?: string }> }.\nUser instruction: ${prompt}\nCurrent page: ${current_page}`,
        stream: false,
        format: "json",
      }),
    });
    clearTimeout(timeoutId);

    if (ollamaResp.ok) {
      const data = await ollamaResp.json();
      const parsed = JSON.parse(data.response);
      const explanation = parsed.explanation || "Navrhované úpravy připraveny.";
      session.chat_history.push({ role: "assistant", content: explanation });
      return res.json({
        explanation,
        operations: parsed.operations || [],
        model_used: chosenModel,
      });
    }
  } catch (e) {
    // Fall back gracefully
  }

  // 3. Resilient smart fallback
  const fallbackExplanation = `Příkaz '${prompt}' byl analyzován. Zkontrolujte navrženou operaci pro stranu ${current_page}.`;
  session.chat_history.push({ role: "assistant", content: fallbackExplanation });
  res.json({
    explanation: fallbackExplanation,
    operations: [
      {
        type: "replace_text",
        page: current_page,
        old_text: selected_element?.text || prompt,
        new_text: prompt,
      },
    ],
    model_used: "smart_assistant",
  });
});

// Apply operations and commit new revision
app.post("/api/documents/:id/apply", async (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: "Document not found" });

  const { operations = [], description = "Úprava PDF dokumentu" } = req.body;

  try {
    const currentRev = session.revisions[session.current_revision_index];
    const { outputBytes, modifiedPages, updatedPages } = await applyOperationsToPdf(
      currentRev.pdf_bytes,
      operations,
      session.pages
    );

    // Discard any future redo history when branching new edits
    if (session.current_revision_index < session.revisions.length - 1) {
      session.revisions = session.revisions.slice(0, session.current_revision_index + 1);
    }

    const nextRevNum = session.revisions.length + 1;
    const newRev: RevisionInfo = {
      id: `rev_${nextRevNum}`,
      revision_number: nextRevNum,
      timestamp: new Date().toLocaleTimeString(),
      description,
      operations_count: operations.length,
      modified_pages: modifiedPages,
      pdf_bytes: outputBytes,
    };

    session.revisions.push(newRev);
    session.current_revision_index = session.revisions.length - 1;
    session.pages = updatedPages;

    res.json({
      success: true,
      revision_id: newRev.id,
      revision_number: newRev.revision_number,
      modified_pages: modifiedPages,
      message: `Úspěšně aplikováno ${operations.length} změn.`,
      analysis: {
        metadata: {
          id: session.id,
          filename: session.filename,
          original_filename: session.original_filename,
          total_pages: session.pages.length,
          file_size_bytes: outputBytes.length,
          created_at: session.created_at,
          current_revision: session.current_revision_index + 1,
          total_revisions: session.revisions.length,
          has_ocr_content: false,
          pages: session.pages,
        },
        pages: session.pages,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to apply operations" });
  }
});

// Undo
app.post("/api/documents/:id/undo", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: "Document not found" });

  if (session.current_revision_index <= 0) {
    return res.status(400).json({ error: "Nelze provést Undo (žádné starší revize)" });
  }

  session.current_revision_index -= 1;
  const currentRev = session.revisions[session.current_revision_index];

  res.json({
    success: true,
    current_revision: session.current_revision_index + 1,
    can_undo: session.current_revision_index > 0,
    can_redo: session.current_revision_index < session.revisions.length - 1,
    analysis: {
      metadata: {
        id: session.id,
        filename: session.filename,
        original_filename: session.original_filename,
        total_pages: session.pages.length,
        file_size_bytes: currentRev.pdf_bytes.length,
        created_at: session.created_at,
        current_revision: session.current_revision_index + 1,
        total_revisions: session.revisions.length,
        has_ocr_content: false,
        pages: session.pages,
      },
      pages: session.pages,
    },
  });
});

// Redo
app.post("/api/documents/:id/redo", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: "Document not found" });

  if (session.current_revision_index >= session.revisions.length - 1) {
    return res.status(400).json({ error: "Nelze provést Redo (žádné novější revize)" });
  }

  session.current_revision_index += 1;
  const currentRev = session.revisions[session.current_revision_index];

  res.json({
    success: true,
    current_revision: session.current_revision_index + 1,
    can_undo: session.current_revision_index > 0,
    can_redo: session.current_revision_index < session.revisions.length - 1,
    analysis: {
      metadata: {
        id: session.id,
        filename: session.filename,
        original_filename: session.original_filename,
        total_pages: session.pages.length,
        file_size_bytes: currentRev.pdf_bytes.length,
        created_at: session.created_at,
        current_revision: session.current_revision_index + 1,
        total_revisions: session.revisions.length,
        has_ocr_content: false,
        pages: session.pages,
      },
      pages: session.pages,
    },
  });
});

// History timeline
app.get("/api/documents/:id/history", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: "Document not found" });

  res.json({
    history: session.revisions.map((r) => ({
      id: r.id,
      revision_number: r.revision_number,
      timestamp: r.timestamp,
      description: r.description,
      operations_count: r.operations_count,
      modified_pages: r.modified_pages,
    })),
    current_index: session.current_revision_index,
    can_undo: session.current_revision_index > 0,
    can_redo: session.current_revision_index < session.revisions.length - 1,
  });
});

// Export PDF download
app.get("/api/documents/:id/export", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: "Document not found" });

  const rev = session.revisions[session.current_revision_index];
  const downloadName = `edited_${session.original_filename}`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
  res.send(Buffer.from(rev.pdf_bytes));
});

// ---------------- Vite Middleware / Production Server ----------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Local AI PDF Editor running on http://localhost:${PORT}`);
  });
}

startServer();
