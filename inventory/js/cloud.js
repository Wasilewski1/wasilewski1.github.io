var CLOUD_NEW = "https://extendsclass.com/api/json-storage/bin";
var CLOUD_GET = "https://extendsclass.com/api/json-storage/bin/";
var POINTER = "https://ntfy.sh/fenchem-wasilewski-stock";
var cloudTimer = 0;
var cloudBusy = false;
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
  if (!data || typeof data !== "object") return false;
  if (!Array.isArray(data.items)) return false;
  state.settings = Object.assign({}, emptyState().settings, data.settings || state.settings || {});
  state.items = data.items.map(normalizeItem);
  state.txns = data.txns || [];
  try {
    localStorage.setItem("scantrack.cache", JSON.stringify(state));
    localStorage.setItem("scantrack.cache.backup", JSON.stringify(state));
    localStorage.setItem("scantrack.savedAt", data.updatedAt || new Date().toISOString());
  } catch (e) {}
  return true;
}
async function latestCloudId() {
  var cached = "";
  try { cached = localStorage.getItem("scantrack.cloudId") || ""; } catch (e) {}
  try {
    var res = await fetch(POINTER + "/json?poll=1&since=all&t=" + Date.now(), { cache: "no-store" });
    var txt = await res.text();
    var lines = txt.trim().split("\n").filter(Boolean);
    for (var i = lines.length - 1; i >= 0; i--) {
      try {
        var msg = JSON.parse(lines[i]);
        if (msg && msg.message) return String(msg.message).trim();
      } catch (e) {}
    }
  } catch (e) {}
  return cached;
}
async function pullCloud() {
  setSync(false, "Loading cloud...");
  try {
    var id = await latestCloudId();
    if (!id) {
      if (restoreLocal()) setSync(true, state.items.length ? "Saved on this device" : "Ready on this device");
      else setSync(true, "Ready on this device");
      if (typeof paint === "function") paint();
      return false;
    }
    var res = await fetch(CLOUD_GET + id + "?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("get " + res.status);
    var data = await res.json();
    if (applyCloud(data)) {
      try { localStorage.setItem("scantrack.cloudId", id); } catch (e) {}
      setSync(true, "Saved in cloud");
      if (typeof paint === "function") paint();
      return true;
    }
    setSync(true, "Cloud empty");
    return false;
  } catch (e) {
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
    if (!created.ok || !id) throw new Error("create failed");
    await fetch(POINTER, { method: "POST", headers: { "Content-Type": "text/plain" }, body: id });
    try { localStorage.setItem("scantrack.cloudId", id); } catch (e) {}
    setSync(true, "Saved in cloud");
  } catch (e) {
    setSync(true, "Saved on this device");
  }
  cloudBusy = false;
}
var _persist = persistLocal;
persistLocal = function () {
  _persist();
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(pushCloud, 500);
};
saveCloud = persistLocal;
loadCloud = pullCloud;
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") pullCloud();
});
setTimeout(function () { try { pullCloud(); } catch (e) {} }, 400);
