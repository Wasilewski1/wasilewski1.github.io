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
(function () {
  var page = document.getElementById("page-more");
  if (!page) return;
  var box = document.createElement("div");
  box.className = "card tight";
  box.innerHTML = "<h3>This device</h3><p class='muted' style='margin-bottom:10px'>Clears the list stored in this browser only.</p><button type='button' onclick='clearAllLocal()' style='width:100%;background:#b42318'>Clear everything on this device</button><p class='muted' id='cloud-err' style='margin-top:10px'></p>";
  page.appendChild(box);
})();
