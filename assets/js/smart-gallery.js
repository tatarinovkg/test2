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
        photos = qsa(":scope img", root).map(img => img.getAttribute("src")).filter(Boolean);
      }
      photos = photos.map(p => (typeof p === "string" ? p : p?.url || "")).filter(Boolean);
      if (!photos.length) return;

      // Разметка
      root.innerHTML = "";
      const stage = document.createElement("div");
      stage.className = "sg-stage";
      const img = document.createElement("img");
      img.loading = "lazy"; img.alt = ""; stage.appendChild(img);

// Панель управления ПОД фото: [btnPrev] [counter] [btnNext]
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
      function render() {
        const src = photos[i];
        if (!src) return;

        img.style.transition = "opacity 0.3s ease";
        img.style.opacity = 0;

        // если src совпадает — просто плавно показать
        if (img.src.endsWith(src)) {
          img.style.opacity = 1;
          return;
        }

        const newImg = new Image();
        newImg.src = src;
        newImg.onload = () => {
          requestAnimationFrame(() => {
            img.src = src;
            img.style.opacity = 1;
          });
        };

        counter.textContent = `${i + 1} / ${photos.length}`;
      }
      function next() { i = (i + 1) % photos.length; render(); }
      function prev() { i = (i - 1 + photos.length) % photos.length; render(); }

      btnNext.addEventListener("click", next);
      btnPrev.addEventListener("click", prev);

      // свайп
      let tx = null;
      stage.addEventListener("touchstart", e => { tx = e.changedTouches[0].clientX; }, {passive:true});
      stage.addEventListener("touchend", e => {
        if (tx == null) return;
        const dx = e.changedTouches[0].clientX - tx;
        if (Math.abs(dx) > 40) (dx < 0 ? next() : prev());
        tx = null;
      }, {passive:true});

      // если одно фото — скрываем кнопки
      if (photos.length === 1) {
        btnNext.style.display = "none";
        btnPrev.style.display = "none";
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
