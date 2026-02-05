// customer-ui.js
window.UI = (() => {
  const cfg = window.APP_CONFIG;

  function confidenceBadge(conf, lastSync){
    const days = Utils.daysAgo(lastSync);
    if (conf === "verified") return `<span class="pill good">Verified</span>`;
    if (conf === "likely") return `<span class="pill warn">Likely</span>`;
    return `<span class="pill">Unverified</span>`;
  }

  function lastUpdatedText(ts){
    if (!ts) return "—";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" });
  }

  function availabilityText(venue, flow){
    // If no date range selected, just show confidence and last updated
    if (!flow.dateStart || !flow.dateEnd) return "";

    const blocks = State.state.blocksByVenue.get(venue.id) || [];
    const conflicts = blocks.filter(b => cfg.CONFLICT_BLOCK_TYPES.includes(b.block_type));

    if (venue.confidence === "unverified") {
      return `<span class="pill">Availability not verified</span>`;
    }

    if (conflicts.length === 0) {
      return `<span class="pill good">No conflicts found</span>`;
    }
    return `<span class="pill warn">Possible conflict</span>`;
  }

  function priceText(v){
    const sym = cfg.CURRENCY_SYMBOL;
    if (!v.priceFrom && !v.priceTo) return "—";
    if (v.priceFrom && v.priceTo) return `${Utils.formatMoney(v.priceFrom, sym)}–${Utils.formatMoney(v.priceTo, sym)}`;
    return v.priceFrom ? `From ${Utils.formatMoney(v.priceFrom, sym)}` : `Up to ${Utils.formatMoney(v.priceTo, sym)}`;
  }

  function distText(v){
    if (v.distKm == null) return `<span class="pill">Distance: set location</span>`;
    return `<span class="pill good">${v.distKm.toFixed(1)} km</span>`;
  }

  function capText(v){
    return `<span class="pill">${v.paxMin}–${v.paxMax} pax</span>`;
  }

  function ratingText(v){
    const r = Number(v.rating || 0);
    const c = Number(v.review_count || v.reviewCount || 0);
    return `<span class="pill good">★ ${r.toFixed(1)} (${c})</span>`;
  }

  function renderVenueCard(v, container, options={}){
    const flow = State.state.flow;
    const inCompare = State.state.compare.has(v.id);
    const inShort = State.state.shortlist.has(v.id);

    const conf = confidenceBadge(v.confidence, v.availability_last_sync);
    const updated = lastUpdatedText(v.availability_last_sync || v.profile_last_updated);

    const amen = (v.amenities || []).slice(0, 6).join(", ");
    const types = (v.eventTypes || []).slice(0, 4).join(", ");

    const avail = availabilityText(v, flow);

    const html = `
      <div class="item" data-vid="${v.id}">
        <div class="item-top">
          <div>
            <div class="name">${Utils.escapeHtml(v.name)}</div>
            <div class="muted small">${Utils.escapeHtml(v.area)}${v.address ? ` • ${Utils.escapeHtml(v.address)}` : ""}</div>

            <div class="meta">
              ${distText(v)}
              ${capText(v)}
              ${ratingText(v)}
              <span class="pill">${priceText(v)}</span>
              ${conf}
              ${avail}
            </div>

            <div class="muted small" style="margin-top:8px">
              Events: ${Utils.escapeHtml(types || "—")}
            </div>
            <div class="muted small">
              Amenities: ${Utils.escapeHtml(amen || "—")}
            </div>
            <div class="muted small">
              Last updated: ${Utils.escapeHtml(updated)}
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
            <button class="btn" data-action="details">View</button>
            <button class="btn" data-action="compare">${inCompare ? "✓ Comparing" : "Compare"}</button>
            <button class="btn" data-action="save">${inShort ? "♥ Saved" : "♡ Save"}</button>
          </div>
        </div>
      </div>
    `;

    const wrap = document.createElement("div");
    wrap.innerHTML = html.trim();
    const el = wrap.firstElementChild;
    container.appendChild(el);

    // Actions
    el.querySelector('[data-action="details"]').addEventListener("click", (e) => {
      e.stopPropagation();
      options.onDetails?.(v);
    });

    el.querySelector('[data-action="compare"]').addEventListener("click", (e) => {
      e.stopPropagation();
      const res = State.toggleCompare(v.id);
      if (!res.ok) alert(res.reason);
      options.onCompareChange?.();
    });

    el.querySelector('[data-action="save"]').addEventListener("click", (e) => {
      e.stopPropagation();
      State.toggleShortlist(v.id);
      options.onShortlistChange?.();
    });

    el.addEventListener("click", () => options.onDetails?.(v));
  }

  function renderStickyBar(root, { onCompare, onInquiry, onShareShortlist }){
    const cmpCount = State.state.compare.size;
    const shCount = State.state.shortlist.size;

    const bar = root;
    bar.innerHTML = `
      <div class="sticky-inner">
        <div class="muted small">
          Compare: <b>${cmpCount}</b> • Shortlist: <b>${shCount}</b>
        </div>
        <div class="sticky-actions">
          <button class="btn" ${cmpCount < 2 ? "disabled" : ""} data-sticky="compare">
            Compare (${cmpCount})
          </button>
          <button class="btn" ${shCount < 1 ? "disabled" : ""} data-sticky="share">
            Share shortlist
          </button>
          <button class="btn primary" ${shCount < 1 ? "disabled" : ""} data-sticky="inquiry">
            Send inquiry to saved (${Math.min(shCount, cfg.MAX_MULTI_INQUIRY)})
          </button>
        </div>
      </div>
    `;

    bar.querySelector('[data-sticky="compare"]')?.addEventListener("click", () => onCompare?.());
    bar.querySelector('[data-sticky="share"]')?.addEventListener("click", () => onShareShortlist?.());
    bar.querySelector('[data-sticky="inquiry"]')?.addEventListener("click", () => onInquiry?.());
  }

  return {
    renderVenueCard,
    renderStickyBar,
    priceText,
    lastUpdatedText,
    confidenceBadge
  };
})();

UI.openVenueDetails = function(v){
  const $ = Utils.$;

  $("#vdName").textContent = v.name;
  $("#vdMeta").textContent =
    `${v.area} • Guests ${v.pax_min}-${v.pax_max} • ${UI.priceText(v)}`;

  $("#vdContactName").textContent = v.contact_name || "Sales Team";
  $("#vdContactRole").textContent = v.contact_role || "Venue Sales";
  $("#vdPhone").textContent = v.phone || "Available after inquiry";
  $("#vdEmail").textContent = v.email || "Available after inquiry";

  const site = $("#vdWebsite");
  if (v.website) site.innerHTML = `<a href="${v.website}" target="_blank" rel="noopener">${v.website}</a>`;
  else site.textContent = "—";

  $("#vdInquiryBtn").onclick = () => {
    UI.closeVenueDetails();
    // Use your existing flow:
    // If you have openInquiryModal in find.js, keep calling onDetails -> openInquiryModal
    // If you added Pages.openInquiryForVenue, make sure it exists.
    if (typeof Pages.openInquiryForVenue === "function") Pages.openInquiryForVenue(v.id);
    else if (typeof Pages.submitInquiryToSelectedVenues === "function") {
      // fallback: open find.js inquiry modal flow if you still have it
      alert("Inquiry flow not wired. Add Pages.openInquiryForVenue or keep using openInquiryModal in find.js.");
    }
  };

  $("#venueDetailsModal").classList.remove("hidden");
};

UI.closeVenueDetails = function(){
  const $ = Utils.$;
  $("#venueDetailsModal").classList.add("hidden");
};
