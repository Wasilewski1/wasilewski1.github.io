let stream = null;
let raf = 0;
let videoEl = null;
let scanCanvas = null;
let lastTick = 0;
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
function decodeImageData(img) {
  if (window.jsQR) {
    var code = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
    if (code && code.data) return String(code.data).trim();
  }
  return "";
}
window.startCam = async function startCam() {
  var hint = document.getElementById("cam-hint");
  hint.textContent = "Starting camera...";
  await window.stopCam();
  await ensureJsQR();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    hint.textContent = "No live camera here. Tap Take photo of QR.";
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
  } catch (e) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch (e2) {
      hint.textContent = "Allow the camera, or tap Take photo of QR.";
      return;
    }
  }
  var box = document.getElementById("reader");
  box.innerHTML = "";
  videoEl = document.createElement("video");
  videoEl.setAttribute("playsinline", "true");
  videoEl.setAttribute("muted", "true");
  videoEl.setAttribute("autoplay", "true");
  videoEl.muted = true;
  videoEl.playsInline = true;
  videoEl.style.width = "100%";
  videoEl.style.display = "block";
  videoEl.srcObject = stream;
  box.appendChild(videoEl);
  try { await videoEl.play(); } catch (e) {}
  running = true;
  hint.textContent = "Camera is on. Fill the box with the printed QR.";
  tick();
};
function tick() {
  if (!running || !videoEl) return;
  var now = Date.now();
  if (now - lastTick > 180 && videoEl.readyState >= 2) {
    lastTick = now;
    var w = videoEl.videoWidth, h = videoEl.videoHeight;
    if (w && h) {
      var max = 480;
      var scale = Math.min(1, max / Math.max(w, h));
      var cw = Math.max(160, Math.round(w * scale));
      var ch = Math.max(160, Math.round(h * scale));
      if (!scanCanvas) scanCanvas = document.createElement("canvas");
      scanCanvas.width = cw;
      scanCanvas.height = ch;
      var ctx = scanCanvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(videoEl, 0, 0, cw, ch);
      try {
        var img = ctx.getImageData(0, 0, cw, ch);
        var text = decodeImageData(img);
        if (text) {
          document.getElementById("cam-hint").textContent = "Got it: " + text;
          onScan(text);
        }
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
    if (!ok) { toast("Scanner not ready. Type the Material No instead.", true); return; }
    var img = new Image();
    img.onload = function () {
      var max = 900;
      var scale = Math.min(1, max / Math.max(img.width, img.height));
      var c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      var ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, c.width, c.height);
      var data = ctx.getImageData(0, 0, c.width, c.height);
      var text = decodeImageData(data);
      if (text) onScan(text);
      else toast("Could not read that photo. Type the Material No or Batch instead.", true);
    };
    img.src = URL.createObjectURL(file);
  });
};
