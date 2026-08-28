const API = "https://crudcrud.com/api/8a85b75399b8406b8292f8f06db8d602/store";
const DOC_ID = "6a91d371de31d103e89a25fa";
const DOC = API + "/" + DOC_ID;

const emptyState = () => ({
  v: 2,
  settings: { siteName: "Mount Laurel warehouse", operator: "", lowStock: 0 },
  items: [],
  txns: [],
});

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

function fetchTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, Object.assign({}, opts, { signal: ctrl.signal })).finally(function () { clearTimeout(t); });
}
async function loadCloud() {
  setSync(false, "Loading...");
  try {
    const res = await fetchTimeout(DOC, { cache: "no-store" }, 5000);
    if (!res.ok) throw new Error("load");
    const data = await res.json();
    delete data._id;
    state = {
      v: 2,
      settings: Object.assign({}, emptyState().settings, data.settings || {}),
      items: (data.items || []).map(normalizeItem),
      txns: data.txns || [],
    };
    localStorage.setItem("scantrack.cache", JSON.stringify(state));
    setSync(true, "Saved in cloud");
    paint();
  } catch (e) {
    setSync(false, "On this device");
    try {
      const raw = localStorage.getItem("scantrack.cache");
      if (raw) { state = JSON.parse(raw); state.items = (state.items || []).map(normalizeItem); paint(); }
    } catch (err) {}
  }
}

async function saveCloud() {
  localStorage.setItem("scantrack.cache", JSON.stringify(state));
  if (saving) { saveCloud._again = true; return; }
  saving = true;
  setSync(false, "Saving...");
  try {
    const res = await fetchTimeout(DOC, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ v: 2, settings: state.settings, items: state.items, txns: state.txns }),
    }, 8000);
    if (!res.ok) throw new Error("save");
    setSync(true, "Saved in cloud");
  } catch (e) {
    setSync(false, "Saved on this device");
  } finally {
    saving = false;
    if (saveCloud._again) { saveCloud._again = false; saveCloud(); }
  }
}

function uid() {
  return "PLT-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

function normalizeItem(i) {
  return {
    id: i.id || uid(),
    materialNo: i.materialNo || i.sku || "",
    mCode: i.mCode || "",
    description: i.description || i.name || "",
    bay: i.bay || "",
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
    profitCenter: i.profitCenter || "",
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
  document.querySelectorAll(".page").forEach(function (p) { p.classList.remove("on"); });
  document.getElementById("page-" + name).classList.add("on");
  document.querySelectorAll(".tabs button").forEach(function (b) { b.classList.remove("on"); });
  if (btn) btn.classList.add("on");
  else document.querySelector('.tabs button[data-p="' + name + '"]').classList.add("on");
  if (name === "scan") startCam();
  else stopCam();
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
  if (!window.Html5Qrcode) {
    document.getElementById("cam-hint").textContent = "Camera tool did not load. Type the code, or add material without scanning.";
    return;
  }
  scanner = new Html5Qrcode("reader");
  try {
    await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 240, height: 240 } }, onScan, function () {});
    running = true;
    document.getElementById("cam-hint").textContent = "Camera is on. Point it at the pallet QR.";
  } catch (e) {
    running = false;
    document.getElementById("cam-hint").textContent = "Could not start camera. On a PC use Add material or Upload Excel.";
  }
}
async function stopCam() {
  if (scanner && running) {
    try { await scanner.stop(); } catch (e) {}
    try { scanner.clear(); } catch (e) {}
  }
  running = false;
}
function onScan(text) {
  const c = String(text).trim();
  const t = Date.now();
  if (c === lastCode.c && t - lastCode.t < 1600) return;
  lastCode = { c: c, t: t };
  document.getElementById("manual").value = c;
  lookup(c);
}

function findItem(code) {
  const c = String(code || "").trim().toLowerCase();
  if (!c) return null;
  return state.items.find(function (i) { return String(i.id).toLowerCase() === c; })
    || state.items.find(function (i) { return String(i.batchNo).toLowerCase() === c; })
    || state.items.find(function (i) { return String(i.materialNo).toLowerCase() === c; })
    || state.items.find(function (i) { return String(i.mCode).toLowerCase() === c; })
    || state.items.find(function (i) { return String(i.vendorBatch).toLowerCase() === c; });
}

function lookup(code) {
  const c = String(code || "").trim();
  const box = document.getElementById("match");
  if (!c) return;
  const item = findItem(c);
  if (!item) {
    box.innerHTML = "<b>Unknown pallet / material</b><p class='muted' style='margin:8px 0'>" + escapeHtml(c) +
      "</p><button class='gold' onclick='openForm(' + JSON.stringify(c) + ")'>Add as new material</button>";
    return;
  }
  const rem = remainingDays(item);
  const expNote = rem === "" ? "" : (rem < 0 ? "Expired " + Math.abs(rem) + " days" : rem + " days left");
  box.innerHTML =
    "<div class='muted'>" + (mode === "in" ? "Checking IN" : "Checking OUT") + "</div>" +
    "<div class='big'>" + escapeHtml(item.description) + "</div>" +
    "<p class='muted'>Material " + escapeHtml(item.materialNo) +
    (item.mCode ? " | M " + escapeHtml(item.mCode) : "") +
    "<br>Batch " + escapeHtml(item.batchNo) +
    "<br>Bay: <b>" + escapeHtml(item.bay || "not set") + "</b>" +
    (item.location ? " | " + escapeHtml(item.location) : "") +
    "<br>On hand: <b>" + item.qty + " " + escapeHtml(item.unit) + "</b>" +
    (expNote ? " | " + expNote : "") + "</p>" +
    "<label>How much?</label><div class='qty'><button type='button' onclick='nudge(-1)'>-</button>" +
    "<input id='qty' type='number' min='0.01' step='0.01' value='1' />" +
    "<button type='button' onclick='nudge(1)'>+</button></div>" +
    "<label>Bay / location now</label>" +
    "<div class='grid2'><input id='move-bay' value='" + escapeHtml(item.bay || "") + "' placeholder='Bay' />" +
    "<input id='move-loc' value='" + escapeHtml(item.location || "") + "' placeholder='Bin / rack' /></div>" +
    "<label>Note</label><input id='note' placeholder='Who / truck / reason' />" +
    "<div style='height:10px'></div>" +
    "<button class='" + (mode === "in" ? "inbtn" : "outbtn") + "' onclick='confirmMove(\"" + item.id + "\")'>" +
    (mode === "in" ? "Confirm IN" : "Confirm OUT") + "</button>";
}
function nudge(d) {
  const el = document.getElementById("qty");
  el.value = Math.max(0.01, (Number(el.value) || 1) + d);
}
function confirmMove(id) {
  const item = state.items.find(function (i) { return i.id === id; });
  if (!item) return;
  const qty = Math.max(0.01, Number(document.getElementById("qty").value) || 1);
  const note = (document.getElementById("note") || {}).value || "";
  if (mode === "out" && item.qty < qty) { toast("Not enough stock. On hand: " + item.qty + " " + item.unit, true); return; }
  const newBay = (document.getElementById("move-bay") || {}).value;
  const newLoc = (document.getElementById("move-loc") || {}).value;
  if (typeof newBay === "string") item.bay = newBay.trim();
  if (typeof newLoc === "string") item.location = newLoc.trim();
  item.qty = roundQty(item.qty + (mode === "in" ? qty : -qty));
  state.txns.unshift({
    at: new Date().toISOString(), type: mode, itemId: item.id,
    name: item.description, materialNo: item.materialNo, batchNo: item.batchNo,
    qty: qty, unit: item.unit, result: item.qty,
    who: state.settings.operator || "Someone", note: note,
  });
  saveCloud(); paint();
  toast((mode === "in" ? "IN +" : "OUT -") + qty + " " + item.unit + "  " + item.description);
  lookup(item.id);
}
function roundQty(n) { return Math.round(n * 1000) / 1000; }

function openForm(prefill) {
  document.getElementById("modal").classList.add("open");
  document.getElementById("form-title").textContent = "Add material / pallet";
  ["f-id","f-materialNo","f-mCode","f-description","f-bay","f-location","f-locationDesc","f-batchNo","f-vendorBatch","f-poNumber","f-poItem","f-salesName","f-salesDept","f-packaging","f-profitCenter","f-dom","f-exp"].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("f-qty").value = "";
  document.getElementById("f-unit").value = "KG";
  document.getElementById("f-createdOn").value = today();
  if (prefill && typeof prefill === "string") document.getElementById("f-materialNo").value = prefill;
}
function editForm(id) {
  const i = state.items.find(function (x) { return x.id === id; });
  if (!i) return;
  document.getElementById("modal").classList.add("open");
  document.getElementById("form-title").textContent = "Edit material / pallet";
  document.getElementById("f-id").value = i.id;
  document.getElementById("f-materialNo").value = i.materialNo;
  document.getElementById("f-mCode").value = i.mCode;
  document.getElementById("f-description").value = i.description;
  document.getElementById("f-bay").value = i.bay || "";
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
function val(id) { return document.getElementById(id).value.trim(); }

function saveForm() {
  const materialNo = val("f-materialNo");
  const description = val("f-description");
  const batchNo = val("f-batchNo");
  const bay = val("f-bay");
  const qty = Number(document.getElementById("f-qty").value);
  if (!materialNo || !description || !batchNo || !bay || !(qty >= 0)) {
    toast("Need Material No, Description, Batch No, Bay, and Quantity.", true);
    return;
  }
  const rec = {
    id: val("f-id") || uid(),
    materialNo: materialNo, mCode: val("f-mCode"), description: description,
    bay: bay, location: val("f-location"), locationDesc: val("f-locationDesc"),
    batchNo: batchNo, vendorBatch: val("f-vendorBatch"),
    qty: qty, unit: document.getElementById("f-unit").value,
    createdOn: val("f-createdOn") || today(),
    dateOfManufacture: val("f-dom"), expirationDate: val("f-exp"),
    poNumber: val("f-poNumber"), poItem: val("f-poItem"),
    salesName: val("f-salesName"), salesDept: val("f-salesDept"),
    packaging: val("f-packaging"), profitCenter: val("f-profitCenter"),
  };
  const idx = state.items.findIndex(function (x) { return x.id === rec.id; });
  if (idx >= 0) state.items[idx] = rec;
  else state.items.push(rec);
  const wantPrint = document.getElementById("f-print") ? document.getElementById("f-print").checked : true;
  saveCloud(); closeForm(); drawItems(); show("items");
  toast("Saved " + description);
  if (wantPrint) setTimeout(function () { printLabel(rec.id); }, 250);
}

function filteredItems() {
  const q = ((document.getElementById("search") || {}).value || "").toLowerCase();
  const bay = ((document.getElementById("bay-filter") || {}).value || "").toLowerCase();
  const sel = document.getElementById("bay-filter");
  if (sel) {
    const current = sel.value;
    const bays = Array.from(new Set(state.items.map(function (i) { return (i.bay || "").trim(); }).filter(Boolean))).sort();
    sel.innerHTML = "<option value=''>All bays</option>" + bays.map(function (b) {
      return "<option" + (b === current ? " selected" : "") + ">" + escapeHtml(b) + "</option>";
    }).join("");
    if (current && bays.indexOf(current) >= 0) sel.value = current;
  }
  return state.items.filter(function (i) {
    const hay = [i.materialNo, i.mCode, i.description, i.bay, i.location, i.locationDesc, i.batchNo, i.vendorBatch, i.poNumber, i.salesName, i.packaging].join(" ").toLowerCase();
    if (q && hay.indexOf(q) < 0) return false;
    if (bay && String(i.bay || "").toLowerCase() !== bay) return false;
    return true;
  }).sort(function (a, b) { return (a.bay || "").localeCompare(b.bay || "") || (a.description || "").localeCompare(b.description || ""); });
}

function drawItems() {
  const rows = filteredItems();
  const el = document.getElementById("items");
  const sheet = document.getElementById("sheet");
  if (!rows.length) {
    const empty = "<div class='card'>No materials yet. Upload your Excel/CSV or tap + Add material.</div>";
    if (el) el.innerHTML = empty;
    if (sheet) sheet.innerHTML = empty;
    return;
  }
  if (sheet) {
    const cols = ["Bay","Location","Location Description","Material No","M code","English Description","Batch No","Vendor Batch","Quantity","Unit","Created On","Date of Manufacture","Expiration Date","PO Number","PO Item","Remaining days","Stock Age","Sales Name","Sales Department","Packaging","Profit Center",""];
    sheet.innerHTML = "<table><thead><tr>" + cols.map(function (c) { return "<th>" + c + "</th>"; }).join("") + "</tr></thead><tbody>" +
      rows.map(function (i) {
        const cells = [i.bay, i.location, i.locationDesc, i.materialNo, i.mCode, i.description, i.batchNo, i.vendorBatch, i.qty, i.unit, i.createdOn, i.dateOfManufacture, i.expirationDate, i.poNumber, i.poItem, remainingDays(i), stockAge(i), i.salesName, i.salesDept, i.packaging, i.profitCenter];
        return "<tr>" + cells.map(function (c) { return "<td>" + escapeHtml(c == null ? "" : c) + "</td>"; }).join("") +
          "<td><button onclick='printLabel(\"" + i.id + "\")'>QR</button> <button class='ghost' onclick='editForm(\"" + i.id + "\")'>Edit</button></td></tr>";
      }).join("") + "</tbody></table>";
  }
  if (!el) return;
  el.innerHTML = rows.map(function (i) {
    const rem = remainingDays(i);
    let badge = "<span class='badge badge-ok'>In stock</span>";
    if (i.qty <= 0) badge = "<span class='badge badge-low'>Zero</span>";
    else if (rem !== "" && rem < 0) badge = "<span class='badge badge-low'>Expired</span>";
    else if (rem !== "" && rem <= 30) badge = "<span class='badge badge-exp'>" + rem + " days left</span>";
    return "<div class='item'><div class='row' style='align-items:flex-start'><div>" +
      "<b>" + escapeHtml(i.description) + "</b> " + badge +
      "<div class='muted'>Bay <b>" + escapeHtml(i.bay || "-") + "</b>" +
      (i.location ? " | " + escapeHtml(i.location) : "") + "</div>" +
      "<div class='muted'>Mat " + escapeHtml(i.materialNo) + " | Batch " + escapeHtml(i.batchNo) + "</div>" +
      "</div><div class='big'>" + i.qty + "<div class='muted' style='font-size:12px;font-weight:700'>" + escapeHtml(i.unit) + "</div></div></div>" +
      "<div class='actions'><button onclick='printLabel(\"" + i.id + "\")'>Print pallet QR</button>" +
      "<button class='ghost' onclick='editForm(\"" + i.id + "\")'>Edit</button></div></div>";
  }).join("");
}

function printLabel(id) {
  const i = state.items.find(function (x) { return x.id === id; });
  if (!i || !window.QRCode) return toast("Could not make QR. Try again in a few seconds.", true);
  const rem = remainingDays(i);
  QRCode.toDataURL(i.id, { width: 280, margin: 1 }, function (err, url) {
    if (err) return toast("Could not make QR", true);
    const w = window.open("", "_blank");
    if (!w) return toast("Allow pop-ups so the label can print.", true);
    w.document.write("<html><title>Pallet label</title><body style='font-family:Arial;padding:16px'><div style='border:3px solid #0b1f3a;padding:16px;width:380px'>" +
      "<div style='background:#f5c518;color:#0b1f3a;font-weight:800;display:inline-block;padding:5px 8px'>FENCHEM PALLET</div>" +
      "<h1 style='font-size:18px'>" + escapeHtml(i.description) + "</h1>" +
      "<div>Material No: <b>" + escapeHtml(i.materialNo) + "</b></div>" +
      "<div>Batch: <b>" + escapeHtml(i.batchNo) + "</b></div>" +
      "<div>Qty: <b>" + i.qty + " " + escapeHtml(i.unit) + "</b></div>" +
      "<div>Bay: <b>" + escapeHtml(i.bay || "not set") + "</b></div>" +
      (i.expirationDate ? "<div>Expires: <b>" + escapeHtml(i.expirationDate) + "</b> (" + rem + " days)</div>" : "") +
      "<img src='" + url + "' width='220' height='220' style='display:block;margin:14px auto'>" +
      "<div style='text-align:center'>" + escapeHtml(i.id) + "</div></div><script>setTimeout(function(){window.print()},200)<" + "/script></body></html>");
    w.document.close();
  });
}

function drawReport() {
  const exp = state.items.filter(function (i) { const r = remainingDays(i); return r !== "" && r <= 30; });
  const units = state.items.reduce(function (s, i) { return s + (Number(i.qty) || 0); }, 0);
  document.getElementById("stats").innerHTML =
    "<div class='stat'><span class='muted'>Pallets / lots</span><b>" + state.items.length + "</b></div>" +
    "<div class='stat'><span class='muted'>Total qty</span><b>" + roundQty(units) + "</b></div>" +
    "<div class='stat'><span class='muted'>Expiring in 30d</span><b>" + exp.length + "</b></div>";
  document.getElementById("r-exp").innerHTML = exp.length
    ? "<table><thead><tr><th>Material</th><th>Batch</th><th>Bay</th><th>Days</th><th>Qty</th></tr></thead><tbody>" +
      exp.map(function (i) { return "<tr><td>" + escapeHtml(i.description) + "</td><td>" + escapeHtml(i.batchNo) + "</td><td>" + escapeHtml(i.bay) + "</td><td>" + remainingDays(i) + "</td><td>" + i.qty + " " + escapeHtml(i.unit) + "</td></tr>"; }).join("") + "</tbody></table>"
    : "<p class='muted'>Nothing expiring in the next 30 days.</p>";
  document.getElementById("r-hist").innerHTML = state.txns.length
    ? "<table><thead><tr><th>When</th><th></th><th>Material</th><th>Qty</th></tr></thead><tbody>" +
      state.txns.slice(0, 25).map(function (t) { return "<tr><td>" + new Date(t.at).toLocaleString() + "</td><td>" + String(t.type).toUpperCase() + "</td><td>" + escapeHtml(t.name) + "</td><td>" + t.qty + "</td></tr>"; }).join("") + "</tbody></table>"
    : "<p class='muted'>No scans yet.</p>";
}
function printExpiring() { show("report"); drawReport(); window.print(); }
function fillSettings() {
  document.getElementById("operator").value = state.settings.operator || "";
  document.getElementById("sitename").value = state.settings.siteName || "";
}
function saveSettings() {
  state.settings.operator = document.getElementById("operator").value.trim();
  state.settings.siteName = document.getElementById("sitename").value.trim() || "Warehouse";
  saveCloud(); toast("Saved");
}
function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function exportCsv() {
  const header = ["Bay","Location","Location Description","Material No","M code","English Description","Batch No","Vendor Batch","Quantity","Unit","Created On","Date of Manufacture","Expiration Date","PO Number","PO Item","Remaining days","Stock Age","Sales Name","Sales Department","Packaging","Profit Center"];
  const rows = state.items.slice().sort(function (a, b) { return (a.bay || "").localeCompare(b.bay || ""); });
  const lines = [header.join(",")].concat(rows.map(function (i) {
    return [i.bay, i.location, i.locationDesc, i.materialNo, i.mCode, i.description, i.batchNo, i.vendorBatch, i.qty, i.unit, i.createdOn, i.dateOfManufacture, i.expirationDate, i.poNumber, i.poItem, remainingDays(i), stockAge(i), i.salesName, i.salesDept, i.packaging, i.profitCenter].map(csvCell).join(",");
  }));
  download("warehouse-inventory.csv", lines.join("\n"), "text/csv");
}
function exportLocations() { exportCsv(); }
function backup() { download("inventory-backup.json", JSON.stringify(state, null, 2), "application/json"); }
function restoreFile(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = function () {
    try {
      const data = JSON.parse(r.result);
      if (!Array.isArray(data.items)) throw new Error("bad");
      state = { v: 2, settings: Object.assign({}, emptyState().settings, data.settings || {}), items: data.items.map(normalizeItem), txns: data.txns || [] };
      saveCloud(); paint(); toast("Backup restored");
    } catch (e) { toast("That file could not be used.", true); }
  };
  r.readAsText(file);
}
function download(name, content, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: type }));
  a.download = name; a.click();
}
function paint() { fillSettings(); drawItems(); drawReport(); }
function escapeHtml(s) {
  return String(s).replace(/&/g, "&#38;").replace(/</g, "&#60;").replace(/>/g, "&#62;").replace(/"/g, "&#34;").replace(/'/g, "&#39;");
}

function parseCsvText(text) {
  const rows = []; let row = []; let cell = ""; let i = 0; let q = false;
  const s = String(text).replace(/^\uFEFF/, "");
  while (i < s.length) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i += 2; continue; } q = false; i++; continue; }
      cell += ch; i++; continue;
    }
    if (ch === '"') { q = true; i++; continue; }
    if (ch === ",") { row.push(cell); cell = ""; i++; continue; }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(function (x) { return String(x).trim() !== ""; })) rows.push(row);
      row = []; i++; continue;
    }
    cell += ch; i++;
  }
  if (cell !== "" || row.length) { row.push(cell); if (row.some(function (x) { return String(x).trim() !== ""; })) rows.push(row); }
  return rows;
}
function normHeader(h) { return String(h || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function mapRow(headers, values) {
  function get() {
    const names = Array.prototype.slice.call(arguments);
    for (let n = 0; n < names.length; n++) {
      let i = headers.indexOf(names[n]);
      if (i < 0) {
        for (let h = 0; h < headers.length; h++) {
          if (headers[h].indexOf(names[n]) >= 0 && headers[h] !== "location description") { i = h; break; }
        }
      }
      if (i >= 0 && values[i] != null && String(values[i]).trim() !== "") return String(values[i]).trim();
    }
    return "";
  }
  function excelDate(v) {
    if (!v) return "";
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(v)) {
      const p = v.split("/");
      const y = p[2].length === 2 ? "20" + p[2] : p[2];
      return y + "-" + String(p[0]).padStart(2, "0") + "-" + String(p[1]).padStart(2, "0");
    }
    return v;
  }
  return normalizeItem({
    materialNo: get("material no", "sku"),
    mCode: get("m code", "mcode"),
    description: get("english description", "description"),
    bay: get("bay"),
    location: get("location"),
    locationDesc: get("location description"),
    batchNo: get("batch no", "batch"),
    vendorBatch: get("vendor batch"),
    qty: get("quantity", "qty"),
    unit: get("unit"),
    createdOn: excelDate(get("created on")),
    dateOfManufacture: excelDate(get("date of manufacture", "manufacture")),
    expirationDate: excelDate(get("expiration date", "expiry", "expire")),
    poNumber: get("po number", "po no"),
    poItem: get("po item"),
    salesName: get("sales name"),
    salesDept: get("sales department"),
    packaging: get("packaging"),
    profitCenter: get("profit center"),
  });
}
function importTable(rows) {
  if (!rows || rows.length < 2) { toast("No rows found in that file.", true); return; }
  const headers = rows[0].map(normHeader);
  let added = 0, updated = 0, skipped = 0;
  for (let r = 1; r < rows.length; r++) {
    const rec = mapRow(headers, rows[r]);
    if (!rec.materialNo && !rec.description) { skipped++; continue; }
    if (!rec.batchNo) rec.batchNo = rec.vendorBatch || rec.materialNo || uid();
    if (!rec.description) rec.description = rec.materialNo;
    if (!rec.bay) rec.bay = rec.location || "Unassigned";
    const idx = state.items.findIndex(function (x) { return String(x.materialNo) === rec.materialNo && String(x.batchNo) === rec.batchNo; });
    if (idx >= 0) { rec.id = state.items[idx].id; state.items[idx] = rec; updated++; }
    else { rec.id = uid(); state.items.push(rec); added++; }
  }
  saveCloud(); drawItems(); show("items");
  toast("Imported " + added + " new, updated " + updated + (skipped ? ", skipped " + skipped : ""));
}
function importSpreadsheet(file) {
  if (!file) return;
  const name = (file.name || "").toLowerCase();
  if (name.indexOf(".xlsx") >= 0 || name.indexOf(".xls") >= 0) {
    if (!window.XLSX) { toast("Save the Excel file as CSV (File then Save As then CSV) and upload that.", true); return; }
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const wb = XLSX.read(reader.result, { type: "array", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        importTable(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }));
      } catch (e) { toast("Could not read that Excel file. Save it as CSV and try again.", true); }
    };
    reader.readAsArrayBuffer(file);
    return;
  }
  const reader = new FileReader();
  reader.onload = function () {
    try { importTable(parseCsvText(reader.result)); }
    catch (e) { toast("Could not read that file.", true); }
  };
  reader.readAsText(file);
}

function boot() {
  try { loadCloud(); } catch (e) { setSync(false, "Ready"); }
  try { show("scan"); } catch (e) {}
  setInterval(loadCloud, 30000);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
window.addEventListener("beforeunload", stopCam);
