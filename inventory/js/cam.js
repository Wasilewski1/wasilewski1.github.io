let stream = null;
let raf = 0;
let videoEl = null;
let scanCanvas = null;
function loadScript(src) {
  return new Promise(function (resolve, reject) {
    var s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });
}
async function ensureJsQR() {
  if (window.jsQR) return true;
  var urls = [
    "https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js",
    "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"
  ];
  for (var i = 0; i < urls.length; i++) {
    try { await loadScript(urls[i]); if (window.jsQR) return true; } catch (e) {}
  }
  return !!window.jsQR;
}
window.startCam = async function startCam() {
  var hint = document.getElementById("cam-hint");
  hint.textContent = "Starting camera...";
  await window.stopCam();
  var ready = await ensureJsQR();
  if (!ready) {
    hint.textContent = "Scanner blocked on this Wi-Fi. Tap Take photo of QR.";
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    hint.textContent = "No live camera in this browser. Tap Take photo of QR.";
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
  } catch (e) {
    hint.textContent = "Allow the camera, or tap Take photo of QR.";
    return;
  }
  var box = document.getElementById("reader");
  box.innerHTML = "";
  videoEl = document.createElement("video");
  videoEl.setAttribute("playsinline", "true");
  videoEl.setAttribute("autoplay", "true");
  videoEl.muted = true;
  videoEl.style.width = "100%";
  videoEl.style.display = "block";
  videoEl.srcObject = stream;
  box.appendChild(videoEl);
  try { await videoEl.play(); } catch (e) {}
  running = true;
  hint.textContent = "Camera is on. Point it at the pallet QR.";
  tick();
};
function tick() {
  if (!running || !videoEl) return;
  if (videoEl.readyState >= 2 && window.jsQR) {
    var w = videoEl.videoWidth, h = videoEl.videoHeight;
    if (w && h) {
      if (!scanCanvas) scanCanvas = document.createElement("canvas");
      scanCanvas.width = w;
      scanCanvas.height = h;
      var ctx = scanCanvas.getContext("2d");
      ctx.drawImage(videoEl, 0, 0, w, h);
      try {
        var img = ctx.getImageData(0, 0, w, h);
        var code = jsQR(img.data, w, h);
        if (code && code.data) onScan(code.data);
      } catch (e) {}
    }
  }
  raf = requestAnimationFrame(tick);
}
window.stopCam = async function stopCam() {
  running = false;
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
  videoEl = null;
  var box = document.getElementById("reader");
  if (box) box.innerHTML = "";
};
window.scanPhoto = function scanPhoto(file) {
  if (!file) return;
  ensureJsQR().then(function (ok) {
    if (!ok) { toast("Scanner not ready. Try Take photo again in a second.", true); return; }
    var img = new Image();
    img.onload = function () {
      var c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      var ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      var data = ctx.getImageData(0, 0, c.width, c.height);
      var code = jsQR(data.data, c.width, c.height);
      if (code && code.data) onScan(code.data);
      else toast("No QR found in that photo. Get closer and try again.", true);
    };
    img.src = URL.createObjectURL(file);
  });
};
