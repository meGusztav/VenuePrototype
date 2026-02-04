// customer-utils.js
window.Utils = (() => {
  function $(sel, root=document){ return root.querySelector(sel); }
  function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

  function escapeHtml(str){
    return String(str ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function num(v){ return Number((v ?? "").toString().trim() || 0); }
  function str(v){ return (v ?? "").toString().trim(); }

  function toISODate(d){
    if (!d) return "";
    if (typeof d === "string") return d.slice(0,10);
    return new Date(d).toISOString().slice(0,10);
  }

  function parseISODate(s){
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

  function formatMoney(n, symbol="₱"){
    const x = Number(n || 0);
    return `${symbol}${x.toLocaleString()}`;
  }

  function daysAgo(ts){
    if (!ts) return Infinity;
    const t = new Date(ts).getTime();
    if (Number.isNaN(t)) return Infinity;
    const diff = Date.now() - t;
    return diff / (1000*60*60*24);
  }

  // Haversine km
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

  function qs(){
    const out = {};
    const p = new URLSearchParams(location.search);
    for (const [k,v] of p.entries()) out[k] = v;
    return out;
  }

  function setQS(params){
    const p = new URLSearchParams(location.search);
    Object.entries(params).forEach(([k,v]) => {
      if (v === null || v === undefined || v === "") p.delete(k);
      else p.set(k, v);
    });
    const url = `${location.pathname}?${p.toString()}`;
    history.replaceState({}, "", url);
  }

  function uuid12(){
    // short-ish token for share links
    return crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  }

  // date overlap (inclusive)
  function overlaps(aStart, aEnd, bStart, bEnd){
    const as = parseISODate(aStart)?.getTime();
    const ae = parseISODate(aEnd)?.getTime();
    const bs = parseISODate(bStart)?.getTime();
    const be = parseISODate(bEnd)?.getTime();
    if ([as,ae,bs,be].some(x => x === undefined || x === null || Number.isNaN(x))) return false;
    return as <= be && bs <= ae;
  }

  return {
    $, $all,
    escapeHtml,
    num, str,
    toISODate, parseISODate,
    clamp,
    formatMoney,
    daysAgo,
    kmBetween,
    qs, setQS,
    uuid12,
    overlaps
  };
})();
