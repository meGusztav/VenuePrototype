// geocode_venues.mjs
// Fills lat/lon in a CSV using OpenStreetMap Nominatim.
// Output: venues_seed_50_geocoded.csv
//
// Usage:
//   node geocode_venues.mjs venues_seed_50_input.csv
//
// Notes:
// - Nominatim is rate-limited. This script respects it.
// - Rooms/halls often aren't in OSM; we geocode the parent venue (hotel/center).
// - Produces geocode_report.json for NOT FOUND / ERROR cases.

import fs from "node:fs/promises";

const INPUT = process.argv[2];
if (!INPUT) {
  console.error("Usage: node geocode_venues.mjs venues_seed_50_input.csv");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** ---------- CSV parsing/writing ---------- **/
function parseCSV(text) {
  const rows = [];
  let i = 0, field = "", row = [], inQuotes = false;

  while (i < text.length) {
    const c = text[i];

    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (!inQuotes && (c === "," || c === "\n" || c === "\r")) {
      if (c === ",") {
        row.push(field);
        field = "";
        i++;
        continue;
      }
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some(x => x.length > 0)) rows.push(row);
      row = [];
      i++;
      continue;
    }

    field += c;
    i++;
  }

  if (field.length || row.length) {
    row.push(field);
    if (row.some(x => x.length > 0)) rows.push(row);
  }
  return rows;
}

function toCSV(rows) {
  return rows
    .map(r => r.map(v => {
      const s = (v ?? "").toString();
      if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"','""')}"`;
      return s;
    }).join(","))
    .join("\n") + "\n";
}

/** ---------- Text normalization ---------- **/
function cleanText(s) {
  return (s ?? "")
    .toString()
    .replace(/\s*\([^)]*\)\s*/g, " ")     // remove parentheses content
    .replace(/\s+/g, " ")
    .trim();
}

function deDupParts(parts) {
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const t = cleanText(p);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

// Aggressive "room/hall" stripping so we geocode the parent venue
function parentName(name) {
  let n = cleanText(name);

  // split on common separators used to append room names
  for (const sep of [" - ", " – ", " — ", " | ", ": "]) {
    if (n.includes(sep)) n = n.split(sep)[0].trim();
  }

  // remove trailing room-ish keywords if they remain
  n = n.replace(
    /\b(grand\s+ballroom|ballroom|function\s+room(s)?|function\s+hall(s)?|events?\s+space(s)?|banquet\s+hall(s)?|hall(s)?|plenary\s+hall|main\s+theater|main\s+theatre|theater|theatre|arena|tent|pavilion|convention\s+center|convention\s+centre)\b.*$/i,
    ""
  ).trim();

  // If stripping became too aggressive (empty), fallback to cleaned original split only
  if (!n) {
    n = cleanText(name);
    for (const sep of [" - ", " – ", " — ", " | ", ": "]) {
      if (n.includes(sep)) n = n.split(sep)[0].trim();
    }
  }

  return n || cleanText(name);
}

function makeQuery(name, area, address) {
  const parts = deDupParts([
    name,
    address,
    area,
    "Metro Manila",
    "Philippines"
  ]);

  return parts.join(", ");
}

/** ---------- Nominatim geocode with retry/backoff ---------- **/
async function geocode(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);

  const maxTries = 5;
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "VenuePrototype/1.0 (Gusztav; contact: gusztavfrancia97@gmail.com)",
        "Referer": "https://megusztav.github.io/"
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (!data?.length) return null;
      return {
        lat: data[0].lat,
        lon: data[0].lon,
        display: data[0].display_name
      };
    }

    // Handle rate limiting / blocking / transient errors
    if ([403, 429, 500, 502, 503].includes(res.status)) {
      const waitMs = 2500 * attempt; // 2.5s, 5s, 7.5s, 10s, 12.5s
      console.warn(`⚠️ HTTP ${res.status} on attempt ${attempt}/${maxTries}. Waiting ${waitMs}ms...`);
      await sleep(waitMs);
      continue;
    }

    // Other errors => fail fast
    throw new Error(`HTTP ${res.status} for ${query}`);
  }

  // If we exhausted retries
  throw new Error(`HTTP 4xx/5xx after retries for ${query}`);
}

/** ---------- Main ---------- **/
(async () => {
  const raw = await fs.readFile(INPUT, "utf8");
  const rows = parseCSV(raw);

  if (rows.length < 2) throw new Error("CSV looks empty.");

  const header = rows[0].map(h => h.trim());
  const idx = (col) => header.indexOf(col);

  const nameI = idx("name");
  const areaI = idx("area");
  const addrI = idx("address");
  const latI  = idx("lat");
  const lonI  = idx("lon");

  if ([nameI, areaI, addrI, latI, lonI].some(i => i < 0)) {
    throw new Error("CSV must include columns: name, area, address, lat, lon");
  }

  const out = [header];
  const report = [];
  const total = rows.length - 1;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const name = cleanText(row[nameI]);
    const area = cleanText(row[areaI]);
    const address = cleanText(row[addrI]);

    // Keep existing lat/lon if already present
    const existingLat = cleanText(row[latI]);
    const existingLon = cleanText(row[lonI]);

    if (existingLat && existingLon) {
      out.push(row);
      report.push({ name, status: "kept" });
      continue;
    }

    // Progress
    console.log(`Geocoding ${r}/${total}: ${name}`);

    // Strategy:
    // 1) Full name + address + area
    // 2) Parent venue name + address + area
    // 3) Parent venue name + area only
    const fullQ = makeQuery(name, area, address);
    const pName = parentName(name);
    const parentQ = makeQuery(pName, area, address);
    const parentAreaQ = makeQuery(pName, area, "");

    try {
      let g = await geocode(fullQ);
      let used = "full";

      if (!g) {
        g = await geocode(parentQ);
        used = "parent";
      }
      if (!g) {
        g = await geocode(parentAreaQ);
        used = "parent+area";
      }

      if (!g) {
        row[latI] = "";
        row[lonI] = "";
        out.push(row);
        report.push({
          name,
          status: "NOT FOUND",
          queries: { fullQ, parentQ, parentAreaQ }
        });
      } else {
        row[latI] = g.lat;
        row[lonI] = g.lon;
        out.push(row);
        report.push({
          name,
          status: "ok",
          used,
          query: used === "full" ? fullQ : (used === "parent" ? parentQ : parentAreaQ),
          match: g.display
        });
      }
    } catch (e) {
      row[latI] = "";
      row[lonI] = "";
      out.push(row);
      report.push({
        name,
        status: "ERROR",
        queries: { fullQ, parentQ, parentAreaQ },
        err: e.message
      });
    }

    // Respect Nominatim rate limit (slightly slower than 1/sec to avoid bans)
    await sleep(1500);
  }

  const outPath = "venues_seed_50_geocoded.csv";
  await fs.writeFile(outPath, toCSV(out), "utf8");

  const notFound = report.filter(x => x.status === "NOT FOUND" || x.status === "ERROR");
  await fs.writeFile("geocode_report.json", JSON.stringify({ total: report.length, notFound }, null, 2), "utf8");

  console.log(`✅ Wrote ${outPath}`);
  console.log(`📝 Report: geocode_report.json (check NOT FOUND/ERROR rows)`);
})();
