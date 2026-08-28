/* Shared cloud inventory. Phone and PC use the same list. */
const API = "https://crudcrud.com/api/8a85b75399b8406b8292f8f06db8d602/store";
const DOC_ID = "6a91d371de31d103e89a25fa";
const DOC = API + "/" + DOC_ID;

const emptyState = () => ({
  v: 1,
  settings: { siteName: "My Warehouse", operator: "", lowStock: 5 },
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
  document.getElementById("dot").className = "okdot" + (ok ? "" : " baddot");
}

async function loadCloud() {
  setSync(false, "Loading…");
  try {
    const res = await fetch(DOC, { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load");
    const data = await res.json();
    delete data._id;
    state = {
      v: data.v || 1,
      settings: { ...emptyState().settings, ...(data.settings || {}) },
      items: data.items || [],
      txns: data.txns || [],
    };
    localStorage.setItem("scantrack.cache", JSON.stringify(state));
    setSync(true, "Saved in the cloud");
    paint();
  } catch (e) {
    setSync(false, "Offline — using last copy");
    try {
      const raw = localStorage.getItem("scantrack.cache");
      if (raw) {
        state = JSON.parse(raw);
        paint();
      }
    } catch {}
  }
}

async function saveCloud() {
  localStorage.setItem("scantrack.cache", JSON.stringify(state));
  if (saving) {
    saveCloud._again = true;
    return;
  }
  saving = true;
  setSync(false, "Saving…");
  const payload = {
    v: state.v,
    settings: state.settings,
    items: state.items,
    txns: state.txns,
  };
  try {
    const res = await fetch(DOC, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("save failed");
    setSync(true, "Saved in the cloud");
  } catch {
    setSync(false, "Not saved — check internet");
    toast("Could not save to the cloud. Check your signal.", true);
  } finally {
    saving = false;
    if (saveCloud._again) {
      saveCloud._again = false;
      saveCloud();
    }
  }
}

function uid() {
  return "ITM-" + Math.random().toString(36).slice(2, 7).toUpperCase() + Date.now().toString(36).slice(-3).toUpperCase();
}

function show(name, btn) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("on"));
  document.getElementById("page-" + name).classList.add("on");
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.remove("on"));
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
    document.getElementById("cam-hint").textContent = "Camera tool did not load. Type the code instead.";
    return;
  }
  scanner = new Html5Qrcode("reader");
  try {
    await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 240, height: 240 } }, onScan, () => {});
    running = true;
    document.getElementById("cam-hint").textContent = "Camera is on. Point it at the QR sticker.";
  } catch (err) {
    running = false;
    document.getElementById("cam-hint").textContent =
      "Could not start the camera. Tap Allow if asked. Type the code below if needed.";
  }
}

async function stopCam() {
  if (scanner && running) {
    try { await scanner.stop(); } catch {}
    try { scanner.clear(); } catch {}
  }
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
  const c = String(code || "").trim();
  if (!c) return null;
  return (
    state.items.find((i) => i.id === c) ||
    state.items.find((i) => i.sku && i.sku.toLowerCase() === c.toLowerCase()) ||
    state.items.find((i) => i.name.toLowerCase() === c.toLowerCase())
  );
}

function lookup(code) {
  const c = String(code || "").trim();
  const box = document.getElementById("match");
  if (!c) return;
  const item = findItem(c);
  if (!item) {
    box.innerHTML = '<b>Unknown code</b><p class="muted" style="margin:8px 0">' + escapeHtml(c) + '</p><button class="primary" onclick="openEdit(\'' + escapeHtml(c) + '\')">Add this as a new item</button>';
    return;
  }
  box.innerHTML = '<div class="muted">' + (mode === "in" ? "Checking IN" : "Checking OUT") + '</div>' +
    '<div class="big">' + escapeHtml(item.name) + '</div>' +
    '<p class="muted">' + escapeHtml(item.id) + (item.sku ? " · " + escapeHtml(item.sku) : "") + ' · On hand: <b>' + item.qty + '</b></p>' +
    '<label>How many?</label><div class="qty"><button type="button" onclick="nudge(-1)">−</button><input id="qty" type="number" min="1" value="1" /><button type="button" onclick="nudge(1)">+</button></div>' +
    '<label>Note (optional)</label><input id="note" placeholder="Who / where / why" /><div style="height:10px"></div>' +
    '<button class="' + (mode === "in" ? "inbtn" : "outbtn") + '" onclick="confirmMove(\'' + item.id + '\')">' +
    (mode === "in" ? "Confirm IN" : "Confirm OUT") + "</button>";
}

function nudge(d) {
  const el = document.getElementById("qty");
  el.value = Math.max(1, (Number(el.value) || 1) + d);
}

function confirmMove(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  const qty = Math.max(1, Number(document.getElementById("qty").value) || 1);
  const note = (document.getElementById("note") || {}).value || "";
  if (mode === "out" && item.qty < qty) {
    toast("Not enough in stock. You only have " + item.qty + ".", true);
    return;
  }
  item.qty += mode === "in" ? qty : -qty;
  state.txns.unshift({
    at: new Date().toISOString(),
    type: mode,
    itemId: item.id,
    name: item.name,
    qty,
    result: item.qty,
    who: state.settings.operator || "Someone",
    note,
  });
  saveCloud();
  paint();
  toast((mode === "in" ? "IN  +" : "OUT  −") + qty + "  " + item.name + "  (now " + item.qty + ")");
  lookup(item.id);
}

function drawItems() {
  const q = (document.getElementById("search")?.value || "").toLowerCase();
  const rows = state.items
    .filter((i) => (i.name + " " + i.id + " " + (i.sku || "") + " " + (i.location || "")).toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
  const el = document.getElementById("items");
  if (!rows.length) {
    el.innerHTML = '<div class="card">No items yet. Tap + Add item. Then print a QR sticker for it.</div>';
    return;
  }
  el.innerHTML = rows.map((i) => {
    const low = i.qty <= (i.minQty ?? state.settings.lowStock);
    return '<div class="card"><div class="bar"><div><b>' + escapeHtml(i.name) + '</b><div class="muted">' +
      escapeHtml(i.id) + (i.sku ? " · " + escapeHtml(i.sku) : "") + (i.location ? " · " + escapeHtml(i.location) : "") +
      '</div></div><div class="big" style="color:' + (low ? "var(--danger)" : "var(--text)") + '">' + i.qty +
      '</div></div><div class="item-actions"><button onclick="quick(\'' + i.id + '\',\'in\')">In</button>' +
      '<button onclick="quick(\'' + i.id + '\',\'out\')">Out</button>' +
      '<button onclick="showQr(\'' + i.id + '\')">QR label</button>' +
      '<button onclick="openEdit(null,\'' + i.id + '\')">Edit</button></div></div>';
  }).join("");
}

function quick(id, type) {
  setMode(type);
  const item = state.items.find((i) => i.id === id);
  const n = Number(prompt((type === "in" ? "Add how many of " : "Remove how many of ") + item.name + "?", "1"));
  if (!n || n < 1) return;
  if (type === "out" && item.qty < n) return toast("Not enough in stock.", true);
  item.qty += type === "in" ? n : -n;
  state.txns.unshift({
    at: new Date().toISOString(), type, itemId: item.id, name: item.name, qty: n, result: item.qty,
    who: state.settings.operator || "Someone", note: "typed",
  });
  saveCloud();
  drawItems();
  toast("Updated " + item.name);
}

function openEdit(prefill, editId) {
  const item = editId ? state.items.find((i) => i.id === editId) : null;
  const id = item ? item.id : (prefill && !findItem(prefill) ? prefill : uid());
  const name = prompt("Item name?", item ? item.name : "");
  if (!name) return;
  const sku = prompt("SKU / part number? (optional)", item ? item.sku : "") || "";
  const location = prompt("Shelf / bin location? (optional)", item ? item.location : "") || "";
  const qty = Number(prompt("How many do you have right now?", item ? String(item.qty) : "0")) || 0;
  if (item) {
    item.name = name.trim();
    item.sku = sku.trim();
    item.location = location.trim();
    item.qty = qty;
  } else {
    state.items.push({ id, name: name.trim(), sku: sku.trim(), location: location.trim(), qty, minQty: state.settings.lowStock });
  }
  saveCloud();
  drawItems();
  show("items");
  toast("Saved " + name);
}

function showQr(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item || !window.QRCode) return toast("Could not make QR", true);
  const w = window.open("", "_blank");
  w.document.write('<!doctype html><title>Label</title><style>body{font-family:sans-serif;text-align:center;padding:24px}</style><h2>' +
    escapeHtml(item.name) + "</h2><p>" + escapeHtml(item.id) + '</p><canvas id="c"></canvas>');
  QRCode.toCanvas(w.document.getElementById("c"), item.id, { width: 240, margin: 1 }, function () { w.print(); });
}

function printAll() {
  if (!state.items.length) return toast("Add items first", true);
  const w = window.open("", "_blank");
  w.document.write('<!doctype html><title>Labels</title><style>body{font-family:sans-serif;margin:16px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}.l{border:1px solid #999;padding:12px;text-align:center;page-break-inside:avoid}</style><div class="g" id="g"></div>');
  const g = w.document.getElementById("g");
  Promise.all(state.items.map(function (item) {
    const d = w.document.createElement("div");
    d.className = "l";
    d.innerHTML = "<b>" + escapeHtml(item.name) + "</b><div>" + escapeHtml(item.id) + "</div><canvas></canvas>";
    g.appendChild(d);
    return QRCode.toCanvas(d.querySelector("canvas"), item.id, { width: 160, margin: 1 });
  })).then(function () { w.print(); });
}

function drawReport() {
  const low = state.items.filter((i) => i.qty <= (i.minQty ?? state.settings.lowStock));
  document.getElementById("r-skus").textContent = state.items.length;
  document.getElementById("r-qty").textContent = state.items.reduce((s, i) => s + i.qty, 0);
  document.getElementById("r-low").textContent = low.length;
  document.getElementById("r-lowtbl").innerHTML = low.length
    ? "<table><thead><tr><th>Item</th><th>Have</th></tr></thead><tbody>" + low.map((i) => "<tr><td>" + escapeHtml(i.name) + "</td><td>" + i.qty + "</td></tr>").join("") + "</tbody></table>"
    : '<p class="muted">Nothing is low.</p>';
  document.getElementById("r-hist").innerHTML = state.txns.length
    ? "<table><thead><tr><th>When</th><th></th><th>Item</th><th>Qty</th></tr></thead><tbody>" + state.txns.slice(0, 30).map((t) => "<tr><td>" + new Date(t.at).toLocaleString() + "</td><td>" + t.type.toUpperCase() + "</td><td>" + escapeHtml(t.name) + "</td><td>" + t.qty + "</td></tr>").join("") + "</tbody></table>"
    : '<p class="muted">No scans yet.</p>';
}

function fillSettings() {
  document.getElementById("operator").value = state.settings.operator || "";
  document.getElementById("sitename").value = state.settings.siteName || "";
  document.getElementById("lowstock").value = state.settings.lowStock ?? 5;
}

function saveSettings() {
  state.settings.operator = document.getElementById("operator").value.trim();
  state.settings.siteName = document.getElementById("sitename").value.trim() || "My Warehouse";
  state.settings.lowStock = Math.max(0, Number(document.getElementById("lowstock").value) || 0);
  saveCloud();
  toast("Saved");
}

function seedDemo() {
  const demo = [
    { name: "Cordless Drill", sku: "TOOL-018", location: "A-12", qty: 8 },
    { name: "Safety Helmet", sku: "PPE-H1", location: "B-02", qty: 24 },
    { name: "Printer Toner", sku: "PRT-TN760", location: "D-01", qty: 2 },
  ];
  demo.forEach((d) => {
    if (!state.items.some((i) => i.sku === d.sku)) state.items.push({ id: uid(), minQty: 5, ...d });
  });
  saveCloud();
  drawItems();
  toast("Sample items added");
}

function exportCsv(kind) {
  let csv;
  if (kind === "items") {
    csv = ["id,name,sku,location,qty"].concat(state.items.map((i) => [i.id, i.name, i.sku, i.location, i.qty].map(csvCell).join(","))).join("\n");
  } else {
    csv = ["when,type,item,qty,result,who,note"].concat(state.txns.map((t) => [t.at, t.type, t.name, t.qty, t.result, t.who, t.note].map(csvCell).join(","))).join("\n");
  }
  download((kind === "items" ? "inventory" : "scan-history") + ".csv", csv, "text/csv");
}

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function backup() {
  download("inventory-backup.json", JSON.stringify(state, null, 2), "application/json");
}

function restoreFile(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!Array.isArray(data.items)) throw new Error("bad file");
      state = { v: 1, settings: { ...emptyState().settings, ...(data.settings || {}) }, items: data.items, txns: data.txns || [] };
      saveCloud();
      paint();
      toast("Backup restored");
    } catch {
      toast("That file could not be used.", true);
    }
  };
  r.readAsText(file);
}

function download(name, content, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
}

function paint() {
  fillSettings();
  drawItems();
  drawReport();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&", "<": "<", ">": ">", '"': """, "'": "&#39;" }[c]));
}

document.addEventListener("DOMContentLoaded", () => {
  loadCloud();
  show("scan");
  setInterval(loadCloud, 20000);
});
window.addEventListener("beforeunload", stopCam);
