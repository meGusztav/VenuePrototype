// shortlist.js
(async function(){
  const { $, qs } = Utils;

  const params = qs();
  const token = params.token;

  const titleEl = $("#shortTitle");
  const metaEl = $("#shortMeta");
  const listEl = $("#shortList");

  if (!listEl) return alert("Missing #shortList container.");

  try {
    await Pages.loadAllVenueData();

    if (!token) {
      listEl.innerHTML = `<div class="muted">No token provided.</div>`;
      return;
    }

    const { shortlist, venueIds } = await DB.getShortlistByToken(token);
    const venues = venueIds.map(id => State.state.venueById.get(id)).filter(Boolean);

    titleEl && (titleEl.textContent = shortlist.title || "Shortlist");
    metaEl && (metaEl.textContent = `${venues.length} venue(s) • Created ${new Date(shortlist.created_at).toLocaleDateString()}`);

    listEl.innerHTML = "";
    venues.forEach(v => {
      UI.renderVenueCard(v, listEl, {
        onDetails: () => {
          alert(`${v.name}\n${v.area}\nCapacity: ${v.paxMin}-${v.paxMax}\nPrice: ${UI.priceText(v)}\nConfidence: ${v.confidence}`);
        },
        onCompareChange: () => {},
        onShortlistChange: () => {}
      });
    });

  } catch (e) {
    console.error(e);
    alert(e.message || "Failed to load shortlist.");
  }
})();
