// find.js
(async function () {
  const { $, $all } = Utils;

  const els = {
    resultsList: $("#resultsList"),
    resultMeta: $("#resultMeta"),
    geoBtn: $("#geoBtn"),
    geoStatus: $("#geoStatus"),
    stickyBar: $("#stickyBar"),

    // Search + filters inputs (IDs reused across layouts)
    eventType: $("#eventType"),
    pax: $("#pax"),
    budgetMin: $("#budgetMin"),
    budgetMax: $("#budgetMax"),
    dateStart: $("#dateStart"),
    dateEnd: $("#dateEnd"),
    locationText: $("#locationText"),

    ratingMin: $("#ratingMin"),
    reviewsMin: $("#reviewsMin"),
    maxKm: $("#maxKm"),
    sortBy: $("#sortBy"),

    // amenities wrap
    amenitiesWrap: $("#amenitiesWrap"),

    // Optional stepper controls (if present in your HTML)
    stepLabel: $("#stepLabel"),
    stepBack: $("#stepBack"),
    stepNext: $("#stepNext"),
    stepDots: $("#stepDots"),

    // Search / Filters UI (if present in your HTML)
    searchBtn: $("#searchBtn"),
    filtersBtn: $("#filtersBtn"),
    filtersModal: $("#filtersModal"),
    filtersClose: $("#filtersClose"),
    applyFilters: $("#applyFilters"),
    clearFilters: $("#clearFilters"),

    // Multi-inquiry modal (optional; if missing, we use prompt())
    inquiryModal: $("#inqModal"),
    inquiryForm: $("#inqForm"),
    inqClose: $("#inqClose")
  };

  // Make the page feel consumer-friendly:
  // - Don't re-render on every keystroke
  // - Prefer explicit Search / Apply
  // - Stepper is optional
  const CUSTOMER_MODE = true;

  // --- Amenities universe (same as you used before)
  const amenityUniverse = [
    "Parking", "Catering", "Outdoor", "Aircon", "Stage", "AV system", "LED wall", "Security",
    "Accessibility", "Photo spots", "Bridal room", "Near MRT/LRT", "Generator", "Rain backup", "Corkage"
  ];

  function hydrateFromState() {
    const f = State.state.flow;
    if (els.eventType) els.eventType.value = f.eventType;
    if (els.pax) els.pax.value = f.pax;
    if (els.budgetMin) els.budgetMin.value = f.budgetMin;
    if (els.budgetMax) els.budgetMax.value = f.budgetMax;
    if (els.dateStart) els.dateStart.value = f.dateStart;
    if (els.dateEnd) els.dateEnd.value = f.dateEnd;
    if (els.locationText) els.locationText.value = f.locationText;

    if (els.ratingMin) els.ratingMin.value = f.ratingMin;
    if (els.reviewsMin) els.reviewsMin.value = f.reviewsMin;
    if (els.maxKm) els.maxKm.value = f.maxKm;
    if (els.sortBy) els.sortBy.value = f.sortBy || "best";
  }

  // Persist only; don’t re-render per keystroke
  function bindInputs() {
    function setFlow(k, v) {
      State.state.flow[k] = v;
      State.persist();
    }

    // “Search” fields (user will tap Search)
    els.eventType?.addEventListener("change", (e) => setFlow("eventType", e.target.value));
    els.pax?.addEventListener("input", (e) => setFlow("pax", e.target.value));
    els.budgetMin?.addEventListener("input", (e) => setFlow("budgetMin", e.target.value));
    els.budgetMax?.addEventListener("input", (e) => setFlow("budgetMax", e.target.value));
    els.dateStart?.addEventListener("change", (e) => setFlow("dateStart", e.target.value));
    els.dateEnd?.addEventListener("change", (e) => setFlow("dateEnd", e.target.value));
    els.locationText?.addEventListener("input", (e) => setFlow("locationText", e.target.value));

    // These can be “instant apply” if you prefer, but we keep them consistent
    els.ratingMin?.addEventListener("change", (e) => setFlow("ratingMin", e.target.value));
    els.reviewsMin?.addEventListener("input", (e) => setFlow("reviewsMin", e.target.value));
    els.maxKm?.addEventListener("input", (e) => setFlow("maxKm", e.target.value));
    els.sortBy?.addEventListener("change", (e) => {
      setFlow("sortBy", e.target.value);
      // Sorting feels ok to apply instantly
      apply();
    });

    // Explicit Search
    els.searchBtn?.addEventListener("click", () => apply());

    // Enter key in search inputs triggers apply (Google-like)
    [els.locationText, els.pax].forEach((el) => {
      el?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") apply();
      });
    });
  }

  function renderAmenityChips() {
    if (!els.amenitiesWrap) return;
    els.amenitiesWrap.innerHTML = "";
    const selected = State.state.flow.amenitySelected;

    amenityUniverse.forEach((a) => {
      const chip = document.createElement("div");
      chip.className = "chip" + (selected.has(a) ? " active" : "");
      chip.textContent = a;
      chip.addEventListener("click", () => {
        if (selected.has(a)) selected.delete(a);
        else selected.add(a);
        State.persist();
        renderAmenityChips();
        // In customer mode, apply on “Apply” button if modal exists.
        // If no modal exists, apply immediately.
        if (!els.filtersModal) apply();
      });
      els.amenitiesWrap.appendChild(chip);
    });
  }

  // --- Optional guided stepper (5 steps) - kept for compatibility
  const steps = [
    { label: "Event type", required: ["eventType"] },
    { label: "Guests", required: ["pax"] },
    { label: "Budget", required: [] },
    { label: "Dates", required: ["dateStart", "dateEnd"] },
    { label: "Location", required: [] }
  ];

  function validateStep(stepIndex) {
    const f = State.state.flow;
    const req = steps[stepIndex - 1]?.required || [];
    for (const k of req) {
      if (!f[k]) {
        const nice = { eventType: "event type", pax: "guests", dateStart: "start date", dateEnd: "end date" }[k] || k;
        return { ok: false, reason: `Please enter ${nice}.` };
      }
    }
    if (stepIndex === 4) {
      if (f.dateStart && f.dateEnd && new Date(f.dateEnd) < new Date(f.dateStart)) {
        return { ok: false, reason: "End date must be on/after start date." };
      }
    }
    return { ok: true };
  }

  function renderStepper() {
    if (!els.stepLabel) return;
    const s = State.state.flow.step;

    els.stepLabel.textContent = `Step ${s}/5 — ${steps[s - 1].label}`;

    if (els.stepDots) {
      els.stepDots.innerHTML = steps
        .map((_, i) => {
          const on = (i + 1) === s;
          return `<span class="dot ${on ? "on" : ""}"></span>`;
        })
        .join("");
    }

    if (els.stepBack) els.stepBack.disabled = s <= 1;
    if (els.stepNext) els.stepNext.textContent = s >= 5 ? "See results" : "Next";
  }

  function bindStepper() {
    els.stepBack?.addEventListener("click", () => {
      const s = State.state.flow.step;
      State.setStep(Math.max(1, s - 1));
      renderStepper();
    });

    els.stepNext?.addEventListener("click", () => {
      const s = State.state.flow.step;
      const v = validateStep(s);
      if (!v.ok) return alert(v.reason);

      if (s >= 5) {
        document.getElementById("resultsAnchor")?.scrollIntoView({ behavior: "smooth" });
        apply();
        return;
      }
      State.setStep(Math.min(5, s + 1));
      renderStepper();
    });

    // Hide stepper in customer mode (if it exists)
    if (CUSTOMER_MODE && els.stepLabel) {
      // Try to hide the whole stepper bar container if your HTML matches
      const bar = els.stepLabel.closest(".stepper-bar");
      if (bar) bar.style.display = "none";
    }
  }

  // --- Geo button (manual trigger still exists)
  els.geoBtn?.addEventListener("click", async () => {
    try {
      els.geoStatus && (els.geoStatus.textContent = "Location: requesting…");
      await Pages.ensureGeo();
      els.geoStatus && (els.geoStatus.textContent = "Location: set");
      apply();
    } catch (e) {
      els.geoStatus && (els.geoStatus.textContent = "Location: denied");
      alert(e.message || "Could not get location.");
    }
  });

  // --- Filters modal wiring (if present)
  function bindFiltersModal() {
    if (!els.filtersModal) return;

    const show = () => els.filtersModal.classList.remove("hidden");
    const hide = () => els.filtersModal.classList.add("hidden");

    els.filtersBtn?.addEventListener("click", show);
    els.filtersClose?.addEventListener("click", hide);

    els.filtersModal?.addEventListener("click", (e) => {
      if (e.target === els.filtersModal) hide();
    });

    els.applyFilters?.addEventListener("click", () => {
      // Save current UI values into state (since we stopped auto-apply)
      hydrateUIIntoState();
      hide();
      apply();
    });

    els.clearFilters?.addEventListener("click", () => {
      // Clear UI values
      ["budgetMin", "budgetMax", "reviewsMin", "maxKm"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      const rating = document.getElementById("ratingMin");
      if (rating) rating.value = "0";
      const sort = document.getElementById("sortBy");
      if (sort) sort.value = "best";

      // Clear amenity set
      State.state.flow.amenitySelected = new Set();
      renderAmenityChips();

      hydrateUIIntoState();
      hide();
      apply();
    });
  }

  // When using explicit apply, we need to read current input values into State
  function hydrateUIIntoState() {
    const f = State.state.flow;
    if (els.eventType) f.eventType = els.eventType.value || "";
    if (els.pax) f.pax = els.pax.value || "";
    if (els.budgetMin) f.budgetMin = els.budgetMin.value || "";
    if (els.budgetMax) f.budgetMax = els.budgetMax.value || "";
    if (els.dateStart) f.dateStart = els.dateStart.value || "";
    if (els.dateEnd) f.dateEnd = els.dateEnd.value || "";
    if (els.locationText) f.locationText = els.locationText.value || "";
    if (els.ratingMin) f.ratingMin = els.ratingMin.value || "0";
    if (els.reviewsMin) f.reviewsMin = els.reviewsMin.value || "";
    if (els.maxKm) f.maxKm = els.maxKm.value || "";
    if (els.sortBy) f.sortBy = els.sortBy.value || "best";
    State.persist();
  }

  // --- Modal helpers (optional)
  function openInquiryModal(defaultVenueIds) {
    if (!els.inquiryModal || !els.inquiryForm) {
      return promptInquiryFallback(defaultVenueIds);
    }
    els.inquiryModal.classList.remove("hidden");
    els.inquiryModal.dataset.venueids = defaultVenueIds.join(",");
  }

  function closeInquiryModal() {
    els.inquiryModal?.classList.add("hidden");
    if (els.inquiryModal) delete els.inquiryModal.dataset.venueids;
    els.inquiryForm?.reset();
  }

  els.inqClose?.addEventListener("click", closeInquiryModal);
  els.inquiryModal?.addEventListener("click", (e) => {
    if (e.target === els.inquiryModal) closeInquiryModal();
  });

  async function promptInquiryFallback(venueIds) {
    const f = State.state.flow;
    const customerName = prompt("Your name?");
    if (!customerName) return;
    const contactMethod = prompt("Contact method? (Messenger/Viber/Email/Phone)");
    if (!contactMethod) return;
    const contactDetails = prompt("Contact details?");
    if (!contactDetails) return;

    const notes = prompt("Notes (optional)") || "";

    const inquiryId = await Pages.submitInquiryToSelectedVenues(
      venueIds,
      {
        eventType: f.eventType || "Other",
        pax: Utils.num(f.pax) || 0,
        startDate: f.dateStart,
        endDate: f.dateEnd,
        customerName,
        contactMethod,
        contactDetails,
        notes
      }
    );
    alert(`Inquiry sent! (ID: ${inquiryId})`);
  }

  // If modal exists, bind submit
  els.inquiryForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const venueIds = (els.inquiryModal?.dataset.venueids || "").split(",").filter(Boolean);
      if (!venueIds.length) throw new Error("No selected venues.");

      const fd = new FormData(els.inquiryForm);
      const inquiryId = await Pages.submitInquiryToSelectedVenues(venueIds, {
        eventType: fd.get("eventType") || State.state.flow.eventType || "Other",
        pax: Utils.num(fd.get("pax")),
        startDate: fd.get("startDate"),
        endDate: fd.get("endDate"),
        customerName: fd.get("customerName"),
        contactMethod: fd.get("contactMethod"),
        contactDetails: fd.get("contactDetails"),
        notes: fd.get("notes") || ""
      });

      alert("Inquiry sent!");
      closeInquiryModal();
    } catch (err) {
      alert(err.message || "Failed to send inquiry.");
    }
  });

  // --- Details handler
  function onDetails(v){
  UI.openVenueDetails(v);
}

  function onCompareChange() { apply(); }
  function onShortlistChange() { apply(); }

  // --- Sticky actions
  async function onCompare() {
    const ids = Array.from(State.state.compare);
    if (ids.length < 2) return;
    window.location.href = `compare.html?ids=${encodeURIComponent(ids.join(","))}`;
  }

  async function onShareShortlist() {
    try {
      const token = await Pages.createShareableShortlistFromLocal();
      const shareUrl = `${location.origin}${location.pathname.replace(/[^/]+$/, "")}shortlist.html?token=${token}`;
      prompt("Share this link:", shareUrl);
      apply();
    } catch (e) {
      alert(e.message || "Could not create share link.");
    }
  }

  async function onInquiry() {
    const ids = Array.from(State.state.shortlist).slice(0, APP_CONFIG.MAX_MULTI_INQUIRY);
    if (!ids.length) return alert("No saved venues.");
    openInquiryModal(ids);
  }

  // --- Core apply/render
  async function apply() {
    if (!els.resultsList) return;

    // Ensure state reflects current UI (important since we stopped auto-apply)
    hydrateUIIntoState();

    // Filter/sort
    const rows = Pages.getFilteredVenues();

    // Only fetch blocks for top N visible to keep it cheap
    const top = rows.slice(0, 80);
    const ids = top.map(v => v.id);

    // Update blocks for selected date range
    try {
      await Pages.refreshBlocksForCurrentRange(ids);
    } catch (e) {
      console.warn("Blocks fetch failed:", e);
      State.state.blocksByVenue = new Map();
    }

    // Recompute sort because availability score uses blocks
    const rows2 = Pages.getFilteredVenues();
    const show = rows2.slice(0, 80);

    els.resultsList.innerHTML = "";
    if (els.resultMeta) els.resultMeta.textContent = `${rows2.length} venue(s)`;

    show.forEach(v => UI.renderVenueCard(v, els.resultsList, {
      onDetails,
      onCompareChange,
      onShortlistChange
    }));

    // Sticky bar
    if (els.stickyBar) UI.renderStickyBar(els.stickyBar, {
      onCompare,
      onInquiry,
      onShareShortlist
    });

    // Geostatus
    if (els.geoStatus) {
      els.geoStatus.textContent = State.state.userLoc ? "Location: set" : "Location: not set";
    }
  }

  // --- Init load
  try {
    hydrateFromState();
    renderAmenityChips();
    bindInputs();
    bindFiltersModal();
    bindStepper();
    renderStepper();

    if (els.geoStatus) els.geoStatus.textContent = State.state.userLoc ? "Location: set" : "Location: not set";
    if (els.resultMeta) els.resultMeta.textContent = "Loading venues…";

    // Load backend data
    await Pages.loadAllVenueData();

    // Optional: try to get geo automatically (Maps-like). Silent if denied.
    if (CUSTOMER_MODE && !State.state.userLoc) {
      try {
        await Pages.ensureGeo();
        if (els.geoStatus) els.geoStatus.textContent = "Location: set";
      } catch { /* ignore */ }
    }

    // First render
    await apply();
  } catch (e) {
    console.error(e);
    alert(`Failed to load: ${e.message || e}`);
  }
})();
