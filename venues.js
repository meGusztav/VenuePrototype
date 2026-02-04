// Shares inbox storage with your admin prototype (index.html/app.js)
const INBOX_KEY = "resProto:data:v1";
const VENUES_KEY = "resProto:venues:v1";

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function loadInbox() {
  const raw = localStorage.getItem(INBOX_KEY);
  if (!raw) return { inquiries: [] };
  try { return JSON.parse(raw); } catch { return { inquiries: [] }; }
}
function saveInbox(data) {
  localStorage.setItem(INBOX_KEY, JSON.stringify(data));
}

function loadVenues() {
  const raw = localStorage.getItem(VENUES_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}
function saveVenues(v) {
  localStorage.setItem(VENUES_KEY, JSON.stringify(v));
}

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// --- Demo venue data (edit freely)
function demoVenues() {
  return [
    {
      id: "v1",
      name: "Garden Terrace Makati",
      area: "Makati",
      lat: 14.5547,
      lon: 121.0244,
      paxMin: 40,
      paxMax: 120,
      priceFrom: 45000,
      priceTo: 120000,
      rating: 4.6,
      reviewCount: 132,
      eventTypes: ["Wedding", "Debut", "Birthday", "Corporate"],
      amenities: ["Parking", "Catering", "Outdoor", "Aircon", "Stage", "Photo spots"],
      unavailableDates: ["2026-02-14", "2026-03-07", "2026-03-21"]
    },
    {
      id: "v2",
      name: "BGC Loft Hall",
      area: "BGC",
      lat: 14.5509,
      lon: 121.0509,
      paxMin: 60,
      paxMax: 180,
      priceFrom: 65000,
      priceTo: 180000,
      rating: 4.4,
      reviewCount: 88,
      eventTypes: ["Wedding", "Corporate", "Birthday"],
      amenities: ["Parking", "Aircon", "Stage", "AV system", "Security"],
      unavailableDates: ["2026-02-22", "2026-03-01"]
    },
    {
      id: "v3",
      name: "QC Events Pavilion",
      area: "Quezon City",
      lat: 14.6760,
      lon: 121.0437,
      paxMin: 80,
      paxMax: 300,
      priceFrom: 80000,
      priceTo: 250000,
      rating: 4.2,
      reviewCount: 215,
      eventTypes: ["Debut", "Wedding", "Corporate"],
      amenities: ["Parking", "Catering", "Aircon", "Stage", "Bridal room", "LED wall"],
      unavailableDates: ["2026-03-15"]
    },
    {
      id: "v4",
      name: "Alabang Boutique Venue",
      area: "Alabang",
      lat: 14.4186,
      lon: 121.0410,
      paxMin: 30,
      paxMax: 90,
      priceFrom: 35000,
      priceTo: 95000,
      rating: 4.7,
      reviewCount: 54,
      eventTypes: ["Wedding", "Birthday", "Other"],
      amenities: ["Outdoor", "Photo spots", "Catering", "Parking"],
      unavailableDates: ["2026-02-10", "2026-02-11", "2026-02-12"]
    },
    {
      id: "v5",
      name: "Pasay Bayview Ballroom",
      area: "Pasay",
      lat: 14.5378,
      lon: 120.9907,
      paxMin: 100,
      paxMax: 500,
      priceFrom: 120000,
      priceTo: 400000,
      rating: 4.1,
      reviewCount: 401,
      eventTypes: ["Corporate", "Wedding", "Debut"],
      amenities: ["Parking", "Aircon", "Stage", "AV system", "Catering", "Accessibility"],
      unavailableDates: ["2026-04-05"]
    }
  ];
}

// --- UI hooks
const el = (id) => document.getElementById(id);
const resultsList = el("resultsList");
const resultMeta = el("resultMeta");
const geoStatus = el("geoStatus");

const amenityUniverse = [
  "Parking","Catering","Outdoor","Aircon","Stage","AV system","LED wall","Security","Accessibility","Photo spots","Bridal room"
];

let venues = loadVenues();
let userLoc = null; // {lat, lon}

const amenityState = new Set();

// Build amenity chips
function renderAmenityChips() {
  const wrap = el("amenitiesWrap");
  wrap.innerHTML = "";
  amenityUniverse.forEach(a => {
    const c = document.createElement("div");
    c.className = "chip";
    c.textContent = a;
    c.addEventListener("click", () => {
      if (amenityState.has(a)) amenityState.delete(a);
      else amenityState.add(a);
      c.classList.toggle("active");
      apply();
    });
    wrap.appendChild(c);
  });
}

// Distance helpers
function toRad(deg){ return deg * Math.PI / 180; }
function kmBetween(a, b){
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Availability check (demo): return true if none of the venue's unavailableDates fall inside requested range
function isAvailable(venue, start, end){
  if (!start || !end) return true;
  const s = new Date(start);
  const e = new Date(end);
  if (e < s) return false;

  return !(venue.unavailableDates || []).some(d => {
    const x = new Date(d);
    return x >= s && x <= e;
  });
}

function num(v){ return Number(v || 0); }
function val(id){ return (el(id).value || "").trim(); }

function apply() {
  venues = loadVenues();

  const qLoc = val("qLocation").toLowerCase();
  const paxMin = num(val("paxMin"));
  const paxMax = num(val("paxMax"));
  const priceMin = num(val("priceMin"));
  const priceMax = num(val("priceMax"));
  const ratingMin = num(val("ratingMin"));
  const reviewsMin = num(val("reviewsMin"));
  const eventType = val("eventType");
  const sortBy = val("sortBy");
  const maxKm = num(val("maxKm"));
  const dateStart = val("dateStart");
  const dateEnd = val("dateEnd");

  let rows = venues.map(v => {
    const distKm = userLoc ? kmBetween(userLoc, {lat:v.lat, lon:v.lon}) : null;
    return { ...v, distKm };
  });

  // Filters
  if (qLoc) rows = rows.filter(v => (v.area || "").toLowerCase().includes(qLoc) || (v.name || "").toLowerCase().includes(qLoc));

  if (paxMin) rows = rows.filter(v => v.paxMax >= paxMin);
  if (paxMax) rows = rows.filter(v => v.paxMin <= paxMax);

  if (priceMin) rows = rows.filter(v => v.priceTo >= priceMin);
  if (priceMax) rows = rows.filter(v => v.priceFrom <= priceMax);

  if (ratingMin) rows = rows.filter(v => v.rating >= ratingMin);
  if (reviewsMin) rows = rows.filter(v => v.reviewCount >= reviewsMin);

  if (eventType) rows = rows.filter(v => (v.eventTypes || []).includes(eventType));

  if (amenityState.size) {
    rows = rows.filter(v => {
      const set = new Set(v.amenities || []);
      for (const a of amenityState) if (!set.has(a)) return false;
      return true;
    });
  }

  if (dateStart || dateEnd) rows = rows.filter(v => isAvailable(v, dateStart, dateEnd));

  if (maxKm && userLoc) rows = rows.filter(v => v.distKm !== null && v.distKm <= maxKm);

  // Sorting
  if (sortBy === "distance") {
    rows.sort((a,b) => (a.distKm ?? 1e9) - (b.distKm ?? 1e9));
  } else if (sortBy === "rating") {
    rows.sort((a,b) => (b.rating - a.rating) || (b.reviewCount - a.reviewCount));
  } else if (sortBy === "price_low") {
    rows.sort((a,b) => a.priceFrom - b.priceFrom);
  } else if (sortBy === "price_high") {
    rows.sort((a,b) => b.priceTo - a.priceTo);
  } else {
    // Best match: simple scoring
    rows.sort((a,b) => score(b) - score(a));
  }

  render(rows);

  function score(v){
    let s = 0;
    s += v.rating * 20;
    s += Math.min(v.reviewCount, 300) * 0.05;
    if (userLoc && v.distKm != null) s += Math.max(0, 30 - v.distKm); // closer => higher
    if (amenityState.size) s += 10;
    if (dateStart || dateEnd) s += isAvailable(v, dateStart, dateEnd) ? 8 : -100;
    return s;
  }
}

function render(rows) {
  resultMeta.textContent = `${rows.length} venue(s)`;

  resultsList.innerHTML = "";
  if (!rows.length) {
    resultsList.innerHTML = `<div class="item"><div class="muted">No matches. Try loosening filters.</div></div>`;
    return;
  }

  rows.forEach(v => {
    const item = document.createElement("div");
    item.className = "item";

    const dist = (userLoc && v.distKm != null)
      ? `<span class="pill good">${v.distKm.toFixed(1)} km away</span>`
      : `<span class="pill">Distance: set location</span>`;

    const price = `<span class="pill">${formatMoney(v.priceFrom)}–${formatMoney(v.priceTo)}</span>`;
    const rate = `<span class="pill good">★ ${v.rating.toFixed(1)} (${v.reviewCount})</span>`;
    const cap = `<span class="pill">${v.paxMin}–${v.paxMax} pax</span>`;

    item.innerHTML = `
      <div class="item-top">
        <div>
          <div class="name">${escapeHtml(v.name)}</div>
          <div class="muted small">${escapeHtml(v.area)}</div>
          <div class="meta">${dist}${cap}${rate}${price}</div>
          <div class="muted small" style="margin-top:8px">
            Events: ${escapeHtml((v.eventTypes || []).join(", "))}
          </div>
          <div class="muted small">
            Amenities: ${escapeHtml((v.amenities || []).slice(0,6).join(", "))}${(v.amenities || []).length>6 ? "…" : ""}
          </div>
        </div>
        <div><span class="pill">View</span></div>
      </div>
    `;

    item.addEventListener("click", () => openModal(v));
    resultsList.appendChild(item);
  });
}

function formatMoney(n){
  return "₱" + Number(n || 0).toLocaleString();
}

// --- Modal & Inquiry writing to inbox
const modalBackdrop = el("modalBackdrop");
const mClose = el("mClose");
mClose.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeModal();
});

let activeVenue = null;

function openModal(v){
  activeVenue = v;

  el("mTitle").textContent = v.name;
  el("mSubtitle").textContent = `${v.area}${(userLoc && v.distKm != null) ? ` • ${v.distKm.toFixed(1)} km away` : ""}`;

  el("mPax").textContent = `${v.paxMin}–${v.paxMax} pax`;
  el("mPrice").textContent = `${formatMoney(v.priceFrom)}–${formatMoney(v.priceTo)}`;
  el("mRating").textContent = `★ ${v.rating.toFixed(1)} (${v.reviewCount} reviews)`;
  el("mArea").textContent = v.area;
  el("mEvents").textContent = (v.eventTypes || []).join(", ");
  el("mAmen").textContent = (v.amenities || []).join(", ");

  modalBackdrop.classList.remove("hidden");
  modalBackdrop.setAttribute("aria-hidden","false");
}

function closeModal(){
  activeVenue = null;
  modalBackdrop.classList.add("hidden");
  modalBackdrop.setAttribute("aria-hidden","true");
}

el("goAdmin").addEventListener("click", () => {
  window.location.href = "index.html";
});

el("inqForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!activeVenue) return;

  const fd = new FormData(e.target);

  const startDate = fd.get("startDate");
  const endDate = fd.get("endDate");
  if (new Date(endDate) < new Date(startDate)) {
    alert("End date must be on/after start date.");
    return;
  }

  // Optional: warn if not available (demo)
  const ok = isAvailable(activeVenue, startDate, endDate);
  if (!ok) {
    if (!confirm("This venue is marked unavailable for some dates in that range (demo data). Send inquiry anyway?")) {
      return;
    }
  }

  const inbox = loadInbox();
  inbox.inquiries = inbox.inquiries || [];

  inbox.inquiries.unshift({
    id: uid(),
    createdAt: new Date().toISOString(),
    status: "inquiry",
    venueId: activeVenue.id,
    venueName: activeVenue.name,
    venueArea: activeVenue.area,
    eventType: "Other",
    pax: Number(fd.get("pax")),
    startDate,
    endDate,
    clientName: fd.get("clientName"),
    contactMethod: fd.get("contactMethod"),
    contactDetails: fd.get("contactDetails"),
    notes: `[Customer Venue Finder] Venue: ${activeVenue.name} (${activeVenue.area})\n${fd.get("notes") || ""}`,
    proposedDates: [],
    hold: null,
    payment: { status: "unpaid", amount: 0, notes: "" }
  });

  saveInbox(inbox);

  e.target.reset();
  alert("Inquiry sent! Open Admin Dashboard to view it.");
  closeModal();
});

// --- Geolocation
el("geoBtn").addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Geolocation not supported in this browser.");
    return;
  }
  geoStatus.textContent = "Location: requesting…";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLoc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      geoStatus.textContent = `Location: set`;
      apply();
    },
    () => {
      geoStatus.textContent = "Location: denied";
      alert("Location permission denied. Distance sorting/filter won't work.");
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
});

// --- Filters wiring
[
  "qLocation","paxMin","paxMax","priceMin","priceMax","ratingMin","reviewsMin",
  "eventType","dateStart","dateEnd","sortBy","maxKm"
].forEach(id => el(id).addEventListener("input", apply));

el("clearBtn").addEventListener("click", () => {
  ["qLocation","paxMin","paxMax","priceMin","priceMax","reviewsMin","maxKm","dateStart","dateEnd"].forEach(id => el(id).value = "");
  el("ratingMin").value = "0";
  el("eventType").value = "";
  el("sortBy").value = "best";
  amenityState.clear();
  // clear chip UI
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
  apply();
});

el("seedBtn").addEventListener("click", () => {
  saveVenues(demoVenues());
  venues = loadVenues();
  alert("Demo venues loaded.");
  apply();
});

// Init
renderAmenityChips();
if (venues.length === 0) {
  // start empty, encourage demo
  resultMeta.textContent = "0 venue(s) — load demo venues";
  resultsList.innerHTML = `<div class="item"><div class="muted">No venues yet. Click “Load demo venues”.</div></div>`;
} else {
  apply();
}
