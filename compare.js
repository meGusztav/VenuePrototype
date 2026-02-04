// compare.js
(async function(){
  const { $, qs } = Utils;
  const root = $("#compareRoot");
  const meta = $("#compareMeta");

  const params = qs();
  const ids = (params.ids || "").split(",").map(s => s.trim()).filter(Boolean);

  if (!root) return alert("Missing #compareRoot container.");

  try {
    await Pages.loadAllVenueData();

    const venues = ids.map(id => State.state.venueById.get(id)).filter(Boolean);
    if (venues.length < 2) {
      root.innerHTML = `<div class="muted">Select 2–4 venues to compare.</div>`;
      return;
    }

    // Load policies for richer compare
    const policies = await DB.fetchPolicies(venues.map(v => v.id));
    const polMap = new Map(policies.map(p => [p.venue_id, p]));

    meta && (meta.textContent = `Comparing ${venues.length} venue(s)`);

    root.innerHTML = `
      <div class="compare-grid">
        ${venues.map(v => {
          const p = polMap.get(v.id) || {};
          return `
            <div class="card">
              <div class="card-h">
                <h2>${Utils.escapeHtml(v.name)}</h2>
                <div class="muted small">${Utils.escapeHtml(v.area)}</div>
              </div>
              <div class="card-b">
                <div class="kv"><div class="k">Capacity</div><div class="v">${v.paxMin}–${v.paxMax}</div></div>
                <div class="kv"><div class="k">Price</div><div class="v">${UI.priceText(v)}</div></div>
                <div class="kv"><div class="k">Rating</div><div class="v">★ ${Number(v.rating||0).toFixed(1)} (${v.reviewCount||0})</div></div>
                <div class="kv"><div class="k">Confidence</div><div class="v">${v.confidence}</div></div>
                <div class="kv"><div class="k">Last updated</div><div class="v">${UI.lastUpdatedText(v.availability_last_sync || v.profile_last_updated)}</div></div>

                <div class="divider"></div>

                <div class="kv"><div class="k">Corkage</div><div class="v">${p.corkage_allowed == null ? "—" : (p.corkage_allowed ? "Allowed" : "Not allowed")}</div></div>
                <div class="kv"><div class="k">Curfew</div><div class="v">${p.curfew_time || "—"}</div></div>
                <div class="kv"><div class="k">Overtime</div><div class="v">${p.overtime_fee ? (APP_CONFIG.CURRENCY_SYMBOL + Number(p.overtime_fee).toLocaleString()) : "—"}</div></div>
                <div class="kv"><div class="k">Parking</div><div class="v">${p.parking_slots ?? "—"}</div></div>
                <div class="kv"><div class="k">Generator</div><div class="v">${p.generator == null ? "—" : (p.generator ? "Yes" : "No")}</div></div>
                <div class="kv"><div class="k">Rain backup</div><div class="v">${p.rain_backup == null ? "—" : (p.rain_backup ? "Yes" : "No")}</div></div>
                <div class="kv"><div class="k">Accessibility</div><div class="v">${p.accessibility == null ? "—" : (p.accessibility ? "Yes" : "No")}</div></div>

                <div class="divider"></div>

                <div class="muted small">Events: ${Utils.escapeHtml((v.eventTypes||[]).join(", ") || "—")}</div>
                <div class="muted small">Amenities: ${Utils.escapeHtml((v.amenities||[]).join(", ") || "—")}</div>

                <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
                  <a class="btn" href="find.html">Back</a>
                  <button class="btn" data-save="${v.id}">♡ Save</button>
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    root.querySelectorAll("[data-save]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-save");
        State.toggleShortlist(id);
        btn.textContent = State.state.shortlist.has(id) ? "♥ Saved" : "♡ Save";
      });
    });

  } catch (e) {
    console.error(e);
    alert(e.message || "Failed to load compare.");
  }
})();
