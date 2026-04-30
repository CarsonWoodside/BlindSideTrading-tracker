const RAW_SET_FILES = import.meta.glob('../../data/raw/**/*.csv', {
  eager: true,
  import: 'default',
  query: '?raw',
})

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function titleCaseWord(word) {
  if (!word) {
    return ''
  }

  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

function normalizeSeriesLabel(seriesToken) {
  if (!seriesToken) {
    return 'Main Set'
  }

  const normalized = seriesToken
    .replace(/^Series\s+/i, '')
    .trim()
    .toLowerCase()
  const numberMap = {
    one: '1',
    two: '2',
    three: '3',
    four: '4',
    five: '5',
  }
  const compact = numberMap[normalized] ?? normalized.replace(/\s+/g, '')

  return compact.startsWith('series') ? titleCaseWord(compact) : `Series ${compact}`
}

function buildSetSlug(seriesLabel) {
  if (seriesLabel === 'Main Set') {
    return 'main'
  }

  const compact = seriesLabel.toLowerCase().replace(/\s+/g, '')
  return compact
}

function parseFilename(filePath) {
  const filename = filePath.split('/').pop()?.replace(/\.csv$/i, '') ?? ''
  const match = filename.match(/^(.*)\s(\d{4}-\d{2})(?:\s(Series\s.+))?$/i)

  if (!match) {
    return {
      id: slugify(filename),
      teamName: filename,
      season: '',
      setName: 'Main Set',
      teamSlug: slugify(filename),
      setSlug: 'main',
    }
  }

  const [, teamName, season, seriesToken] = match
  const setName = normalizeSeriesLabel(seriesToken)
  const teamSlug = slugify(teamName)
  const setSlug = buildSetSlug(setName)

  return {
    id: `${teamSlug}__${season}__${setSlug}`,
    teamName,
    season,
    setName,
    teamSlug,
    setSlug,
  }
}

function parseCsv(text) {
  const rows = []
  let row = []
  let value = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const nextChar = text[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        value += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(value)
      value = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1
      }
      row.push(value)
      if (row.some((cell) => cell !== '')) {
        rows.push(row)
      }
      row = []
      value = ''
      continue
    }

    value += char
  }

  if (value !== '' || row.length > 0) {
    row.push(value)
    rows.push(row)
  }

  return rows
}

function normalizeHeader(header) {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function getImagePath(teamSlug, season, setSlug, cardNumber) {
  const imageFilename = cardNumber
    .replace(/\*/g, '-star')
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return `/images/${teamSlug}/${season}/${setSlug}/${encodeURIComponent(imageFilename)}.png`
}

function createCards(rows, meta) {
  const [headerRow, ...bodyRows] = rows
  const headers = headerRow.map(normalizeHeader)
  const duplicateCounts = new Map()

  return bodyRows.map((cells, index) => {
    const record = Object.fromEntries(
      headers.map((header, headerIndex) => [header, cells[headerIndex]?.trim() ?? '']),
    )
    const cardNumber = record.cardnumber || `UNKNOWN-${index + 1}`
    const occurrence = (duplicateCounts.get(cardNumber) ?? 0) + 1

    duplicateCounts.set(cardNumber, occurrence)

    const sortValue = Number.parseFloat(record.sorting || record.rarity?.split(' - ')[0] || '999')
    const rarityLabel = record.rarity || (record.sorting ? `Tier ${record.sorting}` : 'Unspecified')

    return {
      id: occurrence > 1 ? `${cardNumber}__${occurrence}` : cardNumber,
      cardNumber,
      playerName: record.playername || 'Unknown',
      type: record.type || 'Unknown',
      rarity: rarityLabel,
      rarityRank: Number.isFinite(sortValue) ? sortValue : 999,
      duplicateIndex: occurrence,
      imagePath: getImagePath(meta.teamSlug, meta.season, meta.setSlug, cardNumber),
    }
  })
}

function createSet([filePath, rawCsv]) {
  const meta = parseFilename(filePath)
  const rows = parseCsv(rawCsv)
  const cards = createCards(rows, meta)
  const types = [...new Set(cards.map((card) => card.type))].sort((left, right) =>
    left.localeCompare(right),
  )
  const rarities = [...new Set(cards.map((card) => card.rarity))].sort((left, right) => {
    const leftRank = cards.find((card) => card.rarity === left)?.rarityRank ?? 999
    const rightRank = cards.find((card) => card.rarity === right)?.rarityRank ?? 999
    return leftRank - rightRank || left.localeCompare(right)
  })

  return {
    ...meta,
    title: `${meta.teamName} ${meta.setName}`,
    cards,
    totalCards: cards.length,
    types,
    rarities,
    imageFolder: `images/${meta.teamSlug}/${meta.season}/${meta.setSlug}`,
  }
}

export const catalog = Object.entries(RAW_SET_FILES)
  .map(createSet)
  .sort((left, right) => {
    return (
      left.teamName.localeCompare(right.teamName) ||
      left.season.localeCompare(right.season) ||
      left.setSlug.localeCompare(right.setSlug)
    )
  })

export const teams = [...new Set(catalog.map((set) => set.teamName))]
