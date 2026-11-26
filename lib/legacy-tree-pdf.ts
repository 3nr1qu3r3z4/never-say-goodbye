import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { exportTreeSections, type ExportPerson } from "@/lib/legacy-tree-export";
import { positionRelationship, treePersonKey, treeReferenceKey } from "@/lib/tree-positioning";

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

function wrapHeading(text: string, width: number, size: number, fonts: Font[]) {
  const result: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    if (line && textWidth(`${line} ${word}`, size, fonts) > width) {
      result.push(line);
      line = "";
    }
    const parts = wrap(word, width, size, fonts);
    if (parts.length > 1) {
      result.push(...parts.slice(0, -1));
      line = parts[parts.length - 1];
    } else {
      line = line ? `${line} ${word}` : word;
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
  const cardWidth = 210;
  const cardGap = 18;
  const spineX = 36;
  const borderColor = rgb(0.68, 0.57, 0.38);
  const cardColor = rgb(1, 0.998, 0.988);
  let page!: PDFPage;
  let y = 0;
  type Card = { person: ExportPerson; page: PDFPage; x: number; top: number; bottom: number };
  const owner = people.find((person) => person.isOwner);
  const layoutState: {
    parentGroups: { sectionIndex: number; people: ExportPerson[]; cards: Card[] }[];
    household: Card[];
    householdLastRowBottom: number | null;
    centeredHousehold: boolean;
    childSpine: { page: PDFPage; y: number } | null;
  } = { parentGroups: [], household: [], householdLastRowBottom: null, centeredHousehold: false, childSpine: null };

  function line(x1: number, y1: number, x2: number, y2: number) {
    if (x1 === x2 && y1 === y2) return;
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.8, color: borderColor });
  }

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
  const simpleTree = sections.length === 3 && sections[1].label === "Household" &&
    sections.every((section) => section.people.length <= 3) &&
    sections[0].people.every((person) => positionRelationship(person.relationship)?.generation === 1) &&
    sections[2].people.every((person) => positionRelationship(person.relationship)?.generation === -1);
  const estimatedHeight = simpleTree ? sections.reduce((total, section) => {
    const headingHeight = wrapHeading(section.label, 140, 12, fonts).length * 17 + 10;
    const maxLines = Math.max(...section.people.map((person) => {
      const years = person.birthYear && person.deathYear ? `${person.birthYear}–${person.deathYear}` :
        person.birthYear ? `Born ${person.birthYear}` : person.deathYear ? `Passed ${person.deathYear}` : "";
      return wrap(person.name, cardWidth - 20, 13, fonts).length +
        wrap([person.relationship, years].filter(Boolean).join(" · "), cardWidth - 20, 10, fonts).length +
        Number(person.isHonored);
    }));
    return total + headingHeight + Math.max(54, maxLines * 18 + 16) + 14 + 12;
  }, 0) : 0;
  const sectionGap = simpleTree && y - estimatedHeight - 48 >= 85 ? 24 : 0;
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const section = sections[sectionIndex];
    const ownerIndex = section.label === "Household" ? section.people.findIndex((person) => person.isOwner) : -1;
    const partners = section.label === "Household"
      ? section.people.filter((person) => !person.isOwner && !treeReferenceKey(person) && positionRelationship(person.relationship)?.partner)
      : [];
    const partnerIndex = partners.length === 1 ? section.people.indexOf(partners[0]) : -1;
    const hasHouseholdConnector = ownerIndex >= 0 && partnerIndex === ownerIndex + 1;
    if (section.label === "Household") layoutState.centeredHousehold = hasHouseholdConnector && section.people.length === 2;
    const sectionCards: Card[] = [];
    for (let index = 0; index < section.people.length;) {
      const heading = wrapHeading(`${section.label}${index > 0 ? " (continued)" : ""}`, 140, 12, fonts);
      const rowSize = hasHouseholdConnector && ownerIndex === index + 2 ? 2 : 3;
      const row = section.people.slice(index, index + rowSize);
      const cards = row.map((person) => {
        const years = person.birthYear && person.deathYear ? `${person.birthYear}–${person.deathYear}` :
          person.birthYear ? `Born ${person.birthYear}` : person.deathYear ? `Passed ${person.deathYear}` : "";
        const showRelationship = section.label === "Additional Family" ||
          (section.label === "Household" && !person.isOwner && !(hasHouseholdConnector && person === partners[0]));
        return [
          ...wrap(person.name, cardWidth - 20, 13, fonts).map((text) => ({ text, size: 13 })),
          ...wrap([showRelationship ? person.relationship : "", years].filter(Boolean).join(" · "), cardWidth - 20, 10, fonts).map((text) => ({ text, size: 10 })),
          ...(person.isHonored ? [{ text: "Honored Life™", size: 10 }] : []),
        ];
      });
      const cardHeight = Math.max(54, Math.max(...cards.map((card) => card.length)) * 18 + 16);
      const rowHeight = cardHeight + 14;
      const headingHeight = heading.length * 17 + 10;
      if (rowHeight + headingHeight > pageHeight - 160) {
        throw new Error("A family member's name or relationship is too long to fit on a page.");
      }
      if (index === 0 || y - rowHeight < 85) {
        if (y - headingHeight - rowHeight < 85) newPage();
        for (const line of heading) {
          drawText(page, line, margin, y, 12, fonts);
          y -= 17;
        }
        y -= 10;
      }
      const rowWidth = row.length * cardWidth + (row.length - 1) * cardGap;
      const rowLeft = (pageWidth - rowWidth) / 2;
      const cardTop = y + 4;
      const cardBottom = cardTop - cardHeight;
      const rowCards: Card[] = [];
      cards.forEach((card, column) => {
        const x = rowLeft + column * (cardWidth + cardGap);
        const placed = { person: row[column], page, x: x + cardWidth / 2, top: cardTop, bottom: cardBottom };
        rowCards.push(placed);
        sectionCards.push(placed);
        page.drawRectangle({
          x, y: cardBottom, width: cardWidth, height: cardHeight,
          color: cardColor, borderColor, borderWidth: 0.7,
        });
        const textTop = cardBottom + (cardHeight + (card.length - 1) * 18) / 2 - 4;
        card.forEach((line, lineIndex) =>
          drawText(page!, line.text, x + cardWidth / 2, textTop - lineIndex * 18, line.size, fonts, true));
      });
      if (section.label === "Household") layoutState.householdLastRowBottom = cardBottom;
      if (hasHouseholdConnector && ownerIndex >= index && partnerIndex < index + row.length) {
        const ownerColumn = ownerIndex - index;
        const startX = rowLeft + ownerColumn * (cardWidth + cardGap) + cardWidth;
        const endX = startX + cardGap;
        line(startX, cardBottom + cardHeight / 2, endX, cardBottom + cardHeight / 2);
      }
      if (section.label === "Household" && owner) {
        for (const group of layoutState.parentGroups) {
          const reference = treeReferenceKey(group.people[0]) ?? treePersonKey(owner);
          const target = rowCards.find((card) => treePersonKey(card.person) === reference);
          if (target && (target.person.isOwner || (partners.length === 1 && target.person === partners[0] &&
              group.sectionIndex === sectionIndex - 1 && index === 0)) &&
            group.cards.length <= 3 && group.cards.every((card) =>
              card.page === page && card.bottom === group.cards[0].bottom &&
              positionRelationship(card.person.relationship)?.generation === 1 &&
              (treeReferenceKey(card.person) ?? treePersonKey(owner)) === reference)) {
            const busY = group.cards[0].bottom - 5;
            for (const card of group.cards) line(card.x, card.bottom, card.x, busY);
            if (index === 0 && group.sectionIndex === sectionIndex - 1) {
              const trunkX = layoutState.centeredHousehold ? pageWidth / 2 : target.x;
              line(Math.min(trunkX, ...group.cards.map((card) => card.x)), busY,
                Math.max(trunkX, ...group.cards.map((card) => card.x)), busY);
              if (trunkX === target.x) {
                line(target.x, busY, target.x, target.top);
              } else {
                line(trunkX, busY, trunkX, target.top + 10);
                line(trunkX, target.top + 10, target.x, target.top + 10);
                line(target.x, target.top + 10, target.x, target.top);
              }
            } else {
              const parentSpineX = 24;
              line(parentSpineX, busY, Math.max(...group.cards.map((card) => card.x)), busY);
              line(parentSpineX, busY, parentSpineX, target.top + 5);
              line(parentSpineX, target.top + 5, target.x, target.top + 5);
              line(target.x, target.top + 5, target.x, target.top);
            }
          }
        }
      }
      const childReference = owner && (treeReferenceKey(section.people[0]) ?? treePersonKey(owner));
      const source = layoutState.household.find((card) => treePersonKey(card.person) === childReference);
      if (owner && source?.page === page && sections[sectionIndex - 1]?.label === "Household" &&
          section.people.every((person) => positionRelationship(person.relationship)?.generation === -1 &&
            (treeReferenceKey(person) ?? treePersonKey(owner)) === childReference)) {
        const busY = cardTop + 5;
        if (section.people.length <= 3 && source.bottom === layoutState.householdLastRowBottom) {
          const trunkX = layoutState.centeredHousehold ? pageWidth / 2 : source.x;
          // Start at the referenced person, not the partnership line, so the other parent's identity is not assumed.
          if (trunkX === source.x) {
            line(source.x, source.bottom, source.x, busY);
          } else {
            line(source.x, source.bottom, source.x, source.bottom - 10);
            line(source.x, source.bottom - 10, trunkX, source.bottom - 10);
            line(trunkX, source.bottom - 10, trunkX, busY);
          }
          line(Math.min(trunkX, ...rowCards.map((card) => card.x)), busY,
            Math.max(trunkX, ...rowCards.map((card) => card.x)), busY);
          for (const card of rowCards) line(card.x, busY, card.x, card.top);
        } else if (!layoutState.childSpine) {
          line(source.x, source.bottom, source.x, source.bottom - 5);
          line(spineX, source.bottom - 5, source.x, source.bottom - 5);
          layoutState.childSpine = { page, y: source.bottom - 5 };
        }
        if (layoutState.childSpine?.page === page) {
          line(spineX, layoutState.childSpine.y, spineX, busY);
          line(spineX, busY, Math.max(...rowCards.map((card) => card.x)), busY);
          for (const card of rowCards) line(card.x, busY, card.x, card.top);
          layoutState.childSpine.y = busY;
        }
      }
      y -= rowHeight;
      index += row.length;
    }
    if (section.people.every((person) => positionRelationship(person.relationship)?.generation === 1)) {
      layoutState.parentGroups.push({ sectionIndex, people: section.people, cards: sectionCards });
    }
    if (section.label === "Household") layoutState.household = sectionCards;
    y -= 12 + (sectionIndex < sections.length - 1 ? sectionGap : 0);
  }
  return document.save();
}
