var emptyState = function () { return { v: 2, settings: { siteName: "Mount Laurel warehouse", operator: "", lowStock: 0 }, items: [], txns: [] }; };
var state = emptyState();
var mode = "in";
var running = false;
var lastCode = { c: "", t: 0 };
function toast(msg, err) {
  var el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.className = "toast on" + (err ? " err" : "");
  clearTimeout(toast._t);
  toast._t = setTimeout(function () { el.classList.remove("on"); }, 2800);
}
function setSync(ok, text) {
  var t = document.getElementById("synctxt");
  var d = document.getElementById("dot");
  if (t) t.textContent = text;
  if (d) d.className = "dot" + (ok ? " ok" : "");
}
function persistLocal() {
  try {
    var raw = JSON.stringify(state);
    localStorage.setItem("scantrack.cache", raw);
    localStorage.setItem("scantrack.cache.backup", raw);
    localStorage.setItem("scantrack.savedAt", new Date().toISOString());
    setSync(true, "Saved on this device");
  } catch (e) {}
}
function restoreLocal() {
  try {
    var raw = localStorage.getItem("scantrack.cache") || localStorage.getItem("scantrack.cache.backup");
    if (!raw) return false;
    var data = JSON.parse(raw);
    state = { v: 2, settings: Object.assign({}, emptyState().settings, data.settings || {}), items: (data.items || []).map(normalizeItem), txns: data.txns || [] };
    return true;
  } catch (e) { return false; }
}
function saveCloud() { persistLocal(); }
function loadCloud() {
  if (restoreLocal()) { setSync(true, "Saved on this device"); paint(); }
  else setSync(true, "Ready on this device");
}
function uid() { return "PLT-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(); }
function today() { return new Date().toISOString().slice(0, 10); }
function daysBetween(a, b) { if (!a || !b) return ""; return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000); }
function remainingDays(item) { return item.expirationDate ? daysBetween(today(), item.expirationDate) : ""; }
function stockAge(item) { var start = item.dateOfManufacture || item.createdOn; return start ? daysBetween(start, today()) : ""; }
function roundQty(n) { return Math.round(n * 1000) / 1000; }
function normalizeItem(i) {
  return { id: i.id || uid(), materialNo: i.materialNo || i.sku || "", mCode: i.mCode || "", description: i.description || i.name || "", bay: i.bay || "", location: i.location || "", locationDesc: i.locationDesc || "", batchNo: i.batchNo || "", vendorBatch: i.vendorBatch || "", qty: Number(i.qty) || 0, unit: i.unit || "KG", createdOn: i.createdOn || (i.createdAt ? String(i.createdAt).slice(0, 10) : today()), dateOfManufacture: i.dateOfManufacture || "", expirationDate: i.expirationDate || "", poNumber: i.poNumber || "", poItem: i.poItem || "", salesName: i.salesName || "", salesDept: i.salesDept || "", packaging: i.packaging || "", profitCenter: i.profitCenter || "" };
}
function escapeHtml(s) { return String(s).replace(/&/g, "&#38;").replace(/</g, "&#60;").replace(/>/g, "&#62;").replace(/"/g, "&#34;").replace(/'/g, "&#39;"); }
function show(name, btn) {
  document.querySelectorAll(".page").forEach(function (p) { p.classList.remove("on"); });
  document.getElementById("page-" + name).classList.add("on");
  document.querySelectorAll(".tabs button").forEach(function (b) { b.classList.remove("on"); });
  if (btn) btn.classList.add("on"); else document.querySelector('.tabs button[data-p="' + name + '"]').classList.add("on");
  if (name !== "scan" && window.stopCam) stopCam();
  if (name === "report") drawReport();
  if (name === "items") drawItems();
  if (name === "more") fillSettings();
}
function setMode(m) {
  mode = m;
  document.getElementById("btn-in").classList.toggle("on", m === "in");
  document.getElementById("btn-out").classList.toggle("on", m === "out");
}
function onScan(text) {
  var c = String(text).trim(); var t = Date.now();
  if (c === lastCode.c && t - lastCode.t < 1600) return;
  lastCode = { c: c, t: t };
  document.getElementById("manual").value = c;
  lookup(c);
}
function findItem(code) {
  var c = String(code || "").trim().toLowerCase();
  if (!c) return null;
  return state.items.find(function (i) { return String(i.id).toLowerCase() === c; }) || state.items.find(function (i) { return String(i.batchNo).toLowerCase() === c; }) || state.items.find(function (i) { return String(i.materialNo).toLowerCase() === c; }) || state.items.find(function (i) { return String(i.mCode).toLowerCase() === c; });
}
function lookup(code) {
  var c = String(code || "").trim();
  var box = document.getElementById("match");
  if (!c || !box) return;
  var item = findItem(c);
  if (!item) {
    box.innerHTML = "<b>Unknown</b><p class='muted'>" + escapeHtml(c) + "</p><button class='gold' onclick='openForm()'>Add as new material</button>";
    return;
  }
  box.innerHTML = "<div class='muted'>" + (mode === "in" ? "Checking IN" : "Checking OUT") + "</div><div class='big'>" + escapeHtml(item.description) + "</div><p class='muted'>Material " + escapeHtml(item.materialNo) + "<br>Batch " + escapeHtml(item.batchNo) + "<br>Bay: <b>" + escapeHtml(item.bay || "not set") + "</b><br>On hand: <b>" + item.qty + " " + escapeHtml(item.unit) + "</b></p><label>How much?</label><div class='qty'><button type='button' onclick='nudge(-1)'>-</button><input id='qty' type='number' min='0.01' step='0.01' value='1' /><button type='button' onclick='nudge(1)'>+</button></div><label>Bay now</label><div class='grid2'><input id='move-bay' value='" + escapeHtml(item.bay || "") + "' /><input id='move-loc' value='" + escapeHtml(item.location || "") + "' /></div><label>Note</label><input id='note' /><div style='height:10px'></div><button class='" + (mode === "in" ? "inbtn" : "outbtn") + "' onclick='confirmMove(\"" + item.id + "\")'>" + (mode === "in" ? "Confirm IN" : "Confirm OUT") + "</button>";
}
function nudge(d) { var el = document.getElementById("qty"); el.value = Math.max(0.01, (Number(el.value) || 1) + d); }
function confirmMove(id) {
  var item = state.items.find(function (i) { return i.id === id; });
  if (!item) return;
  var qty = Math.max(0.01, Number(document.getElementById("qty").value) || 1);
  var note = (document.getElementById("note") || {}).value || "";
  if (mode === "out" && item.qty < qty) { toast("Not enough stock.", true); return; }
  var newBay = (document.getElementById("move-bay") || {}).value;
  var newLoc = (document.getElementById("move-loc") || {}).value;
  if (typeof newBay === "string") item.bay = newBay.trim();
  if (typeof newLoc === "string") item.location = newLoc.trim();
  item.qty = roundQty(item.qty + (mode === "in" ? qty : -qty));
  state.txns.unshift({ at: new Date().toISOString(), type: mode, itemId: item.id, name: item.description, materialNo: item.materialNo, batchNo: item.batchNo, qty: qty, unit: item.unit, result: item.qty, who: state.settings.operator || "Someone", note: note });
  persistLocal(); paint();
  toast((mode === "in" ? "IN +" : "OUT -") + qty + " " + item.unit);
  lookup(item.id);
}
