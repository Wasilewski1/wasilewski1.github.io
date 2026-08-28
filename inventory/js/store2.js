function openForm(prefill) {
  document.getElementById("modal").classList.add("open");
  document.getElementById("form-title").textContent = "Add material / pallet";
  ["f-id","f-materialNo","f-mCode","f-description","f-bay","f-location","f-locationDesc","f-batchNo","f-vendorBatch","f-poNumber","f-poItem","f-salesName","f-salesDept","f-packaging","f-profitCenter","f-dom","f-exp"].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ""; });
  document.getElementById("f-qty").value = "";
  document.getElementById("f-unit").value = "KG";
  document.getElementById("f-createdOn").value = today();
  if (document.getElementById("f-site")) document.getElementById("f-site").value = currentSite();
  if (prefill && typeof prefill === "string") document.getElementById("f-materialNo").value = prefill;
}
function editForm(id) {
  var i = state.items.find(function (x) { return x.id === id; }); if (!i) return;
  document.getElementById("modal").classList.add("open");
  document.getElementById("form-title").textContent = "Edit material / pallet";
  document.getElementById("f-id").value = i.id;
  document.getElementById("f-materialNo").value = i.materialNo;
  document.getElementById("f-mCode").value = i.mCode;
  document.getElementById("f-description").value = i.description;
  if (document.getElementById("f-site")) document.getElementById("f-site").value = i.site || currentSite();
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
  var materialNo = val("f-materialNo"); var description = val("f-description"); var batchNo = val("f-batchNo"); var bay = val("f-bay"); var qty = Number(document.getElementById("f-qty").value);
  if (!materialNo || !description || !batchNo || !bay || !(qty >= 0)) { toast("Need Material No, Description, Batch No, Bay, and Quantity.", true); return; }
  var rec = { id: val("f-id") || uid(), site: val("f-site") || currentSite(), materialNo: materialNo, mCode: val("f-mCode"), description: description, bay: bay, location: val("f-location"), locationDesc: val("f-locationDesc"), batchNo: batchNo, vendorBatch: val("f-vendorBatch"), qty: qty, unit: document.getElementById("f-unit").value, createdOn: val("f-createdOn") || today(), dateOfManufacture: val("f-dom"), expirationDate: val("f-exp"), poNumber: val("f-poNumber"), poItem: val("f-poItem"), salesName: val("f-salesName"), salesDept: val("f-salesDept"), packaging: val("f-packaging"), profitCenter: val("f-profitCenter") };
  var idx = state.items.findIndex(function (x) { return x.id === rec.id; });
  if (idx >= 0) state.items[idx] = rec; else state.items.push(rec);
  var wantPrint = document.getElementById("f-print") ? document.getElementById("f-print").checked : true;
  persistLocal(); closeForm(); drawItems(); show("items"); toast("Saved " + description);
  if (wantPrint) setTimeout(function () { printLabel(rec.id); }, 250);
}
function filteredItems() {
  var q = ((document.getElementById("search") || {}).value || "").toLowerCase();
  var site = ((document.getElementById("site-filter") || {}).value || "");
  var bay = ((document.getElementById("bay-filter") || {}).value || "").toLowerCase();
  var sel = document.getElementById("bay-filter");
  if (sel) {
    var current = sel.value;
    var bays = Array.from(new Set(state.items.map(function (i) { return (i.bay || "").trim(); }).filter(Boolean))).sort();
    sel.innerHTML = "<option value=''>All bays</option>" + bays.map(function (b) { return "<option" + (b === current ? " selected" : "") + ">" + escapeHtml(b) + "</option>"; }).join("");
    if (current && bays.indexOf(current) >= 0) sel.value = current;
  }
  return state.items.filter(function (i) {
    var hay = [i.site, i.materialNo, i.mCode, i.description, i.bay, i.location, i.batchNo, i.vendorBatch, i.poNumber].join(" ").toLowerCase();
    if (q && hay.indexOf(q) < 0) return false;
    if (site && String(i.site || "") !== site) return false;
    if (bay && String(i.bay || "").toLowerCase() !== bay) return false;
    return true;
  }).sort(function (a, b) { return (a.site || "").localeCompare(b.site || "") || (a.bay || "").localeCompare(b.bay || "") || (a.description || "").localeCompare(b.description || ""); });
}
function drawItems() {
  var rows = filteredItems();
  var el = document.getElementById("items");
  var sheet = document.getElementById("sheet");
  if (!rows.length) {
    var empty = "<div class='card'>No materials yet. Upload Excel/CSV or tap + Add material.</div>";
    if (el) el.innerHTML = empty; if (sheet) sheet.innerHTML = empty; return;
  }
  if (sheet) {
    var cols = ["Site","Bay","Location","Material No","M code","English Description","Batch No","Vendor Batch","Quantity","Unit","Expiration Date","PO Number","Remaining days","Packaging",""];
    sheet.innerHTML = "<table><thead><tr>" + cols.map(function (c) { return "<th>" + c + "</th>"; }).join("") + "</tr></thead><tbody>" + rows.map(function (i) {
      return "<tr><td>" + escapeHtml(i.site) + "</td><td>" + escapeHtml(i.bay) + "</td><td>" + escapeHtml(i.location) + "</td><td>" + escapeHtml(i.materialNo) + "</td><td>" + escapeHtml(i.mCode) + "</td><td>" + escapeHtml(i.description) + "</td><td>" + escapeHtml(i.batchNo) + "</td><td>" + escapeHtml(i.vendorBatch) + "</td><td>" + i.qty + "</td><td>" + escapeHtml(i.unit) + "</td><td>" + escapeHtml(i.expirationDate) + "</td><td>" + escapeHtml(i.poNumber) + "</td><td>" + remainingDays(i) + "</td><td>" + escapeHtml(i.packaging) + "</td><td><button onclick='printLabel(\"" + i.id + "\")'>QR</button> <button class='ghost' onclick='editForm(\"" + i.id + "\")'>Edit</button></td></tr>";
    }).join("") + "</tbody></table>";
  }
  if (!el) return;
  el.innerHTML = rows.map(function (i) {
    return "<div class='item'><b>" + escapeHtml(i.description) + "</b><div class='muted'>Site <b>" + escapeHtml(i.site || "-") + "</b> | Bay <b>" + escapeHtml(i.bay || "-") + "</b> | Mat " + escapeHtml(i.materialNo) + " | Batch " + escapeHtml(i.batchNo) + "</div><div class='big'>" + i.qty + " " + escapeHtml(i.unit) + "</div><div class='actions'><button onclick='printLabel(\"" + i.id + "\")'>Print pallet QR</button><button class='ghost' onclick='editForm(\"" + i.id + "\")'>Edit</button></div></div>";
  }).join("");
}
function printLabel(id) {
  var i = state.items.find(function (x) { return x.id === id; });
  if (!i) return;
  if (!window.QRCode) return toast("QR tool did not load. Refresh and try again.", true);
  var hold = document.createElement("div");
  hold.style.position = "fixed"; hold.style.left = "-9999px";
  document.body.appendChild(hold);
  new QRCode(hold, { text: i.id, width: 220, height: 220 });
  setTimeout(function () {
    var img = hold.querySelector("img");
    var canvas = hold.querySelector("canvas");
    var url = img && img.src ? img.src : (canvas ? canvas.toDataURL("image/png") : null);
    hold.remove();
    if (!url) return toast("Could not make QR", true);
    var w = window.open("", "_blank");
    if (!w) return toast("Allow pop-ups so the label can print.", true);
    w.document.write("<html><body style='font-family:Arial;padding:16px'><div style='border:3px solid #0b1f3a;padding:16px;width:380px'><div style='background:#f5c518;font-weight:800;display:inline-block;padding:5px 8px'>FENCHEM PALLET</div><h1>" + escapeHtml(i.description) + "</h1><div>Site: <b>" + escapeHtml(i.site || "") + "</b></div><div>Material: <b>" + escapeHtml(i.materialNo) + "</b></div><div>Batch: <b>" + escapeHtml(i.batchNo) + "</b></div><div>Qty: <b>" + i.qty + " " + escapeHtml(i.unit) + "</b></div><div>Bay: <b>" + escapeHtml(i.bay || "not set") + "</b></div><img src='" + url + "' width='220'><div style='text-align:center'>" + escapeHtml(i.id) + "</div></div></body></html>");
    w.document.close();
    setTimeout(function () { try { w.print(); } catch (e) {} }, 250);
  }, 80);
}
function drawReport() {
  var exp = state.items.filter(function (i) { var r = remainingDays(i); return r !== "" && r <= 30; });
  var units = state.items.reduce(function (s, i) { return s + (Number(i.qty) || 0); }, 0);
  var stats = document.getElementById("stats");
  if (stats) stats.innerHTML = "<div class='stat'><span class='muted'>Pallets / lots</span><b>" + state.items.length + "</b></div><div class='stat'><span class='muted'>Total qty</span><b>" + roundQty(units) + "</b></div><div class='stat'><span class='muted'>Expiring in 30d</span><b>" + exp.length + "</b></div>";
  var re = document.getElementById("r-exp");
  if (re) re.innerHTML = exp.length ? "<table><thead><tr><th>Site</th><th>Material</th><th>Batch</th><th>Bay</th><th>Days</th></tr></thead><tbody>" + exp.map(function (i) { return "<tr><td>" + escapeHtml(i.site) + "</td><td>" + escapeHtml(i.description) + "</td><td>" + escapeHtml(i.batchNo) + "</td><td>" + escapeHtml(i.bay) + "</td><td>" + remainingDays(i) + "</td></tr>"; }).join("") + "</tbody></table>" : "<p class='muted'>Nothing expiring in the next 30 days.</p>";
  var rh = document.getElementById("r-hist");
  if (rh) rh.innerHTML = state.txns.length ? "<table><thead><tr><th>When</th><th></th><th>Material</th><th>Qty</th></tr></thead><tbody>" + state.txns.slice(0, 25).map(function (t) { return "<tr><td>" + new Date(t.at).toLocaleString() + "</td><td>" + String(t.type).toUpperCase() + "</td><td>" + escapeHtml(t.name) + "</td><td>" + t.qty + "</td></tr>"; }).join("") + "</tbody></table>" : "<p class='muted'>No scans yet.</p>";
}
function printExpiring() { show("report"); drawReport(); window.print(); }
function fillSettings() {
  if (document.getElementById("operator")) document.getElementById("operator").value = state.settings.operator || "";
  var siteEl = document.getElementById("sitename");
  if (siteEl) siteEl.value = currentSite();
  ["import-site","f-site"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el && !el.value) el.value = currentSite();
  });
}
function saveSettings() {
  state.settings.operator = document.getElementById("operator").value.trim();
  state.settings.siteName = document.getElementById("sitename").value.trim() || "Mount Laurel";
  persistLocal(); toast("Saved");
}
function csvCell(v) { var s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function exportCsv() {
  var header = ["Site","Bay","Location","Location Description","Material No","M code","English Description","Batch No","Vendor Batch","Quantity","Unit","Created On","Date of Manufacture","Expiration Date","PO Number","PO Item","Remaining days","Stock Age","Sales Name","Sales Department","Packaging","Profit Center"];
  var rows = state.items.slice().sort(function (a, b) { return (a.site || "").localeCompare(b.site || "") || (a.bay || "").localeCompare(b.bay || ""); });
  download("warehouse-inventory.csv", [header.join(",")].concat(rows.map(function (i) { return [i.site, i.bay, i.location, i.locationDesc, i.materialNo, i.mCode, i.description, i.batchNo, i.vendorBatch, i.qty, i.unit, i.createdOn, i.dateOfManufacture, i.expirationDate, i.poNumber, i.poItem, remainingDays(i), stockAge(i), i.salesName, i.salesDept, i.packaging, i.profitCenter].map(csvCell).join(","); })).join("\n"), "text/csv");
}
function backup() { download("inventory-backup.json", JSON.stringify(state, null, 2), "application/json"); }
function restoreFile(file) {
  if (!file) return;
  var r = new FileReader();
  r.onload = function () {
    try {
      var data = JSON.parse(r.result);
      if (!Array.isArray(data.items)) throw new Error("bad");
      state = { v: 2, settings: Object.assign({}, emptyState().settings, data.settings || {}), items: data.items.map(normalizeItem), txns: data.txns || [] };
      persistLocal(); paint(); toast("Backup restored");
    } catch (e) { toast("That file could not be used.", true); }
  };
  r.readAsText(file);
}
function download(name, content, type) { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type: type })); a.download = name; a.click(); }
function paint() { fillSettings(); drawItems(); drawReport(); }
function parseCsvText(text) {
  var rows = []; var row = []; var cell = ""; var i = 0; var q = false;
  var s = String(text).replace(/^\uFEFF/, "");
  while (i < s.length) {
    var ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i += 2; continue; } q = false; i++; continue; } cell += ch; i++; continue; }
    if (ch === '"') { q = true; i++; continue; }
    if (ch === ",") { row.push(cell); cell = ""; i++; continue; }
    if (ch === "\n" || ch === "\r") { if (ch === "\r" && s[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some(function (x) { return String(x).trim() !== ""; })) rows.push(row); row = []; i++; continue; }
    cell += ch; i++;
  }
  if (cell !== "" || row.length) { row.push(cell); if (row.some(function (x) { return String(x).trim() !== ""; })) rows.push(row); }
  return rows;
}
function normHeader(h) { return String(h || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function mapRow(headers, values) {
  function get() {
    var names = Array.prototype.slice.call(arguments);
    for (var n = 0; n < names.length; n++) {
      var i = headers.indexOf(names[n]);
      if (i < 0) { for (var h = 0; h < headers.length; h++) { if (headers[h].indexOf(names[n]) >= 0 && headers[h] !== "location description") { i = h; break; } } }
      if (i >= 0 && values[i] != null && String(values[i]).trim() !== "") return String(values[i]).trim();
    }
    return "";
  }
  function excelDate(v) { if (!v) return ""; if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10); return v; }
  return normalizeItem({ site: get("site", "warehouse", "plant", "warehouse site"), materialNo: get("material no", "sku"), mCode: get("m code"), description: get("english description", "description"), bay: get("bay"), location: get("location"), locationDesc: get("location description"), batchNo: get("batch no", "batch"), vendorBatch: get("vendor batch"), qty: get("quantity", "qty"), unit: get("unit"), createdOn: excelDate(get("created on")), dateOfManufacture: excelDate(get("date of manufacture")), expirationDate: excelDate(get("expiration date", "expiry")), poNumber: get("po number"), poItem: get("po item"), salesName: get("sales name"), salesDept: get("sales department"), packaging: get("packaging"), profitCenter: get("profit center") });
}
function importTable(rows) {
  if (!rows || rows.length < 2) { toast("No rows found in that file.", true); return; }
  var headers = rows[0].map(normHeader);
  var added = 0, updated = 0, skipped = 0;
  for (var r = 1; r < rows.length; r++) {
    var rec = mapRow(headers, rows[r]);
    if (!rec.materialNo && !rec.description) { skipped++; continue; }
    if (!rec.batchNo) rec.batchNo = rec.vendorBatch || rec.materialNo || uid();
    if (!rec.description) rec.description = rec.materialNo;
    if (!rec.bay) rec.bay = rec.location || "Unassigned";
    if (!rec.site) {
      var pick = ((document.getElementById("import-site") || {}).value) || currentSite();
      rec.site = normSite(pick) || currentSite();
    }
    var idx = state.items.findIndex(function (x) { return String(x.materialNo) === rec.materialNo && String(x.batchNo) === rec.batchNo && String(x.site || "") === String(rec.site || ""); });
    if (idx >= 0) { rec.id = state.items[idx].id; state.items[idx] = rec; updated++; }
    else { rec.id = uid(); state.items.push(rec); added++; }
  }
  persistLocal(); drawItems(); show("items");
  toast("Imported " + added + " new, updated " + updated + (skipped ? ", skipped " + skipped : ""));
}
function importSpreadsheet(file) {
  if (!file) return;
  var name = (file.name || "").toLowerCase();
  if (name.indexOf(".xlsx") >= 0 || name.indexOf(".xls") >= 0) {
    toast("Save the Excel file as CSV (File then Save As then CSV) and upload that.", true);
    return;
  }
  var reader = new FileReader();
  reader.onload = function () { try { importTable(parseCsvText(reader.result)); } catch (e) { toast("Could not read that file.", true); } };
  reader.readAsText(file);
}
function boot() {
  try { restoreLocal(); setSync(true, state.items.length ? "Saved on this device" : "Ready on this device"); paint(); }
  catch (e) { setSync(true, "Ready on this device"); }
  try { show("scan"); } catch (e) {}
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
window.addEventListener("beforeunload", persistLocal);
document.addEventListener("visibilitychange", function () { if (document.hidden) persistLocal(); });
setInterval(persistLocal, 8000);
