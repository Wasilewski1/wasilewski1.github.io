var CLOUD_NEW = "https://extendsclass.com/api/json-storage/bin";
var CLOUD_GET = "https://extendsclass.com/api/json-storage/bin/";
var POINTER = "https://ntfy.sh/fenchem-wasilewski-stock";
var GH_STOCK = "stock.json";
var cloudTimer = 0;
var cloudBusy = false;
var lastCloudErr = "";
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
  state.settings = Object.assign({}, emptyState().settings, data.settings || state.settings || {});
  state.items = data.items.map(normalizeItem);
  state.txns = data.txns || [];
  try {
    localStorage.setItem("scantrack.cache", JSON.stringify(state));
    localStorage.setItem("scantrack.cache.backup", JSON.stringify(state));
  } catch (e) {}
  return true;
}
async function latestCloudId() {
  var cached = "";
  try { cached = localStorage.getItem("scantrack.cloudId") || ""; } catch (e) {}
  try {
    var res = await fetch(POINTER + "/json?poll=1&since=all&t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("pointer " + res.status);
    var txt = await res.text();
    var lines = txt.trim().split("\n").filter(Boolean);
    for (var i = lines.length - 1; i >= 0; i--) {
      try {
        var msg = JSON.parse(lines[i]);
        if (msg && msg.message) return String(msg.message).trim();
      } catch (e) {}
    }
  } catch (e) {
    showCloudErr(String(e.message || e));
  }
  return cached;
}
async function pullCloud() {
  setSync(false, "Loading cloud...");
  try {
    var id = await latestCloudId();
    if (id) {
      var res = await fetch(CLOUD_GET + id + "?t=" + Date.now(), { cache: "no-store" });
      if (res.ok) {
        var data = await res.json();
        if (applyCloud(data)) {
          try { localStorage.setItem("scantrack.cloudId", id); } catch (e) {}
          setSync(true, "Saved in cloud");
          showCloudErr("");
          if (typeof paint === "function") paint();
          return true;
        }
      }
    }
    try {
      var localCopy = await fetch(GH_STOCK + "?t=" + Date.now(), { cache: "no-store" });
      if (localCopy.ok) {
        var gh = await localCopy.json();
        if (applyCloud(gh)) {
          setSync(true, "Loaded warehouse copy");
          if (typeof paint === "function") paint();
          return true;
        }
      }
    } catch (e) {}
    if (restoreLocal()) setSync(true, state.items.length ? "Saved on this device" : "Ready on this device");
    else setSync(true, "Ready on this device");
    if (typeof paint === "function") paint();
    return false;
  } catch (e) {
    showCloudErr(String(e.message || e));
    if (restoreLocal()) setSync(true, "Offline — using this device");
    else setSync(false, "Cloud blocked on this Wi-Fi");
    if (typeof paint === "function") paint();
    return false;
  }
}
async function pushCloud() {
  if (cloudBusy) return;
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
    setSync(true, "Saved in cloud");
    showCloudErr("");
  } catch (e) {
    showCloudErr(String(e.message || e));
    setSync(true, "Saved on this device");
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
  toast("This device is empty.");
}
var _persist = persistLocal;
persistLocal = function () {
  _persist();
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(pushCloud, 800);
};
saveCloud = persistLocal;
loadCloud = pullCloud;
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") pullCloud();
});
setTimeout(function () { try { pullCloud(); } catch (e) {} }, 500);
setTimeout(function () {
  var s = document.createElement("script");
  s.src = "js/clear.js?v=1";
  document.body.appendChild(s);
}, 200);
