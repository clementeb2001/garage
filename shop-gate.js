/* Shop-Virschau-Gate — setzt html.shop-dev fir ?dev=1 (CSP-konform, extern,
   am <head> gelueden, fir keen Opbléizen vun der "geschwënn"-Säit). */
(function () {
  try {
    var p = new URLSearchParams(location.search);
    if (p.get("dev") === "1") localStorage.setItem("gk_shop_dev", "1");
    if (p.get("dev") === "0") localStorage.removeItem("gk_shop_dev");
    if (localStorage.getItem("gk_shop_dev") === "1") {
      document.documentElement.classList.add("shop-dev");
    }
  } catch (e) {}
})();
