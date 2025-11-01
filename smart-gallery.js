(function () {
  function qsa(a, b = document) { return Array.from(b.querySelectorAll(a)); }

  function build(root) {
    if (root.__sg) return;
    try {
      let photos = [];
      const data = root.getAttribute("data-photos") || "";
      if (data) {
        const decoded = data.replace(/&quot;/g, '"').replace(/&apos;/g, "'");
        try { photos = JSON.parse(decoded); }
        catch { photos = decoded.split(",").map(s => s.trim()); }
      } else {
        // без :scope для совместимости
        photos = Array.from(root.querySelectorAll("img")).map(img => img.getAttribute("src")).filter(Boolean);
      }
      photos = photos.map(p => (typeof p === "string" ? p : p?.url || "")).filter(Boolean);
      if (!photos.length) return;

      // Разметка
      root.innerHTML = "";
      const stage = document.createElement("div");
      stage.className = "sg-stage";

      const img = document.createElement("img");
      // КРИТИЧЕСКОЕ: грузим сразу, без lazy — именно это лечит iOS
      img.loading = "eager";
      img.decoding = "async";
      img.alt = "";
      stage.appendChild(img);

      const controls = document.createElement("div");
      controls.className = "sg-controls";

      const btnPrev = document.createElement("button");
      btnPrev.className = "sg-btn prev";
      btnPrev.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>`;

      const counter = document.createElement("div");
      counter.className = "sg-counter";

      const btnNext = document.createElement("button");
      btnNext.className = "sg-btn next";
      btnNext.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 6l6 6-6 6"/>
        </svg>`;

      controls.append(btnPrev, counter, btnNext);
      root.append(stage, controls);

      let i = 0;

      function setSrcDirect(src) {
        // без анимаций/промежуточных opacity: iOS это любит
        if (img.src !== src) {
          img.removeAttribute("style");
          img.src = src;
        }
      }

      function render() {
        const src = photos[i];
        if (!src) return;
        setSrcDirect(src);
        counter.textContent = `${i + 1} / ${photos.length}`;
      }

      function next() { i = (i + 1) % photos.length; render(); }
      function prev() { i = (i - 1 + photos.length) % photos.length; render(); }

      btnNext.addEventListener("click", next);
      btnPrev.addEventListener("click", prev);

      // свайпы
      let tx = null;
      stage.addEventListener("touchstart", e => { tx = e.changedTouches[0].clientX; }, { passive: true });
      stage.addEventListener("touchend", e => {
        if (tx == null) return;
        const dx = e.changedTouches[0].clientX - tx;
        if (Math.abs(dx) > 40) (dx < 0 ? next() : prev());
        tx = null;
      }, { passive: true });

      // Если одно фото — прячем кнопки и центруем счётчик классом, а не :has()
      if (photos.length === 1) {
        btnNext.style.display = "none";
        btnPrev.style.display = "none";
        controls.classList.add("single");
      }

      render();
      root.__sg = true;
    } catch (err) {
      console.error("[SG] init error", err);
    }
  }

  function init() { qsa(".smart-gallery").forEach(build); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  new MutationObserver(() => init()).observe(document.documentElement, { childList: true, subtree: true });
})();
