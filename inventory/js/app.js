const API = "https://crudcrud.com/api/8a85b75399b8406b8292f8f06db8d602/store";
const DOC_ID = "6a91d371de31d103e89a25fa";
const DOC = API + "/" + DOC_ID;
const emptyState = () => ({ v: 2, settings: { siteName: "Mount Laurel warehouse", operator: "", lowStock: 0 }, items: [], txns: [] });
let state = emptyState();
let mode = "in";
let scanner = null;
let running = false;
let lastCode = { c: "", t: 0 };
let saving = false;
function toast(msg, err) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast on" + (err ? " err" : "");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("on"), 2800);
}
function setSync(ok, text) {
  document.getElementById("synctxt").textContent = text;
  document.getElementById("dot").className = "dot" + (ok ? " ok" : "");
}
async function loadCloud() {
  setSync(false, "Loading…");
  try {
    const res = await fetch(DOC, { cache: "no-store" });
    if (!res.ok) throw new Error("load");
    const data = await res.json();
    delete data._id;
    state = { v: 2, settings: { ...emptyState().settings, ...(data.settings || {}) }, items: (data.items || []).map(normalizeItem), txns: data.txns || [] };
    localStorage.setItem("scantrack.cache", JSON.stringify(state));
    setSync(true, "Saved in cloud");
    paint();
  } catch {
    setSync(false, "Offline copy");
    try {
      const raw = localStorage.getItem("scantrack.cache");
      if (raw) { state = JSON.parse(raw); state.items = (state.items || []).map(normalizeItem); paint(); }
    } catch {}
  }
}
async function saveCloud() {
  localStorage.setItem("scantrack.cache", JSON.stringify(state));
  if (saving) { saveCloud._again = true; return; }
  saving = true;
  setSync(false, "Saving…");
  try {
    const res = await fetch(DOC, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ v: 2, settings: state.settings, items: state.items, txns: state.txns }) });
    if (!res.ok) throw new Error("save");
    setSync(true, "Saved in cloud");
  } catch {
    setSync(false, "Not saved");
    toast("Could not save. Check internet.", true);
  } finally {
    saving = false;
    if (saveCloud._again) { saveCloud._again = false; saveCloud(); }
  }
}
function uid() { return "PLT-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(); }
function normalizeItem(i) {
  return {
    id: i.id || uid(),
    materialNo: i.materialNo || i.sku || "",
    mCode: i.mCode || "",
    description: i.description || i.name || "",
    location: i.location || "",
    locationDesc: i.locationDesc || "",
    batchNo: i.batchNo || "",
    vendorBatch: i.vendorBatch || "",
    qty: Number(i.qty) || 0,
    unit: i.unit || "KG",
    createdOn: i.createdOn || (i.createdAt ? String(i.createdAt).slice(0, 10) : today()),
    dateOfManufacture: i.dateOfManufacture || "",
    expirationDate: i.expirationDate || "",
    poNumber: i.poNumber || "",
    poItem: i.poItem || "",
    salesName: i.salesName || "",
    salesDept: i.salesDept || "",
    packaging: i.packaging || "",
    profitCenter: i.profitCenter || ""
  };
}
function today() { return new Date().toISOString().slice(0, 10); }
function daysBetween(a, b) {
  if (!a || !b) return "";
  return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
}
function remainingDays(item) { return item.expirationDate ? daysBetween(today(), item.expirationDate) : ""; }
function stockAge(item) {
  const start = item.dateOfManufacture || item.createdOn;
  return start ? daysBetween(start, today()) : "";
}
function show(name, btn) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("on"));
  document.getElementById("page-" + name).classList.add("on");
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.remove("on"));
  if (btn) btn.classList.add("on"); else document.querySelector('.tabs button[data-p="' + name + '"]').classList.add("on");
  if (name === "scan") startCam(); else stopCam();
  if (name === "report") drawReport();
  if (name === "items") drawItems();
  if (name === "more") fillSettings();
}
function setMode(m) {
  mode = m;
  document.getElementById("btn-in").classList.toggle("on", m === "in");
  document.getElementById("btn-out").classList.toggle("on", m === "out");
}
async function startCam() {
  await stopCam();
  document.getElementById("reader").innerHTML = "";
  if (!window.Html5Qrcode) { document.getElementById("cam-hint").textContent = "Camera tool did not load. Type the code instead."; return; }
  scanner = new Html5Qrcode("reader");
  try {
    await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 240, height: 240 } }, onScan, () => {});
    running = true;
    document.getElementById("cam-hint").textContent = "Camera is on. Point it at the pallet QR.";
  } catch {
    running = false;
    document.getElementById("cam-hint").textContent = "Could not start camera. Allow access, or type the code.";
  }
}
async function stopCam() {
  if (scanner && running) { try { await scanner.stop(); } catch {} try { scanner.clear(); } catch {} }
  running = false;
}
function onScan(text) {
  const c = String(text).trim();
  const t = Date.now();
  if (c === lastCode.c && t - lastCode.t < 1600) return;
  lastCode = { c, t };
  document.getElementById("manual").value = c;
  lookup(c);
}
function findItem(code) {
  const c = String(code || "").trim().toLowerCase();
  if (!c) return null;
  return state.items.find((i) => String(i.id).toLowerCase() === c)
    || state.items.find((i) => String(i.batchNo).toLowerCase() === c)
    || state.items.find((i) => String(i.materialNo).toLowerCase() === c)
    || state.items.find((i) => String(i.mCode).toLowerCase() === c)
    || state.items.find((i) => String(i.vendorBatch).toLowerCase() === c);
}
function lookup(code) {
  const c = String(code || "").trim();
  const box = document.getElementById("match");
  if (!c) return;
  const item = findItem(c);
  if (!item) {
    box.innerHTML = "<b>Unknown pallet / material</b><p class='muted' style='margin:8px 0'>" + escapeHtml(c) + "</p><button class='gold' onclick='openForm(' + JSON.stringify(c) + ')'>Add as new material</button>";
    box.innerHTML = "<b>Unknown pallet / material</b><p class='muted' style='margin:8px 0'>" + escapeHtml(c) + "</p><button class='gold' onclick='openForm(" + JSON.stringify(c) + ")'>Add as new material</button>";
    return;
  }
  const rem = remainingDays(item);
  const expNote = rem === "" ? "" : (rem < 0 ? "Expired " + Math.abs(rem) + " days" : rem + " days left");
  box.innerHTML = "<div class='muted'>" + (mode === "in" ? "Checking IN" : "Checking OUT") + "</div><div class='big'>" + escapeHtml(item.description) + "</div><p class='muted'>Material " + escapeHtml(item.materialNo) + (item.mCode ? " · M " + escapeHtml(item.mCode) : "") + "<br>Batch " + escapeHtml(item.batchNo) + (item.location ? " · " + escapeHtml(item.location) : "") + "<br>On hand: <b>" + item.qty + " " + escapeHtml(item.unit) + "</b>" + (expNote ? " · " + expNote : "") + "</p><label>How much?</label><div class='qty'><button type='button' onclick='nudge(-1)'>−</button><input id='qty' type='number' min='0.01' step='0.01' value='1' /><button type='button' onclick='nudge(1)'>+</button></div><label>Note</label><input id='note' placeholder='Who / truck / reason' /><div style='height:10px'></div><button class='" + (mode === "in" ? "inbtn" : "outbtn") + "' onclick='confirmMove(\"" + item.id + "\")'>" + (mode === "in" ? "Confirm IN" : "Confirm OUT") + "</button>";
}
function nudge(d) { const el = document.getElementById("qty"); el.value = Math.max(0.01, (Number(el.value) || 1) + d); }
function confirmMove(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  const qty = Math.max(0.01, Number(document.getElementById("qty").value) || 1);
  const note = (document.getElementById("note") || {}).value || "";
  if (mode === "out" && item.qty < qty) { toast("Not enough stock. On hand: " + item.qty + " " + item.unit, true); return; }
  item.qty = roundQty(item.qty + (mode === "in" ? qty : -qty));
  state.txns.unshift({ at: new Date().toISOString(), type: mode, itemId: item.id, name: item.description, materialNo: item.materialNo, batchNo: item.batchNo, qty, unit: item.unit, result: item.qty, who: state.settings.operator || "Someone", note });
  saveCloud(); paint();
  toast((mode === "in" ? "IN +" : "OUT −") + qty + " " + item.unit + "  " + item.description);
  lookup(item.id);
}
function roundQty(n) { return Math.round(n * 1000) / 1000; }
function openForm(prefill) {
  document.getElementById("modal").classList.add("open");
  document.getElementById("form-title").textContent = "Add material / pallet";
  ["f-id","f-materialNo","f-mCode","f-description","f-location","f-locationDesc","f-batchNo","f-vendorBatch","f-poNumber","f-poItem","f-salesName","f-salesDept","f-packaging","f-profitCenter","f-dom","f-exp"].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ""; });
  document.getElementById("f-qty").value = "";
  document.getElementById("f-unit").value = "KG";
  document.getElementById("f-createdOn").value = today();
  if (prefill && typeof prefill === "string") document.getElementById("f-materialNo").value = prefill;
}
function editForm(id) {
  const i = state.items.find((x) => x.id === id);
  if (!i) return;
  document.getElementById("modal").classList.add("open");
  document.getElementById("form-title").textContent = "Edit material / pallet";
  document.getElementById("f-id").value = i.id;
  document.getElementById("f-materialNo").value = i.materialNo;
  document.getElementById("f-mCode").value = i.mCode;
  document.getElementById("f-description").value = i.description;
  document.getElementById("f-location").value = i.location;
  document.getElementById("f-locationDesc").value = i.locationDesc;
  document.getElementById("f-batchNo").value = i.batchNo;
  document.getElementById("f-vendorBatch").value = i.vendorBatch;
  document.getElementById("f-qty").value = i.qty;
  document.getElementById("f-unit").value = i.unit || "KG";
  document.getElementById("f-createdOn").value = i.createdOn || today();
  document.getElementById("f-dom").value = i.dateOfManufacture;
  document.getElementById("f-exp").value = i.expirationDate;
  document.getElementById("f-poNumber").value = i.poNumber;
  document.getElementById("f-poItem").value = i.poItem;
  document.getElementById("f-salesName").value = i.salesName;
  document.getElementById("f-salesDept").value = i.salesDept;
  document.getElementById("f-packaging").value = i.packaging;
  document.getElementById("f-profitCenter").value = i.profitCenter;
}
function closeForm() { document.getElementById("modal").classList.remove("open"); }
function saveForm() {
  const materialNo = val("f-materialNo");
  const description = val("f-description");
  const batchNo = val("f-batchNo");
  const qty = Number(document.getElementById("f-qty").value);
  if (!materialNo || !description || !batchNo || !(qty >= 0)) { toast("Need Material No, Description, Batch No, and Quantity.", true); return; }
  const rec = { id: val("f-id") || uid(), materialNo, mCode: val("f-mCode"), description, location: val("f-location"), locationDesc: val("f-locationDesc"), batchNo, vendorBatch: val("f-vendorBatch"), qty, unit: document.getElementById("f-unit").value, createdOn: val("f-createdOn") || today(), dateOfManufacture: val("f-dom"), expirationDate: val("f-exp"), poNumber: val("f-poNumber"), poItem: val("f-poItem"), salesName: val("f-salesName"), salesDept: val("f-salesDept"), packaging: val("f-packaging"), profitCenter: val("f-profitCenter") };
  const idx = state.items.findIndex((x) => x.id === rec.id);
  if (idx >= 0) state.items[idx] = rec; else state.items.push(rec);
  saveCloud(); closeForm(); drawItems(); show("items"); toast("Saved " + description);
}
function val(id) { return document.getElementById(id).value.trim(); }
function drawItems() {
  const q = (document.getElementById("search")?.value || "").toLowerCase();
  const rows = state.items.filter((i) => [i.materialNo, i.mCode, i.description, i.location, i.locationDesc, i.batchNo, i.vendorBatch, i.poNumber, i.salesName, i.packaging].join(" ").toLowerCase().includes(q)).sort((a, b) => (a.description || "").localeCompare(b.description || ""));
  const el = document.getElementById("items");
  if (!rows.length) { el.innerHTML = "<div class='card'>No materials yet. Tap <b>+ Add material</b>, then print a pallet QR.</div>"; return; }
  el.innerHTML = rows.map((i) => {
    const rem = remainingDays(i);
    let badge = "<span class='badge badge-ok'>In stock</span>";
    if (i.qty <= 0) badge = "<span class='badge badge-low'>Zero</span>";
    else if (rem !== "" && rem < 0) badge = "<span class='badge badge-low'>Expired</span>";
    else if (rem !== "" && rem <= 30) badge = "<span class='badge badge-exp'>" + rem + " days left</span>";
    return "<div class='item'><div class='row' style='align-items:flex-start'><div><b>" + escapeHtml(i.description) + "</b> " + badge + "<div class='muted'>Mat " + escapeHtml(i.materialNo) + (i.mCode ? " · M " + escapeHtml(i.mCode) : "") + " · Batch " + escapeHtml(i.batchNo) + (i.location ? " · " + escapeHtml(i.location) : "") + "</div>" + (i.poNumber ? "<div class='muted'>PO " + escapeHtml(i.poNumber) + (i.poItem ? " / " + escapeHtml(i.poItem) : "") + "</div>" : "") + "</div><div class='big'>" + i.qty + "<div class='muted' style='font-size:12px;font-weight:700'>" + escapeHtml(i.unit) + "</div></div></div><div class='actions'><button onclick='printLabel(\"" + i.id + "\")'>Print pallet QR</button><button class='ghost' onclick='editForm(\"" + i.id + "\")'>Edit</button><button class='ghost' onclick=\"quick('" + i.id + "','in')\">In</button><button class='ghost' onclick=\"quick('" + i.id + "','out')\">Out</button></div></div>";
  }).join("");
}
function quick(id, type) {
  setMode(type);
  const item = state.items.find((i) => i.id === id);
  const n = Number(prompt((type === "in" ? "Add how much of " : "Remove how much of ") + item.description + " (" + item.unit + ")?", "1"));
  if (!n || n <= 0) return;
  if (type === "out" && item.qty < n) return toast("Not enough stock.", true);
  item.qty = roundQty(item.qty + (type === "in" ? n : -n));
  state.txns.unshift({ at: new Date().toISOString(), type, itemId: item.id, name: item.description, materialNo: item.materialNo, batchNo: item.batchNo, qty: n, unit: item.unit, result: item.qty, who: state.settings.operator || "Someone", note: "typed" });
  saveCloud(); drawItems(); toast("Updated " + item.description);
}
function printLabel(id) {
  const i = state.items.find((x) => x.id === id);
  if (!i || !window.QRCode) return toast("Could not make QR", true);
  const w = window.open("", "_blank");
  const rem = remainingDays(i);
  w.document.write("<!doctype html><title>Pallet label</title><style>body{font-family:Arial,sans-serif;padding:18px;color:#122033}.box{border:3px solid #0b1f3a;padding:16px;width:360px}.h{background:#f5c518;color:#0b1f3a;font-weight:800;letter-spacing:.08em;font-size:12px;padding:4px 8px;display:inline-block}h1{font-size:18px;margin:10px 0 6px}.m{font-size:13px;color:#5b6b7c}canvas{display:block;margin:12px auto}</style><div class='box'><div class='h'>FENCHEM PALLET</div><h1>" + escapeHtml(i.description) + "</h1><div class='m'>Material No: <b>" + escapeHtml(i.materialNo) + "</b></div>" + (i.mCode ? "<div class='m'>M code: <b>" + escapeHtml(i.mCode) + "</b></div>" : "") + "<div class='m'>Batch: <b>" + escapeHtml(i.batchNo) + "</b>" + (i.vendorBatch ? " · Vendor " + escapeHtml(i.vendorBatch) : "") + "</div><div class='m'>Qty: <b>" + i.qty + " " + escapeHtml(i.unit) + "</b>" + (i.packaging ? " · " + escapeHtml(i.packaging) : "") + "</div>" + (i.location ? "<div class='m'>Location: <b>" + escapeHtml(i.location) + "</b> " + escapeHtml(i.locationDesc) + "</div>" : "") + (i.expirationDate ? "<div class='m'>Expires: <b>" + escapeHtml(i.expirationDate) + "</b>" + (rem !== "" ? " (" + rem + " days)</div>" : "</div>") : "") + (i.poNumber ? "<div class='m'>PO: " + escapeHtml(i.poNumber) + (i.poItem ? " / " + escapeHtml(i.poItem) : "") + "</div>" : "") + "<canvas id='c'></canvas><div class='m' style='text-align:center'>" + escapeHtml(i.id) + "</div></div>");
  QRCode.toCanvas(w.document.getElementById("c"), i.id, { width: 220, margin: 1 }, function () { w.print(); });
}
function drawReport() {
  const exp = state.items.filter((i) => { const r = remainingDays(i); return r !== "" && r <= 30; }).sort((a, b) => remainingDays(a) - remainingDays(b));
  const units = state.items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  document.getElementById("stats").innerHTML = "<div class='stat'><span class='muted'>Pallets / lots</span><b>" + state.items.length + "</b></div><div class='stat'><span class='muted'>Total qty</span><b>" + roundQty(units) + "</b></div><div class='stat'><span class='muted'>Expiring ≤30d</span><b>" + exp.length + "</b></div>";
  document.getElementById("r-exp").innerHTML = exp.length ? "<table><thead><tr><th>Material</th><th>Batch</th><th>Days</th><th>Qty</th></tr></thead><tbody>" + exp.map((i) => "<tr><td>" + escapeHtml(i.description) + "<div class='muted'>" + escapeHtml(i.materialNo) + "</div></td><td>" + escapeHtml(i.batchNo) + "</td><td>" + remainingDays(i) + "</td><td>" + i.qty + " " + escapeHtml(i.unit) + "</td></tr>").join("") + "</tbody></table>" : "<p class='muted'>Nothing expiring in the next 30 days.</p>";
  document.getElementById("r-hist").innerHTML = state.txns.length ? "<table><thead><tr><th>When</th><th></th><th>Material</th><th>Qty</th></tr></thead><tbody>" + state.txns.slice(0, 25).map((t) => "<tr><td>" + new Date(t.at).toLocaleString() + "</td><td>" + t.type.toUpperCase() + "</td><td>" + escapeHtml(t.name) + "</td><td>" + t.qty + " " + escapeHtml(t.unit || "") + "</td></tr>").join("") + "</tbody></table>" : "<p class='muted'>No scans yet.</p>";
}
function fillSettings() {
  document.getElementById("operator").value = state.settings.operator || "";
  document.getElementById("sitename").value = state.settings.siteName || "";
}
function saveSettings() {
  state.settings.operator = document.getElementById("operator").value.trim();
  state.settings.siteName = document.getElementById("sitename").value.trim() || "Warehouse";
  saveCloud(); toast("Saved");
}
function exportCsv() {
  const header = ["Material No","M code","English Description","Location","Location Description","Batch No","Vendor Batch","Quantity","Unit","Created On","Date of Manufacture","Expiration Date","PO Number","PO Item","Remaining days","Stock Age","Sales Name","Sales Department","Packaging","Profit Center"];
  const lines = [header.join(",")].concat(state.items.map((i) => [i.materialNo, i.mCode, i.description, i.location, i.locationDesc, i.batchNo, i.vendorBatch, i.qty, i.unit, i.createdOn, i.dateOfManufacture, i.expirationDate, i.poNumber, i.poItem, remainingDays(i), stockAge(i), i.salesName, i.salesDept, i.packaging, i.profitCenter].map(csvCell).join(",")));
  download("warehouse-inventory.csv", lines.join("\n"), "text/csv");
}
function csvCell(v) { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function backup() { download("inventory-backup.json", JSON.stringify(state, null, 2), "application/json"); }
function restoreFile(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!Array.isArray(data.items)) throw new Error("bad");
      state = { v: 2, settings: { ...emptyState().settings, ...(data.settings || {}) }, items: data.items.map(normalizeItem), txns: data.txns || [] };
      saveCloud(); paint(); toast("Backup restored");
    } catch { toast("That file could not be used.", true); }
  };
  r.readAsText(file);
}
function download(name, content, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click(); }
function paint() { fillSettings(); drawItems(); drawReport(); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&", "<": "<", ">": ">", '"': """, "'": "&#39;" }[c])); }
document.addEventListener("DOMContentLoaded", () => { loadCloud(); show("scan"); setInterval(loadCloud, 20000); });
window.addEventListener("beforeunload", stopCam);
