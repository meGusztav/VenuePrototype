// customer-supabase.js
window.DB = (() => {
  const cfg = window.APP_CONFIG;
  const sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  async function fetchVenuesBase(limit = cfg.MAX_VENUES_FETCH){
    const { data, error } = await sb
      .from("venues")
      .select(
      "id,name,area,address,lat,lon," +
      "pax_min,pax_max,price_from,price_to,currency," +
      "rating,review_count,is_claimed,availability_source," +
      "availability_last_sync,profile_last_updated," +
      "phone,email,website,contact_name,contact_role"
      )
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async function fetchConfidence(){
    const { data, error } = await sb
      .from("venue_confidence")
      .select("venue_id,confidence,availability_last_sync,is_claimed,availability_source,profile_last_updated");
    if (error) throw error;
    return data || [];
  }

  async function fetchAmenities(){
    const { data, error } = await sb
      .from("venue_amenities")
      .select("venue_id,amenity");
    if (error) throw error;
    return data || [];
  }

  async function fetchEventTypes(){
    const { data, error } = await sb
      .from("venue_event_types")
      .select("venue_id,event_type");
    if (error) throw error;
    return data || [];
  }

  async function fetchPolicies(venueIds){
    // Optional—call only when needed (compare/details)
    const { data, error } = await sb
      .from("venue_policies")
      .select("*")
      .in("venue_id", venueIds);
    if (error) throw error;
    return data || [];
  }

  async function fetchPhotos(venueIds){
    const { data, error } = await sb
      .from("venue_photos")
      .select("venue_id,url,tag,is_verified")
      .in("venue_id", venueIds);
    if (error) throw error;
    return data || [];
  }

  async function fetchBlocksForRange(venueIds, startDate, endDate){
    if (!venueIds?.length || !startDate || !endDate) return [];
    // overlap: block.start <= end AND block.end >= start
    const { data, error } = await sb
      .from("availability_blocks")
      .select("venue_id,start_date,end_date,block_type,source")
      .in("venue_id", venueIds)
      .lte("start_date", endDate)
      .gte("end_date", startDate);
    if (error) throw error;
    return data || [];
  }

  async function createInquiry({ eventType, pax, startDate, endDate, customerName, contactMethod, contactDetails, notes }){
    const { data, error } = await sb
      .from("inquiries")
      .insert([{
        event_type: eventType,
        pax,
        start_date: startDate,
        end_date: endDate,
        customer_name: customerName,
        contact_method: contactMethod,
        contact_details: contactDetails,
        notes
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function addInquiryRecipients(inquiryId, venueIds){
    const rows = venueIds.map(vid => ({
      inquiry_id: inquiryId,
      venue_id: vid,
      status: "sent"
    }));
    const { error } = await sb.from("inquiry_recipients").insert(rows);
    if (error) throw error;
    return true;
  }

  async function createShortlist(title="My shortlist"){
    const token = Utils.uuid12();
    const { data, error } = await sb
      .from("shortlists")
      .insert([{ title, share_token: token }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function addShortlistItems(shortlistId, venueIds){
    const rows = venueIds.map(vid => ({ shortlist_id: shortlistId, venue_id: vid }));
    const { error } = await sb.from("shortlist_items").insert(rows);
    if (error) throw error;
    return true;
  }

  async function removeShortlistItem(shortlistId, venueId){
    const { error } = await sb
      .from("shortlist_items")
      .delete()
      .eq("shortlist_id", shortlistId)
      .eq("venue_id", venueId);
    if (error) throw error;
    return true;
  }

  async function getShortlistByToken(token){
    const { data: sl, error: e1 } = await sb
      .from("shortlists")
      .select("id,title,share_token,created_at")
      .eq("share_token", token)
      .single();
    if (e1) throw e1;

    const { data: items, error: e2 } = await sb
      .from("shortlist_items")
      .select("venue_id")
      .eq("shortlist_id", sl.id);
    if (e2) throw e2;

    return { shortlist: sl, venueIds: (items || []).map(x => x.venue_id) };
  }

  return {
    sb,
    fetchVenuesBase,
    fetchConfidence,
    fetchAmenities,
    fetchEventTypes,
    fetchPolicies,
    fetchPhotos,
    fetchBlocksForRange,
    createInquiry,
    addInquiryRecipients,
    createShortlist,
    addShortlistItems,
    removeShortlistItem,
    getShortlistByToken
  };
})();
