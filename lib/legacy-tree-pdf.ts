import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { exportTreeSections, type ExportPerson } from "@/lib/legacy-tree-export";

const fontNames = [
  "noto-sans-latin-400-normal.woff",
  "noto-sans-latin-ext-400-normal.woff",
  "noto-sans-vietnamese-400-normal.woff",
  "noto-sans-greek-400-normal.woff",
  "noto-sans-greek-ext-400-normal.woff",
  "noto-sans-cyrillic-400-normal.woff",
  "noto-sans-cyrillic-ext-400-normal.woff",
  "noto-sans-devanagari-400-normal.woff",
];

type Font = { font: PDFFont; characters: Set<number> };
type Run = { text: string; font: PDFFont };

export class UnsupportedTreeCharacterError extends Error {}

function runs(text: string, fonts: Font[]): Run[] {
  const parts: Run[] = [];
  for (const character of text.normalize("NFC")) {
    const found = fonts.find(({ characters }) => characters.has(character.codePointAt(0)!));
    if (!found) throw new UnsupportedTreeCharacterError("The PDF font does not support a character in this tree.");
    const previous = parts[parts.length - 1];
    if (previous?.font === found.font) previous.text += character;
    else parts.push({ text: character, font: found.font });
  }
  return parts;
}

function textWidth(text: string, size: number, fonts: Font[]) {
  return runs(text, fonts).reduce((width, part) => width + part.font.widthOfTextAtSize(part.text, size), 0);
}

function drawText(page: PDFPage, text: string, x: number, y: number, size: number, fonts: Font[], centered = false) {
  let left = centered ? x - textWidth(text, size, fonts) / 2 : x;
  for (const part of runs(text, fonts)) {
    page.drawText(part.text, { x: left, y, size, font: part.font, color: rgb(0.18, 0.16, 0.13) });
    left += part.font.widthOfTextAtSize(part.text, size);
  }
}

function wrap(text: string, width: number, size: number, fonts: Font[]) {
  const result: string[] = [];
  let line = "";
  for (const character of text.normalize("NFC").replace(/\s+/g, " ").trim()) {
    const next = line + character;
    if (line && textWidth(next, size, fonts) > width) {
      result.push(line.trimEnd());
      line = character.trimStart();
    } else {
      line = next;
    }
  }
  if (line) result.push(line);
  return result;
}

export async function createLegacyTreePdf(
  ownerName: string,
  familyName: string,
  people: ExportPerson[],
  generatedAt: Date,
) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const fontData = await Promise.all([
    ...fontNames.map((name) => readFile(join(process.cwd(), "node_modules", "@fontsource", "noto-sans", "files", name))),
    readFile(join(process.cwd(), "node_modules", "@reductoai", "portable-fonts", "files", "DroidSansFallback.ttf")),
  ]);
  const fonts = await Promise.all(fontData.map(async (data) => {
    const font = await document.embedFont(data, { subset: true });
    return { font, characters: new Set(font.getCharacterSet()) };
  }));
  const title = familyName ? `The ${familyName} Family` : `${ownerName}'s Legacy Tree`;
  const date = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(generatedAt);
  const sections = exportTreeSections(people, ownerName);
  const pageWidth = 792;
  const pageHeight = 612;
  const margin = 44;
  const columnWidth = (pageWidth - 2 * margin) / 3;
  let page: PDFPage;
  let y = 0;

  function newPage() {
    page = document.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(0.995, 0.99, 0.97) });
    const titleLines = wrap(title, pageWidth - 2 * margin, 20, fonts);
    y = pageHeight - 55;
    for (const line of titleLines) {
      drawText(page, line, pageWidth / 2, y, 20, fonts, true);
      y -= 25;
    }
    y -= 14;
    drawText(page, "Build it today. Leave it forever.", pageWidth / 2, 51, 10, fonts, true);
    drawText(page, "Never Say Goodbye™", pageWidth / 2, 36, 9, fonts, true);
    drawText(page, date, pageWidth / 2, 23, 9, fonts, true);
  }

  newPage();
  for (const section of sections) {
    for (let index = 0; index < section.people.length; index += 3) {
      const heading = wrap(`${section.label}${index > 0 ? " (continued)" : ""}`, pageWidth - 2 * margin, 12, fonts);
      const row = section.people.slice(index, index + 3);
      const cards = row.map((person) => {
        const years = person.birthYear && person.deathYear ? `${person.birthYear}–${person.deathYear}` :
          person.birthYear ? `Born ${person.birthYear}` : person.deathYear ? `Passed ${person.deathYear}` : "";
        return [
          ...wrap(person.name, columnWidth - 20, 13, fonts).map((text) => ({ text, size: 13 })),
          ...wrap([person.isOwner ? "" : person.relationship, years].filter(Boolean).join(" · "), columnWidth - 20, 10, fonts).map((text) => ({ text, size: 10 })),
          ...(person.isHonored ? [{ text: "Honored Life™", size: 10 }] : []),
        ];
      });
      const rowHeight = Math.max(...cards.map((card) => card.length)) * 18 + 14;
      const headingHeight = heading.length * 17 + 10;
      if (rowHeight + headingHeight > pageHeight - 160) {
        throw new Error("A family member's name or relationship is too long to fit on a page.");
      }
      if (index === 0 || y - rowHeight < 85) {
        if (y - headingHeight - rowHeight < 85) newPage();
        for (const line of heading) {
          drawText(page!, line, pageWidth / 2, y, 12, fonts, true);
          y -= 17;
        }
        y -= 10;
      }
      cards.forEach((card, column) => {
        card.forEach((line, lineIndex) =>
          drawText(page!, line.text, margin + column * columnWidth + columnWidth / 2, y - lineIndex * 18, line.size, fonts, true));
      });
      y -= rowHeight;
    }
    y -= 12;
  }
  return document.save();
}
