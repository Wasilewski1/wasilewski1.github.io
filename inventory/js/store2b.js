function drawItems() {
  var rows = filteredItems();
  var el = document.getElementById("items");
  var sheet = document.getElementById("sheet");
  if (!rows.length) {
    var empty = "<div class='card'><b>No materials on this phone yet.</b><p class='muted'>If you uploaded on the computer, download CSV there and upload it here too.</p><button class='gold' onclick='document.getElementById(\"xls\").click()'>Upload Excel / CSV</button></div>";
    if (el) el.innerHTML = empty; if (sheet) sheet.innerHTML = empty; return;
  }
  if (sheet) {
    var cols = ["Site","Bay","Material No","M code","English Description","Batch No","Vendor Batch","Quantity","Unit","Expiration Date","PO Number","Remaining days","Packaging","Print QR"];
    sheet.innerHTML = "<table><thead><tr>" + cols.map(function (c) { return "<th>" + c + "</th>"; }).join("") + "</tr></thead><tbody>" + rows.map(function (i) {
      return "<tr><td>" + escapeHtml(i.site) + "</td><td>" + escapeHtml(i.bay) + "</td><td>" + escapeHtml(i.materialNo) + "</td><td>" + escapeHtml(i.mCode) + "</td><td>" + escapeHtml(i.description) + "</td><td>" + escapeHtml(i.batchNo) + "</td><td>" + escapeHtml(i.vendorBatch) + "</td><td>" + i.qty + "</td><td>" + escapeHtml(i.unit) + "</td><td>" + escapeHtml(i.expirationDate) + "</td><td>" + escapeHtml(i.poNumber) + "</td><td>" + remainingDays(i) + "</td><td>" + escapeHtml(i.packaging) + "</td><td><button class='gold' onclick='printLabel(\"" + i.id + "\")'>Print QR</button> <button class='ghost' onclick='editForm(\"" + i.id + "\")'>Edit</button></td></tr>";
    }).join("") + "</tbody></table>";
  }
  if (!el) return;
  el.innerHTML = rows.map(function (i) {
    return "<div class='item'><b>" + escapeHtml(i.description) + "</b><div class='muted'>Site <b>" + escapeHtml(i.site || "-") + "</b> | Bay <b>" + escapeHtml(i.bay || "-") + "</b> | Mat " + escapeHtml(i.materialNo) + " | Batch " + escapeHtml(i.batchNo) + "</div><div class='big'>" + i.qty + " " + escapeHtml(i.unit) + "</div><div class='actions'><button class='gold' onclick='printLabel(\"" + i.id + "\")'>Print QR</button><button class='ghost' onclick='editForm(\"" + i.id + "\")'>Edit</button></div></div>";
  }).join("");
}
function printLabel(id) {
  var i = state.items.find(function (x) { return x.id === id; });
  if (!i) return;
  if (!window.QRCode) return toast("QR tool did not load. Refresh and try again.", true);
  var hold = document.createElement("div");
  hold.style.position = "fixed"; hold.style.left = "-9999px";
  document.body.appendChild(hold);
  new QRCode(hold, { text: qrText(i), width: 280, height: 280, correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.M : 0 });
  setTimeout(function () {
    var img = hold.querySelector("img");
    var canvas = hold.querySelector("canvas");
    var url = img && img.src ? img.src : (canvas ? canvas.toDataURL("image/png") : null);
    hold.remove();
    if (!url) return toast("Could not make QR", true);
    var w = window.open("", "_blank");
    if (!w) return toast("Allow pop-ups so the label can print.", true);
    w.document.write("<html><body style='font-family:Arial;padding:16px'><div style='border:3px solid #0b1f3a;padding:16px;width:380px'><div style='background:#f5c518;font-weight:800;display:inline-block;padding:5px 8px'>FENCHEM PALLET</div><h1>" + escapeHtml(i.description) + "</h1><div>Site: <b>" + escapeHtml(i.site || "") + "</b></div><div>Material: <b>" + escapeHtml(i.materialNo) + "</b></div><div>Batch: <b>" + escapeHtml(i.batchNo) + "</b></div><div>Qty: <b>" + i.qty + " " + escapeHtml(i.unit) + "</b></div><div>Bay: <b>" + escapeHtml(i.bay || "") + "</b></div><img src='" + url + "' width='260' height='260' style='display:block;margin:12px auto'><div style='text-align:center;font-size:13px'>" + escapeHtml(i.materialNo) + " / " + escapeHtml(i.batchNo) + "</div></div></body></html>");
    w.document.close();
    setTimeout(function () { try { w.print(); } catch (e) {} }, 250);
  }, 120);
}
function printAllLabels() {
  var rows = filteredItems();
  if (!rows.length) { toast("Nothing to print.", true); return; }
  if (!window.QRCode) { toast("QR tool did not load. Refresh and try again.", true); return; }
  var w = window.open("", "_blank");
  if (!w) { toast("Allow pop-ups so the labels can print.", true); return; }
  w.document.write("<html><head><title>Pallet QR labels</title><style>body{font-family:Arial;padding:12px}.lab{border:3px solid #0b1f3a;padding:12px;width:320px;display:inline-block;vertical-align:top;margin:8px;page-break-inside:avoid}h2{margin:8px 0 6px;font-size:16px}.tag{background:#f5c518;font-weight:800;display:inline-block;padding:4px 6px;font-size:11px}</style></head><body></body></html>");
  w.document.close();
  var n = 0;
  function next() {
    if (n >= rows.length) { setTimeout(function () { try { w.print(); } catch (e) {} }, 300); return; }
    var item = rows[n++];
    var hold = document.createElement("div");
    hold.style.position = "fixed"; hold.style.left = "-9999px";
    document.body.appendChild(hold);
    new QRCode(hold, { text: qrText(item), width: 200, height: 200 });
    setTimeout(function () {
      var img = hold.querySelector("img");
      var canvas = hold.querySelector("canvas");
      var url = img && img.src ? img.src : (canvas ? canvas.toDataURL("image/png") : "");
      hold.remove();
      var box = w.document.createElement("div");
      box.className = "lab";
      box.innerHTML = "<div class='tag'>FENCHEM PALLET</div><h2>" + escapeHtml(item.description) + "</h2><div>Site: <b>" + escapeHtml(item.site || "") + "</b></div><div>Material: <b>" + escapeHtml(item.materialNo) + "</b></div><div>Batch: <b>" + escapeHtml(item.batchNo) + "</b></div><div>Qty: <b>" + item.qty + " " + escapeHtml(item.unit) + "</b></div><div>Bay: <b>" + escapeHtml(item.bay || "") + "</b></div><img src='" + url + "' width='180'><div style='text-align:center'>" + escapeHtml(item.materialNo) + "</div>";
      w.document.body.appendChild(box);
      next();
    }, 50);
  }
  next();
}
