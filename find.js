// find.js
(async function(){
  const { $, $all } = Utils;

  const els = {
    resultsList: $("#resultsList"),
    resultMeta: $("#resultMeta"),
    geoBtn: $("#geoBtn"),
    geoStatus: $("#geoStatus"),
    stickyBar: $("#stickyBar"),

    // Guided form inputs (you’ll wire these in HTML)
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

    // Step controls
    stepLabel: $("#stepLabel"),
    stepBack: $("#stepBack"),
    stepNext: $("#stepNext"),
    stepDots: $("#stepDots"),

    // Multi-inquiry modal (optional; if missing, we use prompt())
    inquiryModal: $("#inqModal"),
    inquiryForm: $("#inqForm"),
    inqClose: $("#inqClose")
  };

  // --- Amenities universe (same as you used before)
  const amenityUniverse = [
    "Parking","Catering","Outdoor","Aircon","Stage","AV system","LED wall","Security",
    "Accessibility","Photo spots","Bridal room","Near MRT/LRT","Generator","Rain backup","Corkage"
  ];

  function hydrateFromState(){
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

  function bindInputs(){
    function setFlow(k, v){
      State.state.flow[k] = v;
      State.persist();
      apply();
    }

    els.eventType?.addEventListener("change", e => setFlow("eventType", e.target.value));
    els.pax?.addEventListener("input", e => setFlow("pax", e.target.value));
    els.budgetMin?.addEventListener("input", e => setFlow("budgetMin", e.target.value));
    els.budgetMax?.addEventListener("input", e => setFlow("budgetMax", e.target.value));
    els.dateStart?.addEventListener("change", e => setFlow("dateStart", e.target.value));
    els.dateEnd?.addEventListener("change", e => setFlow("dateEnd", e.target.value));
    els.locationText?.addEventListener("input", e => setFlow("locationText", e.target.value));

    els.ratingMin?.addEventListener("change", e => setFlow("ratingMin", e.target.value));
    els.reviewsMin?.addEventListener("input", e => setFlow("reviewsMin", e.target.value));
    els.maxKm?.addEventListener("input", e => setFlow("maxKm", e.target.value));
    els.sortBy?.addEventListener("change", e => setFlow("sortBy", e.target.value));
  }

  function renderAmenityChips(){
    if (!els.amenitiesWrap) return;
    els.amenitiesWrap.innerHTML = "";
    const selected = State.state.flow.amenitySelected;

    amenityUniverse.forEach(a => {
      const chip = document.createElement("div");
      chip.className = "chip" + (selected.has(a) ? " active" : "");
      chip.textContent = a;
      chip.addEventListener("click", () => {
        if (selected.has(a)) selected.delete(a);
        else selected.add(a);
        State.persist();
        renderAmenityChips();
        apply();
      });
      els.amenitiesWrap.appendChild(chip);
    });
  }

  // --- Guided stepper (5 steps)
  const steps = [
    { label:"Event type", required:["eventType"] },
    { label:"Guests (pax)", required:["pax"] },
    { label:"Budget", required:[] },
    { label:"Dates", required:["dateStart","dateEnd"] },
    { label:"Location", required:[] }
  ];

  function validateStep(stepIndex){
    const f = State.state.flow;
    const req = steps[stepIndex-1]?.required || [];
    for (const k of req) {
      if (!f[k]) return { ok:false, reason:`Please fill ${k}.` };
    }
    if (stepIndex === 4) {
      if (f.dateStart && f.dateEnd && new Date(f.dateEnd) < new Date(f.dateStart)) {
        return { ok:false, reason:"End date must be on/after start date." };
      }
    }
    return { ok:true };
  }

  function renderStepper(){
    if (!els.stepLabel) return;
    const s = State.state.flow.step;

    els.stepLabel.textContent = `Step ${s}/5 — ${steps[s-1].label}`;

    if (els.stepDots) {
      els.stepDots.innerHTML = steps.map((_,i) => {
        const on = (i+1) === s;
        return `<span class="dot ${on ? "on":""}"></span>`;
      }).join("");
    }

    if (els.stepBack) els.stepBack.disabled = s <= 1;
    if (els.stepNext) els.stepNext.textContent = (s >= 5) ? "See results" : "Next";
  }

  function bindStepper(){
    els.stepBack?.addEventListener("click", () => {
      const s = State.state.flow.step;
      State.setStep(Math.max(1, s-1));
      renderStepper();
      apply();
    });

    els.stepNext?.addEventListener("click", () => {
      const s = State.state.flow.step;
      const v = validateStep(s);
      if (!v.ok) return alert(v.reason);

      if (s >= 5) {
        // Jump to results section (if exists)
        document.getElementById("resultsAnchor")?.scrollIntoView({ behavior:"smooth" });
        apply();
        return;
      }
      State.setStep(Math.min(5, s+1));
      renderStepper();
      apply();
    });
  }

  // --- Geo button
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

  // --- Modal helpers (optional)
  function openInquiryModal(defaultVenueIds){
    // If you don't have a modal in HTML, we fallback to simple prompts.
    if (!els.inquiryModal || !els.inquiryForm) {
      return promptInquiryFallback(defaultVenueIds);
    }
    els.inquiryModal.classList.remove("hidden");
    els.inquiryModal.dataset.venueids = defaultVenueIds.join(",");
  }

  function closeInquiryModal(){
    els.inquiryModal?.classList.add("hidden");
    if (els.inquiryModal) delete els.inquiryModal.dataset.venueids;
    els.inquiryForm?.reset();
  }

  els.inqClose?.addEventListener("click", closeInquiryModal);
  els.inquiryModal?.addEventListener("click", (e) => {
    if (e.target === els.inquiryModal) closeInquiryModal();
  });

  async function promptInquiryFallback(venueIds){
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

      alert(`Inquiry sent!`);
      closeInquiryModal();
    } catch (err) {
      alert(err.message || "Failed to send inquiry.");
    }
  });

  // --- Details modal: simplest approach is a redirect to a "venue.html?id=..."
  // If you already have a modal UI, swap this handler.
  function onDetails(v){
    // For MVP: open a lightweight details prompt and allow inquiry to this venue
    const flow = State.state.flow;
    const conf = v.confidence.toUpperCase();
    const msg =
      `${v.name}\n${v.area}\n` +
      `Capacity: ${v.paxMin}-${v.paxMax}\n` +
      `Price: ${UI.priceText(v)}\n` +
      `Rating: ${Number(v.rating||0).toFixed(1)} (${v.reviewCount||0})\n` +
      `Confidence: ${conf}\n` +
      `Last updated: ${UI.lastUpdatedText(v.availability_last_sync || v.profile_last_updated)}\n\n` +
      `Inquiry to this venue now?`;
    if (confirm(msg)) openInquiryModal([v.id]);
  }

  function onCompareChange(){ apply(); }
  function onShortlistChange(){ apply(); }

  // --- Sticky actions
  async function onCompare(){
    const ids = Array.from(State.state.compare);
    if (ids.length < 2) return;
    window.location.href = `compare.html?ids=${encodeURIComponent(ids.join(","))}`;
  }

  async function onShareShortlist(){
    try {
      const token = await Pages.createShareableShortlistFromLocal();
      const shareUrl = `${location.origin}${location.pathname.replace(/[^/]+$/, "")}shortlist.html?token=${token}`;
      prompt("Share this link:", shareUrl);
      apply();
    } catch (e) {
      alert(e.message || "Could not create share link.");
    }
  }

  async function onInquiry(){
    const ids = Array.from(State.state.shortlist).slice(0, APP_CONFIG.MAX_MULTI_INQUIRY);
    if (!ids.length) return alert("No saved venues.");
    openInquiryModal(ids);
  }

  // --- Core apply/render
  async function apply(){
    if (!els.resultsList) return;

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
      // still render without availability overlays
      State.state.blocksByVenue = new Map();
    }

    // Recompute sort because availability score uses blocks
    const rows2 = Pages.getFilteredVenues();
    const show = rows2.slice(0, 80);

    els.resultsList.innerHTML = "";
    els.resultMeta && (els.resultMeta.textContent = `${rows2.length} venue(s)`);

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
    bindStepper();
    renderStepper();

    if (els.geoStatus) els.geoStatus.textContent = State.state.userLoc ? "Location: set" : "Location: not set";

    // Load backend data
    els.resultMeta && (els.resultMeta.textContent = "Loading venues…");
    await Pages.loadAllVenueData();

    // First render
    await apply();
  } catch (e) {
    console.error(e);
    alert(`Failed to load: ${e.message || e}`);
  }
})();
