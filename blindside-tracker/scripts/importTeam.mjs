import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs-extra";
import path from "path";
import sharp from "sharp";

const [,, URL, TEAM, SEASON] = process.argv;

if (!URL || !TEAM || !SEASON) {
  console.error("❌ Usage: node scripts/importTeam.mjs <URL> <team_slug> <season>");
  process.exit(1);
}

const baseDir = `./public/images/${TEAM}/${SEASON}/main`;
const csvPath = `./data/raw/${TEAM}/${SEASON}.csv`;

await fs.ensureDir(baseDir);
await fs.ensureDir(path.dirname(csvPath));

console.log(`🚀 Importing: ${TEAM} ${SEASON}`);
console.log(`🌐 Fetching: ${URL}`);

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
  res = await axios.get(URL);
} catch {
  console.error("❌ Failed to fetch URL");
  process.exit(1);
}

const $ = cheerio.load(res.data);

let rows = ["CardNumber,PlayerName,Type,Rarity"];
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

  rows.push(`${cardNumFormatted},${name},${type},${rarity}`);

  const img = $(el).closest("article").find("img").attr("src");
  if (!img) return;

  const filePath = `${baseDir}/${cardNumFormatted}.png`;

  downloads.push((async () => {
    try {
      if (await fs.pathExists(filePath)) {
        console.log(`⏭️ Skipping ${cardNumFormatted}`);
        return;
      }

      console.log(`⬇️ ${cardNumFormatted} - ${name}`);

      const response = await axios({
        url: img,
        responseType: "arraybuffer"
      });

      await sharp(response.data)
        .png()
        .toFile(filePath);

    } catch {
      console.error(`❌ Failed ${cardNumFormatted}`);
    }
  })());
});

// Download all images
await Promise.all(downloads);

// Write CSV
await fs.writeFile(csvPath, rows.join("\n"));

console.log("✅ Done!");
console.log(`📁 Images → ${baseDir}`);
console.log(`📄 CSV → ${csvPath}`);