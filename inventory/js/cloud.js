var CLOUD = "https://extendsclass.com/api/json-storage/bin/cbffefc";
var cloudTimer = 0;
var cloudBusy = false;
function cloudPayload() {
  return JSON.stringify({
    app: "fenchem-inventory",
    updatedAt: new Date().toISOString(),
    settings: state.settings,
    items: state.items,
    txns: state.txns.slice(0, 300)
  });
}
function applyCloud(data) {
  if (!data || typeof data !== "object") return false;
  state.settings = Object.assign({}, emptyState().settings, data.settings || state.settings || {});
  state.items = (data.items || []).map(normalizeItem);
  state.txns = data.txns || [];
  try {
    localStorage.setItem("scantrack.cache", JSON.stringify(state));
    localStorage.setItem("scantrack.cache.backup", JSON.stringify(state));
    localStorage.setItem("scantrack.savedAt", data.updatedAt || new Date().toISOString());
  } catch (e) {}
  return true;
}
async function pullCloud() {
  setSync(false, "Loading cloud...");
  try {
    var res = await fetch(CLOUD + "?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("cloud " + res.status);
    var data = await res.json();
    if (data && Array.isArray(data.items)) {
      var localCount = (state.items || []).length;
      var cloudCount = data.items.length;
      if (cloudCount >= localCount || !localCount) applyCloud(data);
      else applyCloud(data);
      setSync(true, "Saved in cloud");
      if (typeof paint === "function") paint();
      return true;
    }
    setSync(true, "Cloud empty — using this device");
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
    var res = await fetch(CLOUD, {
      method: "PUT",
      headers: { "Content-Type": "text/plain", "Accept": "application/json" },
      body: cloudPayload()
    });
    if (res.ok) setSync(true, "Saved in cloud");
    else setSync(true, "Saved on this device");
  } catch (e) {
    setSync(true, "Saved on this device");
  }
  cloudBusy = false;
}
var _persist = persistLocal;
persistLocal = function () {
  _persist();
  setSync(true, "Saving to cloud...");
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(pushCloud, 400);
};
saveCloud = persistLocal;
loadCloud = function () {
  restoreLocal();
  pullCloud();
};
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") pullCloud();
  else persistLocal();
});
