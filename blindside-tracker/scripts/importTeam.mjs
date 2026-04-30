import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs-extra";
import path from "path";
import sharp from "sharp";

const [,, SOURCE_URL, TEAM, SEASON] = process.argv;

if (!SOURCE_URL || !TEAM || !SEASON) {
  console.error("Usage: node scripts/importTeam.mjs <URL> <team_slug> <season>");
  process.exit(1);
}

const SERIES_NUMBER_WORDS = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5"
};

function toTitleCase(value) {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function getChecklistSlug(url) {
  try {
    const { pathname } = new URL(url);
    return pathname.split("/").filter(Boolean).at(-1) || "";
  } catch {
    return "";
  }
}

function getSetMeta(url) {
  const slug = getChecklistSlug(url);
  const seriesMatch = slug.match(/series-([a-z]+)/i);

  if (!seriesMatch) {
    return {
      fileLabel: "",
      imageSlug: "main"
    };
  }

  const seriesWord = seriesMatch[1].toLowerCase();
  const seriesNumber = SERIES_NUMBER_WORDS[seriesWord] || seriesWord;
  const seriesLabel = `Series ${toTitleCase(seriesWord)}`;

  return {
    fileLabel: ` ${seriesLabel}`,
    imageSlug: `series${seriesNumber}`
  };
}

function getImageFilename(cardNumber) {
  return cardNumber
    .replace(/\*/g, "-star")
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const teamName = toTitleCase(TEAM);
const setMeta = getSetMeta(SOURCE_URL);
const csvFilename = `${teamName} ${SEASON}${setMeta.fileLabel}.csv`;
const baseDir = path.join(".", "public", "images", TEAM, SEASON, setMeta.imageSlug);
const csvPath = path.join(".", "data", "raw", TEAM, SEASON, csvFilename);

await fs.ensureDir(baseDir);
await fs.ensureDir(path.dirname(csvPath));

console.log(`Importing: ${TEAM} ${SEASON}`);
console.log(`Fetching: ${SOURCE_URL}`);

// Card type + rarity mapping
const CARD_MAP = {
  B: { type: "Base", rarity: "1 - Common" },
  AB: { type: "Alt Base", rarity: "1 - Common" },
  AS: { type: "All Star", rarity: "3 - Rare" },
  CC: { type: "Canvas", rarity: "2 - Uncommon" },
  CL: { type: "Checklist", rarity: "1 - Common" },
  DD: { type: "Dynamic Duos", rarity: "4 - Ultra Rare" },
  EA: { type: "Exclusive Autos", rarity: "4 - Ultra Rare" },
  EH: { type: "Exceptional Hits", rarity: "4 - Ultra Rare" },
  FF: { type: "Fan Faves", rarity: "2 - Uncommon" },
  HS: { type: "Hot Shots", rarity: "2 - Uncommon" },
  LD: { type: "Leadership", rarity: "4 - Ultra Rare" },
  OW: { type: "Ones To Watch", rarity: "3 - Rare" },
  PM: { type: "Playmaker", rarity: "2 - Uncommon" },
  PS: { type: "Poster", rarity: "2 - Uncommon" },
  PT: { type: "Portrait", rarity: "2 - Uncommon" },
  SH: { type: "Sharpshooter", rarity: "2 - Uncommon" },
  SP: { type: "Spectrum", rarity: "4 - Ultra Rare" },
  SS: { type: "Signature Series", rarity: "3 - Rare" },
  IB: { type: "Ice Breakers", rarity: "3 - Rare" },
  MS: { type: "Milestones", rarity: "3 - Rare" },
  BM: { type: "Blindside Moments", rarity: "3 - Rare" },
  OH: { type: "Off-Ice Heroes", rarity: "2 - Uncommon" },
  RB: { type: "Record Breakers", rarity: "3 - Rare" },
  "16": { type: "16-Bit", rarity: "2 - Uncommon" }
};

// Get type + rarity
function getCardMeta(cardNumClean) {
  const match = cardNumClean.match(/^[A-Z]+|^\d+/);

  if (!match) return { type: "Unknown", rarity: "Unknown" };

  const prefix = match[0];

  if (/^\d+$/.test(cardNumClean)) {
    return { type: "Base", rarity: "1 - Common" };
  }

  return CARD_MAP[prefix] || { type: "Unknown", rarity: "Unknown" };
}

// Fetch page
let res;
try {
  res = await axios.get(SOURCE_URL);
} catch {
  console.error("Failed to fetch URL");
  process.exit(1);
}

const $ = cheerio.load(res.data);

const rows = ["CardNumber,PlayerName,Type,Rarity"];
const cards = [];
const downloads = [];

$("h2.wpr-grid-item-title a").each((i, el) => {
  let text = $(el).text().trim();

  // Clean formatting
  text = text.replace(/\s*-\s*$/, "");
  text = text.replace(/–/g, "-");

  let rawCode, name;

  const firstSpace = text.indexOf(" ");

  if (firstSpace !== -1) {
    rawCode = text.substring(0, firstSpace).trim();
    name = text.substring(firstSpace + 1).trim();
  } else {
    rawCode = text.trim();
    name = "Unknown";
  }

  // Clean version for logic
  let cardNumClean = rawCode.replace("-", "");

  // Format version for output (B1 → B-1)
  let cardNumFormatted = rawCode.includes("-")
    ? rawCode
    : cardNumClean.replace(/^([A-Z]+|\d+)(\d+)$/, "$1-$2");

  // Handle no-number cards (EA, CL)
  if (!/\d/.test(cardNumFormatted)) {
    cardNumFormatted = cardNumClean;
  }

  // Special case
  if (cardNumClean === "CL") {
    name = "Checklist";
  }

  // Clean name spacing
  name = name.replace(/\s+/g, " ").trim();

  const { type, rarity } = getCardMeta(cardNumClean);
  const img = $(el).closest("article").find("img").attr("src");

  cards.push({
    cardNumFormatted,
    name,
    type,
    rarity,
    img
  });
});

const cardCounts = new Map();
for (const card of cards) {
  cardCounts.set(card.cardNumFormatted, (cardCounts.get(card.cardNumFormatted) || 0) + 1);
}

const cardOccurrences = new Map();
for (const card of cards) {
  const hasNumber = /\d/.test(card.cardNumFormatted);
  const count = cardCounts.get(card.cardNumFormatted) || 0;
  const occurrence = (cardOccurrences.get(card.cardNumFormatted) || 0) + 1;

  cardOccurrences.set(card.cardNumFormatted, occurrence);

  const cardNumFormatted = !hasNumber && count > 1
    ? `${card.cardNumFormatted}-${occurrence}`
    : card.cardNumFormatted;
  const { name, type, rarity, img } = card;

  rows.push(`${cardNumFormatted},${name},${type},${rarity}`);

  if (!img) continue;

  const filePath = path.join(baseDir, `${getImageFilename(cardNumFormatted)}.png`);

  downloads.push((async () => {
    try {
      if (await fs.pathExists(filePath)) {
        console.log(`Skipping ${cardNumFormatted}`);
        return;
      }

      console.log(`${cardNumFormatted} - ${name}`);

      const response = await axios({
        url: img,
        responseType: "arraybuffer"
      });

      await sharp(response.data)
        .png()
        .toFile(filePath);

    } catch {
      console.error(`Failed ${cardNumFormatted}`);
    }
  })());
}

// Download all images
await Promise.all(downloads);

// Write CSV
await fs.writeFile(csvPath, rows.join("\n"));

console.log("Done!");
console.log(`Images → ${baseDir}`);
console.log(`CSV → ${csvPath}`);
