// customer-pages.js
window.Pages = (() => {
  const cfg = window.APP_CONFIG;

  async function loadAllVenueData(){
    // Fetch core data
    const [base, conf, am, types] = await Promise.all([
      DB.fetchVenuesBase(cfg.MAX_VENUES_FETCH),
      DB.fetchConfidence(),
      DB.fetchAmenities(),
      DB.fetchEventTypes()
    ]);

    // Build maps
    const confMap = new Map(conf.map(x => [x.venue_id, x]));
    const amenMap = new Map();
    for (const row of am) {
      if (!amenMap.has(row.venue_id)) amenMap.set(row.venue_id, []);
      amenMap.get(row.venue_id).push(row.amenity);
    }
    const typeMap = new Map();
    for (const row of types) {
      if (!typeMap.has(row.venue_id)) typeMap.set(row.venue_id, []);
      typeMap.get(row.venue_id).push(row.event_type);
    }

    // Normalize venue objects for UI
    const venues = base.map(v => {
      const c = confMap.get(v.id);
      const confidence = c?.confidence || "unverified";
      return {
        ...v,
        paxMin: v.pax_min,
        paxMax: v.pax_max,
        priceFrom: v.price_from,
        priceTo: v.price_to,
        reviewCount: v.review_count,
        eventTypes: typeMap.get(v.id) || [],
        amenities: amenMap.get(v.id) || [],
        confidence
      };
    });

    State.state.venues = venues;
    State.state.venueById = new Map(venues.map(v => [v.id, v]));
  }

  function computeDistances(){
    const loc = State.state.userLoc;
    for (const v of State.state.venues) {
      if (loc && v.lat != null && v.lon != null) {
        v.distKm = Utils.kmBetween(loc, { lat: v.lat, lon: v.lon });
      } else {
        v.distKm = null;
      }
    }
  }

  async function refreshBlocksForCurrentRange(visibleVenueIds){
    const { dateStart, dateEnd } = State.state.flow;
    if (!dateStart || !dateEnd) {
      State.state.blocksByVenue = new Map();
      return;
    }

    const blocks = await DB.fetchBlocksForRange(visibleVenueIds, dateStart, dateEnd);

    const map = new Map();
    for (const b of blocks) {
      if (!map.has(b.venue_id)) map.set(b.venue_id, []);
      map.get(b.venue_id).push(b);
    }
    State.state.blocksByVenue = map;
  }

  function matchesVenue(v){
    const f = State.state.flow;

    // Location keyword
    if (f.locationText) {
      const q = f.locationText.toLowerCase();
      const blob = `${v.area || ""} ${v.name || ""} ${v.address || ""}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }

    // Event type
    if (f.eventType) {
      if (!(v.eventTypes || []).includes(f.eventType)) return false;
    }

    // Pax
    const pax = Utils.num(f.pax);
    if (pax) {
      if (!(v.paxMax >= pax && v.paxMin <= pax)) return false;
    }

    // Budget
    const bMin = Utils.num(f.budgetMin);
    const bMax = Utils.num(f.budgetMax);
    if (bMin) {
      // venue's max price should be >= bMin (still could fit)
      if (v.priceTo != null && v.priceTo < bMin) return false;
    }
    if (bMax) {
      // venue's min price should be <= bMax
      if (v.priceFrom != null && v.priceFrom > bMax) return false;
    }

    // Rating/reviews
    const ratingMin = Utils.num(f.ratingMin);
    if (ratingMin && Number(v.rating || 0) < ratingMin) return false;

    const reviewsMin = Utils.num(f.reviewsMin);
    if (reviewsMin && Number(v.reviewCount || 0) < reviewsMin) return false;

    // Amenities (all selected must exist)
    if (f.amenitySelected?.size) {
      const set = new Set(v.amenities || []);
      for (const a of f.amenitySelected) if (!set.has(a)) return false;
    }

    // Max distance cap (only if userLoc exists)
    const maxKm = Utils.num(f.maxKm);
    if (maxKm && State.state.userLoc && v.distKm != null && v.distKm > maxKm) return false;
    if (maxKm && State.state.userLoc && v.distKm == null) return false; // no coords => can't satisfy cap

    return true;
  }

  function scoreVenue(v){
    const f = State.state.flow;

    // Base score from rating
    let s = Number(v.rating || 0) * 20;
    s += Math.min(Number(v.reviewCount || 0), 300) * 0.05;

    // Distance
    if (State.state.userLoc && v.distKm != null) {
      s += Math.max(0, 35 - v.distKm); // closer = more points
    }

    // Confidence
    if (v.confidence === "verified") s += 20;
    else if (v.confidence === "likely") s += 10;

    // Budget closeness (soft)
    const bMin = Utils.num(f.budgetMin);
    const bMax = Utils.num(f.budgetMax);
    if (bMin || bMax) {
      const mid = (Number(v.priceFrom || 0) + Number(v.priceTo || 0)) / 2 || 0;
      const target = bMin && bMax ? (bMin + bMax) / 2 : (bMax || bMin);
      if (target && mid) {
        const diff = Math.abs(mid - target);
        s += Math.max(0, 20 - diff / 5000);
      }
    }

    // Availability overlap (if date range set & not unverified)
    if (f.dateStart && f.dateEnd && v.confidence !== "unverified") {
      const blocks = State.state.blocksByVenue.get(v.id) || [];
      const conflicts = blocks.filter(b => cfg.CONFLICT_BLOCK_TYPES.includes(b.block_type));
      if (conflicts.length === 0) s += 18;
      else s -= 25;
    }

    // Amenities selected
    if (f.amenitySelected?.size) s += 8;

    return s;
  }

  function sortVenues(rows){
    const f = State.state.flow;
    const sortBy = f.sortBy || "best";

    const copy = [...rows];

    if (sortBy === "distance") {
      copy.sort((a,b) => (a.distKm ?? 1e9) - (b.distKm ?? 1e9));
    } else if (sortBy === "rating") {
      copy.sort((a,b) => (Number(b.rating||0) - Number(a.rating||0)) || (Number(b.reviewCount||0) - Number(a.reviewCount||0)));
    } else if (sortBy === "price_low") {
      copy.sort((a,b) => (Number(a.priceFrom||1e9) - Number(b.priceFrom||1e9)));
    } else if (sortBy === "price_high") {
      copy.sort((a,b) => (Number(b.priceTo||0) - Number(a.priceTo||0)));
    } else {
      copy.sort((a,b) => scoreVenue(b) - scoreVenue(a));
    }
    return copy;
  }

  function getFilteredVenues(){
    computeDistances();
    const rows = State.state.venues.filter(matchesVenue);
    return sortVenues(rows);
  }

  async function ensureGeo(){
    if (!navigator.geolocation) throw new Error("Geolocation not supported.");
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          State.setUserLoc(loc);
          resolve(loc);
        },
        () => reject(new Error("Location permission denied.")),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  async function submitInquiryToSelectedVenues(venueIds, form){
    // Cap number of venues (avoid spam)
    const ids = venueIds.slice(0, cfg.MAX_MULTI_INQUIRY);

    const startDate = form.startDate;
    const endDate = form.endDate;
    if (new Date(endDate) < new Date(startDate)) throw new Error("End date must be on/after start date.");

    const inquiry = await DB.createInquiry({
      eventType: form.eventType,
      pax: form.pax,
      startDate,
      endDate,
      customerName: form.customerName,
      contactMethod: form.contactMethod,
      contactDetails: form.contactDetails,
      notes: form.notes
    });

    await DB.addInquiryRecipients(inquiry.id, ids);
    return inquiry.id;
  }

  async function createShareableShortlistFromLocal(){
    const localIds = Array.from(State.state.shortlist);
    if (!localIds.length) throw new Error("No saved venues.");

    // Create a backend shortlist and upload items
    const sl = await DB.createShortlist("My shortlist");
    await DB.addShortlistItems(sl.id, localIds);

    State.state.shortlistShare = { id: sl.id, token: sl.share_token };
    State.persist();

    return sl.share_token;
  }

  return {
    loadAllVenueData,
    getFilteredVenues,
    refreshBlocksForCurrentRange,
    ensureGeo,
    submitInquiryToSelectedVenues,
    createShareableShortlistFromLocal
  };
})();
