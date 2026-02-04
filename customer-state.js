// customer-state.js
window.State = (() => {
  const cfg = window.APP_CONFIG;

  const STORE_KEY = "custFinder:v1"; // local UI prefs only (NOT inventory)
  const store = load();

  const state = {
    // Data caches
    venues: [],
    venueById: new Map(),
    amenitiesByVenue: new Map(),
    typesByVenue: new Map(),
    confidenceByVenue: new Map(), // "verified|likely|unverified"
    blocksByVenue: new Map(),     // venueId => blocks overlapping current query range

    // User context
    userLoc: null, // {lat, lon}
    compare: new Set(store.compare || []),      // venueIds
    shortlist: new Set(store.shortlist || []),  // venueIds (local, can be uploaded to shared shortlist)
    shortlistShare: store.shortlistShare || null, // {id, token}

    // Search / guided flow
    flow: {
      step: store.flowStep || 1,
      eventType: store.eventType || "",
      pax: store.pax || "",
      budgetMin: store.budgetMin || "",
      budgetMax: store.budgetMax || "",
      dateStart: store.dateStart || "",
      dateEnd: store.dateEnd || "",
      locationText: store.locationText || "",
      maxKm: store.maxKm || "",
      ratingMin: store.ratingMin || "0",
      reviewsMin: store.reviewsMin || "",
      amenitySelected: new Set(store.amenities || []),
      sortBy: store.sortBy || "best"
    }
  };

  function load(){
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); }
    catch { return {}; }
  }

  function persist(){
    const payload = {
      compare: Array.from(state.compare),
      shortlist: Array.from(state.shortlist),
      shortlistShare: state.shortlistShare,
      flowStep: state.flow.step,
      eventType: state.flow.eventType,
      pax: state.flow.pax,
      budgetMin: state.flow.budgetMin,
      budgetMax: state.flow.budgetMax,
      dateStart: state.flow.dateStart,
      dateEnd: state.flow.dateEnd,
      locationText: state.flow.locationText,
      maxKm: state.flow.maxKm,
      ratingMin: state.flow.ratingMin,
      reviewsMin: state.flow.reviewsMin,
      amenities: Array.from(state.flow.amenitySelected),
      sortBy: state.flow.sortBy
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(payload));
  }

  function toggleCompare(id){
    if (state.compare.has(id)) state.compare.delete(id);
    else {
      if (state.compare.size >= cfg.MAX_COMPARE) return { ok:false, reason:`Max ${cfg.MAX_COMPARE} compare` };
      state.compare.add(id);
    }
    persist();
    return { ok:true };
  }

  function toggleShortlist(id){
    if (state.shortlist.has(id)) state.shortlist.delete(id);
    else state.shortlist.add(id);
    persist();
    return { ok:true };
  }

  function clearCompare(){ state.compare.clear(); persist(); }
  function clearShortlist(){ state.shortlist.clear(); persist(); }

  function setUserLoc(loc){ state.userLoc = loc; }

  function setStep(step){ state.flow.step = step; persist(); }

  return {
    state,
    persist,
    toggleCompare,
    toggleShortlist,
    clearCompare,
    clearShortlist,
    setUserLoc,
    setStep
  };
})();
