var CLOUD_NEW = "https://extendsclass.com/api/json-storage/bin";
var CLOUD_GET = "https://extendsclass.com/api/json-storage/bin/";
var POINTER = "https://ntfy.sh/fenchem-wasilewski-stock";
var PINNED = ["dcdbdfa", "ccafbdb", "eadacac", "ebcabea"];
var cloudTimer = 0;
var cloudBusy = false;
var lastCloudErr = "";
var lastPullAt = 0;
function showCloudErr(msg) {
  lastCloudErr = msg || "";
  var el = document.getElementById("cloud-err");
  if (el) el.textContent = lastCloudErr ? ("Cloud note: " + lastCloudErr) : "";
}
function cloudPayload() {
  return JSON.stringify({
    app: "fenchem-inventory",
    updatedAt: new Date().toISOString(),
    settings: state.settings,
    items: state.items,
    txns: (state.txns || []).slice(0, 300)
  });
}
function applyCloud(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.items)) return false;
  if (!data.items.length && state.items && state.items.length) return false;
  state.settings = Object.assign({}, emptyState().settings, data.settings || state.settings || {});
  state.items = data.items.map(normalizeItem);
  state.txns = data.txns || state.txns || [];
  try {
    localStorage.setItem("scantrack.cache", JSON.stringify(state));
    localStorage.setItem("scantrack.cache.backup", JSON.stringify(state));
  } catch (e) {}
  return true;
}
async function pointerIds() {
  var ids = PINNED.slice();
  try {
    var cached = localStorage.getItem("scantrack.cloudId");
    if (cached) ids.push(cached);
  } catch (e) {}
  try {
    var res = await fetch(POINTER + "/json?poll=1&since=all&t=" + Date.now(), { cache: "no-store" });
    if (res.ok) {
      var txt = await res.text();
      txt.trim().split("\n").forEach(function (line) {
        if (!line) return;
        try {
          var msg = JSON.parse(line);
          if (msg && msg.message) ids.push(String(msg.message).trim());
        } catch (e) {}
      });
    }
  } catch (e) {
    showCloudErr(String(e.message || e));
  }
  var out = [];
  var seen = {};
  ids.forEach(function (id) {
    if (!id || seen[id]) return;
    seen[id] = 1;
    out.push(id);
  });
  return out;
}
async function fetchBin(id) {
  var res = await fetch(CLOUD_GET + id + "?t=" + Date.now(), { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}
async function pullCloud() {
  setSync(false, "Loading cloud...");
  try {
    var ids = await pointerIds();
    var best = null;
    var bestId = "";
    for (var i = 0; i < ids.length; i++) {
      try {
        var data = await fetchBin(ids[i]);
        var n = data && data.items ? data.items.length : 0;
        if (n && (!best || n > best.items.length)) {
          best = data;
          bestId = ids[i];
        }
      } catch (e) {}
    }
    if (best && applyCloud(best)) {
      try { localStorage.setItem("scantrack.cloudId", bestId); } catch (e) {}
      lastPullAt = Date.now();
      setSync(true, "Saved in cloud · " + best.items.length + " materials");
      showCloudErr("");
      if (typeof paint === "function") paint();
      toast("Loaded " + best.items.length + " materials from cloud");
      return true;
    }
    if (restoreLocal()) setSync(true, state.items.length ? ("On this device · " + state.items.length) : "Ready on this device");
    else setSync(true, "Ready on this device");
    toast("Cloud list not found on this network. Stay on the same Wi-Fi as the PC, or use cellular.", true);
    if (typeof paint === "function") paint();
    return false;
  } catch (e) {
    showCloudErr(String(e.message || e));
    if (restoreLocal()) setSync(true, "Offline — using this device");
    else setSync(false, "Cloud blocked on this Wi-Fi");
    toast(String(e.message || e), true);
    if (typeof paint === "function") paint();
    return false;
  }
}
async function pushCloud() {
  if (cloudBusy) return;
  if (!state.items || !state.items.length) return;
  if (Date.now() - lastPullAt < 2000) return;
  cloudBusy = true;
  try {
    var created = await fetch(CLOUD_NEW, { method: "POST", headers: { "Content-Type": "text/plain" }, body: cloudPayload() });
    var body = await created.text();
    var info = {};
    try { info = JSON.parse(body); } catch (e) {}
    var id = info.id || "";
    if (!created.ok || !id) throw new Error("save blocked (" + created.status + ")");
    var ping = await fetch(POINTER, { method: "POST", headers: { "Content-Type": "text/plain" }, body: id });
    if (!ping.ok) throw new Error("index blocked (" + ping.status + ")");
    try { localStorage.setItem("scantrack.cloudId", id); } catch (e) {}
    setSync(true, "Saved in cloud · " + state.items.length + " materials");
    showCloudErr("");
  } catch (e) {
    showCloudErr(String(e.message || e));
    setSync(true, "Saved on this device · " + (state.items.length || 0));
  }
  cloudBusy = false;
}
function clearAllLocal() {
  if (!confirm("Erase every material saved in this phone or computer?")) return;
  ["scantrack.cache", "scantrack.cache.backup", "scantrack.savedAt", "scantrack.cloudId"].forEach(function (k) {
    try { localStorage.removeItem(k); } catch (e) {}
  });
  state = emptyState();
  if (typeof paint === "function") paint();
  setSync(true, "Cleared this device");
  toast("This device is empty. Tap Sync with cloud.");
}
var _persist = persistLocal;
persistLocal = function () {
  _persist();
  if (!state.items || !state.items.length) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(pushCloud, 1200);
};
saveCloud = persistLocal;
loadCloud = pullCloud;
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") pullCloud();
});
setTimeout(function () { try { pullCloud(); } catch (e) {} }, 400);
setTimeout(function () {
  ["js/clear.js?v=1", "js/syncbtn.js?v=1"].forEach(function (src) {
    var s = document.createElement("script");
    s.src = src;
    document.body.appendChild(s);
  });
}, 200);
