// ---------- Storage ----------
const STORAGE_KEY = "resProto:data:v1";
const SETTINGS_KEY = "resProto:settings:v1";

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { inquiries: [] };
  try { return JSON.parse(raw); } catch { return { inquiries: [] }; }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  const defaults = { venueName: "Venue", holdDays: 3, currency: "PHP" };
  if (!raw) return defaults;
  try { return { ...defaults, ...JSON.parse(raw) }; } catch { return defaults; }
}

function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ---------- State ----------
let data = loadData();
let settings = loadSettings();
let selectedId = null;

let calCursor = new Date();
calCursor.setDate(1);

// ---------- Tabs / Views ----------
const tabs = document.querySelectorAll(".tab");
const views = {
  public: document.getElementById("view-public"),
  admin: document.getElementById("view-admin"),
  settings: document.getElementById("view-settings")
};

tabs.forEach(btn => {
  btn.addEventListener("click", () => {
    tabs.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const v = btn.dataset.view;

    Object.values(views).forEach(el => el.classList.remove("active"));
    document.getElementById(`view-${v}`).classList.add("active");

    tabs.forEach(b => b.setAttribute("aria-selected", b === btn ? "true" : "false"));

    if (v === "admin") {
      renderInbox();
      renderDetail();
      renderCalendar();
    }
    if (v === "settings") {
      hydrateSettingsForm();
    }
  });
});

// ---------- Public Inquiry Form ----------
const inquiryForm = document.getElementById("inquiryForm");
inquiryForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(inquiryForm);

  const startDate = fd.get("startDate");
  const endDate = fd.get("endDate");
  if (new Date(endDate) < new Date(startDate)) {
    alert("End date must be on/after start date.");
    return;
  }

  const inquiry = {
    id: uid(),
    createdAt: new Date().toISOString(),
    status: "inquiry", // inquiry | pencil | confirmed | cancelled
    eventType: fd.get("eventType"),
    pax: Number(fd.get("pax")),
    startDate,
    endDate,
    clientName: fd.get("clientName"),
    contactMethod: fd.get("contactMethod"),
    contactDetails: fd.get("contactDetails"),
    notes: fd.get("notes") || "",
    proposedDates: [],
    hold: null, // { expiresAt, createdAt }
    payment: { status: "unpaid", amount: 0, notes: "" } // unpaid | deposit | partial | paid
  };

  data.inquiries.unshift(inquiry);
  saveData(data);

  inquiryForm.reset();
  alert("Inquiry submitted! (Check Admin Dashboard → Inbox)");
});

// Demo seed
document.getElementById("seedDemo").addEventListener("click", () => {
  if (data.inquiries.length > 0 && !confirm("This will add demo inquiries. Continue?")) return;

  const today = new Date();
  const plusDays = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0,10);
  };

  data.inquiries = [
    {
      id: uid(),
      createdAt: new Date().toISOString(),
      status: "inquiry",
      eventType: "Wedding",
      pax: 80,
      startDate: plusDays(14),
      endDate: plusDays(21),
      clientName: "Alyssa R.",
      contactMethod: "Email",
      contactDetails: "alyssa@email.com",
      notes: "Wants garden-ish vibe, ask about corkage.",
      proposedDates: [plusDays(16), plusDays(18)],
      hold: null,
      payment: { status: "unpaid", amount: 0, notes: "" }
    },
    {
      id: uid(),
      createdAt: new Date().toISOString(),
      status: "pencil",
      eventType: "Debut",
      pax: 60,
      startDate: plusDays(5),
      endDate: plusDays(7),
      clientName: "Marco S.",
      contactMethod: "Messenger",
      contactDetails: "m.me/marco",
      notes: "Wants package A + photo booth.",
      proposedDates: [plusDays(6)],
      hold: { createdAt: new Date().toISOString(), expiresAt: plusDays(settings.holdDays) },
      payment: { status: "deposit", amount: 15000, notes: "Deposit received via GCash" }
    },
    {
      id: uid(),
      createdAt: new Date().toISOString(),
      status: "confirmed",
      eventType: "Corporate",
      pax: 100,
      startDate: plusDays(28),
      endDate: plusDays(28),
      clientName: "Nova Corp",
      contactMethod: "Email",
      contactDetails: "events@novacorp.com",
      notes: "Need projector + mic x2.",
      proposedDates: [plusDays(28)],
      hold: null,
      payment: { status: "paid", amount: 65000, notes: "Paid in full" }
    }
  ].concat(data.inquiries);

  saveData(data);
  alert("Demo data loaded. Open Admin Dashboard.");
});

// ---------- Admin Inbox ----------
const inboxList = document.getElementById("inboxList");
const searchInput = document.getElementById("search");
const filterStatus = document.getElementById("filterStatus");

searchInput.addEventListener("input", () => renderInbox());
filterStatus.addEventListener("change", () => renderInbox());

function badgeClass(status){
  return `badge ${status}`;
}

function statusLabel(status){
  if (status === "inquiry") return "Inquiry";
  if (status === "pencil") return "Pencil Hold";
  if (status === "confirmed") return "Confirmed";
  if (status === "cancelled") return "Cancelled";
  return status;
}

function renderInbox() {
  data = loadData();
  const q = (searchInput.value || "").toLowerCase().trim();
  const f = filterStatus.value;

  const items = data.inquiries
    .filter(i => f === "all" ? true : i.status === f)
    .filter(i => {
      if (!q) return true;
      const blob = `${i.clientName} ${i.contactDetails} ${i.notes} ${i.eventType}`.toLowerCase();
      return blob.includes(q);
    });

  inboxList.innerHTML = "";

  if (items.length === 0) {
    inboxList.innerHTML = `<div class="empty"><div class="muted">No results.</div></div>`;
    return;
  }

  items.forEach(i => {
    const el = document.createElement("div");
    el.className = `item ${i.id === selectedId ? "active" : ""}`;
    el.innerHTML = `
      <div class="item-top">
        <div>
          <div style="font-weight:700">${escapeHtml(i.clientName)}</div>
          <div class="muted small">${escapeHtml(i.eventType)} • ${i.pax} pax</div>
        </div>
        <div class="${badgeClass(i.status)}">${statusLabel(i.status)}</div>
      </div>
      <div class="muted small" style="margin-top:6px">
        Range: ${i.startDate} → ${i.endDate}
      </div>
    `;
    el.addEventListener("click", () => {
      selectedId = i.id;
      renderInbox();
      renderDetail();
    });
    inboxList.appendChild(el);
  });
}

// ---------- Detail Pane ----------
const detailPane = document.getElementById("detailPane");

function renderDetail() {
  data = loadData();
  const inquiry = data.inquiries.find(x => x.id === selectedId);

  if (!inquiry) {
    detailPane.className = "empty";
    detailPane.innerHTML = `<div class="muted">No inquiry selected.</div>`;
    return;
  }

  detailPane.className = "detail";

  const holdInfo = inquiry.hold
    ? `Hold expires: <b>${inquiry.hold.expiresAt}</b>`
    : `No active hold`;

  detailPane.innerHTML = `
    <div class="kv"><div class="k">Client</div><div class="v">${escapeHtml(inquiry.clientName)}</div></div>
    <div class="kv"><div class="k">Contact</div><div class="v">${escapeHtml(inquiry.contactMethod)} • ${escapeHtml(inquiry.contactDetails)}</div></div>
    <div class="kv"><div class="k">Event</div><div class="v">${escapeHtml(inquiry.eventType)} • ${inquiry.pax} pax</div></div>
    <div class="kv"><div class="k">Range</div><div class="v">${inquiry.startDate} → ${inquiry.endDate}</div></div>
    <div class="kv"><div class="k">Notes</div><div class="v">${escapeHtml(inquiry.notes || "—")}</div></div>

    <div class="divider"></div>

    <div class="kv"><div class="k">Status</div><div class="v"><span class="pill">${statusLabel(inquiry.status)}</span></div></div>
    <div class="kv"><div class="k">Pencil hold</div><div class="v">${holdInfo}</div></div>
    <div class="kv"><div class="k">Payment</div><div class="v">
      <span class="pill">${escapeHtml(inquiry.payment.status)}</span>
      <span class="pill">${settings.currency} ${Number(inquiry.payment.amount || 0).toLocaleString()}</span>
    </div></div>

    <div class="divider"></div>

    <h3>Propose dates</h3>
    <div class="inline">
      <input id="proposedDateInput" type="date" />
      <button class="btn" id="addProposedDate">Add</button>
    </div>
    <div id="proposedDates" class="muted small" style="margin-top:8px"></div>

    <div class="divider"></div>

    <h3>Actions</h3>
    <div class="detail-actions">
      <button class="btn primary" id="makeHold">Create pencil hold (${settings.holdDays} days)</button>
      <button class="btn" id="markConfirmed">Mark confirmed</button>
      <button class="btn" id="markCancelled">Cancel</button>
    </div>

    <div class="divider"></div>

    <h3>Payment update</h3>
    <div class="row two">
      <label>Payment status
        <select id="payStatus">
          <option value="unpaid">unpaid</option>
          <option value="deposit">deposit</option>
          <option value="partial">partial</option>
          <option value="paid">paid</option>
        </select>
      </label>
      <label>Amount
        <input id="payAmount" type="number" min="0" step="1" />
      </label>
    </div>
    <div class="row">
      <label>Payment notes
        <input id="payNotes" placeholder="e.g., Deposit via GCash" />
      </label>
    </div>
    <div class="row actions">
      <button class="btn" id="savePayment">Save payment</button>
    </div>
  `;

  // hydrate proposed dates
  const proposedWrap = document.getElementById("proposedDates");
  proposedWrap.innerHTML = (inquiry.proposedDates?.length ? inquiry.proposedDates : ["—"])
    .map(d => `<span class="pill">${escapeHtml(d)}</span>`).join(" ");

  document.getElementById("addProposedDate").addEventListener("click", () => {
    const input = document.getElementById("proposedDateInput");
    if (!input.value) return;
    inquiry.proposedDates = inquiry.proposedDates || [];
    inquiry.proposedDates.push(input.value);
    input.value = "";
    persistInquiry(inquiry);
  });

  // actions
  document.getElementById("makeHold").addEventListener("click", () => {
    // Set pencil hold expiry = today + holdDays
    const exp = new Date();
    exp.setDate(exp.getDate() + Number(settings.holdDays || 3));
    inquiry.status = "pencil";
    inquiry.hold = {
      createdAt: new Date().toISOString(),
      expiresAt: exp.toISOString().slice(0,10)
    };
    persistInquiry(inquiry);
  });

  document.getElementById("markConfirmed").addEventListener("click", () => {
    inquiry.status = "confirmed";
    inquiry.hold = null;
    persistInquiry(inquiry);
  });

  document.getElementById("markCancelled").addEventListener("click", () => {
    inquiry.status = "cancelled";
    inquiry.hold = null;
    persistInquiry(inquiry);
  });

  // payment
  const payStatus = document.getElementById("payStatus");
  const payAmount = document.getElementById("payAmount");
  const payNotes = document.getElementById("payNotes");

  payStatus.value = inquiry.payment?.status || "unpaid";
  payAmount.value = Number(inquiry.payment?.amount || 0);
  payNotes.value = inquiry.payment?.notes || "";

  document.getElementById("savePayment").addEventListener("click", () => {
    inquiry.payment = {
      status: payStatus.value,
      amount: Number(payAmount.value || 0),
      notes: payNotes.value || ""
    };
    // small convenience: if paid, mark confirmed
    if (inquiry.payment.status === "paid" && inquiry.status !== "cancelled") {
      inquiry.status = "confirmed";
      inquiry.hold = null;
    }
    persistInquiry(inquiry);
  });
}

function persistInquiry(updated) {
  const idx = data.inquiries.findIndex(x => x.id === updated.id);
  if (idx >= 0) data.inquiries[idx] = updated;
  saveData(data);
  renderInbox();
  renderDetail();
  renderCalendar();
}

// ---------- Calendar ----------
const calTitle = document.getElementById("calTitle");
const calendarEl = document.getElementById("calendar");
document.getElementById("calPrev").addEventListener("click", () => {
  calCursor.setMonth(calCursor.getMonth() - 1);
  renderCalendar();
});
document.getElementById("calNext").addEventListener("click", () => {
  calCursor.setMonth(calCursor.getMonth() + 1);
  renderCalendar();
});

function renderCalendar() {
  data = loadData();
  const year = calCursor.getFullYear();
  const month = calCursor.getMonth(); // 0-based

  const monthName = calCursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  calTitle.textContent = `${settings.venueName} • ${monthName}`;

  calendarEl.innerHTML = "";

  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay(); // 0 Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // pad blank cells
  for (let i = 0; i < startDow; i++) {
    const blank = document.createElement("div");
    blank.className = "day";
    blank.style.opacity = "0.35";
    calendarEl.appendChild(blank);
  }

  // create day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const cellDate = new Date(year, month, day);
    const iso = cellDate.toISOString().slice(0,10);

    const cell = document.createElement("div");
    cell.className = "day";
    cell.innerHTML = `<div class="num">${day}</div>`;

    // show any inquiry that includes this date in its (startDate..endDate) range
    const hits = data.inquiries.filter(i => dateInRange(iso, i.startDate, i.endDate) && i.status !== "inquiry");
    hits.forEach(i => {
      const chip = document.createElement("span");
      chip.className = `chip ${i.status}`;
      chip.textContent = `${i.clientName} • ${statusLabel(i.status)}`;
      chip.title = `${i.clientName} (${i.startDate}→${i.endDate})`;
      chip.addEventListener("click", () => {
        selectedId = i.id;
        // switch to admin tab + show selected
        document.querySelector('[data-view="admin"]').click();
        renderInbox();
        renderDetail();
      });
      cell.appendChild(chip);
    });

    calendarEl.appendChild(cell);
  }
}

function dateInRange(iso, start, end) {
  const d = new Date(iso);
  const s = new Date(start);
  const e = new Date(end);
  return d >= s && d <= e;
}

// ---------- Settings ----------
const settingsForm = document.getElementById("settingsForm");
function hydrateSettingsForm() {
  settings = loadSettings();
  settingsForm.venueName.value = settings.venueName || "";
  settingsForm.holdDays.value = settings.holdDays || 3;
  settingsForm.currency.value = settings.currency || "PHP";
}

settingsForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(settingsForm);
  settings = {
    venueName: (fd.get("venueName") || "Venue").toString(),
    holdDays: Number(fd.get("holdDays") || 3),
    currency: (fd.get("currency") || "PHP").toString()
  };
  saveSettings(settings);
  alert("Saved.");
  // refresh admin UI if open
  renderDetail();
  renderCalendar();
});

document.getElementById("resetAll").addEventListener("click", () => {
  if (!confirm("Reset all stored data and settings?")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  data = loadData();
  settings = loadSettings();
  selectedId = null;
  hydrateSettingsForm();
  renderInbox();
  renderDetail();
  renderCalendar();
});

// ---------- Helpers ----------
function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// Initial render for admin calendar (if user switches immediately)
renderInbox();
renderDetail();
renderCalendar();
hydrateSettingsForm();
