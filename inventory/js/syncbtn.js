function addSyncButtons() {
  var bar = document.querySelector("#page-items .toolbar");
  if (bar && !document.getElementById("sync-cloud-btn")) {
    var b = document.createElement("button");
    b.id = "sync-cloud-btn";
    b.className = "gold";
    b.style.flex = "0 0 auto";
    b.textContent = "Sync with cloud";
    b.onclick = function () { toast("Loading cloud..."); pullCloud(); };
    bar.insertBefore(b, bar.firstChild);
  }
  var page = document.getElementById("page-items");
  if (page && !document.getElementById("sync-cloud-banner")) {
    var banner = document.createElement("div");
    banner.id = "sync-cloud-banner";
    banner.className = "card tight";
    banner.innerHTML = "<button class='gold' style='width:100%;padding:16px;font-size:16px' onclick='toast(\"Loading cloud...\");pullCloud()'>Sync with cloud</button>";
    var sheet = document.getElementById("sheet");
    page.insertBefore(banner, sheet || page.firstChild);
  }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addSyncButtons);
else addSyncButtons();
