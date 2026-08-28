var _confirmMove = confirmMove;
confirmMove = function (id) {
  _confirmMove(id);
  lastPullAt = 0;
  if (typeof pushCloud === "function") pushCloud(true);
};
setInterval(function () {
  if (document.visibilityState === "visible" && typeof pullCloud === "function") pullCloud();
}, 12000);
