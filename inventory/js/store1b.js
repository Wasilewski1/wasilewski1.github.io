function qrText(i) {
  return [i.id || "", i.materialNo || "", i.batchNo || ""].filter(Boolean).join("|");
}
(function () {
  var old = findItem;
  findItem = function (code) {
    var c = String(code || "").trim();
    if (!c) return null;
    var hit = old(c);
    if (hit) return hit;
    var parts = c.split(/[|\n,;]/);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (!p) continue;
      hit = old(p);
      if (hit) return hit;
    }
    return null;
  };
})();
