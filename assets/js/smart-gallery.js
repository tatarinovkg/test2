(function () {
  function qsa(a, b = document) { return Array.from(b.querySelectorAll(a)); }

  function build(root) {
    if (root.__sg) return;
    try {
      // === Нормализация списка фотографий (шаг 3) ===
      let photos = [];
      const rawAttr = root.getAttribute("data-photos");

      if (rawAttr) {
        // data-photos может быть HTML-эскейпнутым JSON или CSV/списком в несколько строк
        let raw = rawAttr.replace(/&quot;/g, '"').replace(/&apos;/g, "'");
        try {
          const parsed = JSON.parse(raw);
          photos = Array.isArray(parsed) ? parsed : [];
        } catch {
          photos = raw.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
        }
      } else {
        // Без :scope для совместимости с WebKit
        photos = Array.from(root.querySelectorAll("img[src]"))
            .map(img => img.getAttribute("src"))
            .filter(Boolean);
      }

      // Берём строку или поле url/src/href
      const pickUrl = (p) => (typeof p === "string" ? p : (p && (p.url || p.src || p.href)) || "");
      photos = photos.map(pickUrl).filter(Boolean);

      // Приводим к абсолютным URL
      photos = photos.map(u => {
        try { return new URL(u, location.href).toString(); } catch { return u; }
      });

      // Удаляем служебный кэш-бастер _sg, если уже есть
      photos = photos.map(u => {
        try {
          const url = new URL(u);
          url.searchParams.delete("_sg");
          return url.toString();
        } catch { return u; }
      });

      // Дедупликация
      photos = photos.filter((v, i, a) => a.indexOf(v) === i);

      if (!photos.length) return;

      // === Разметка ===
      root.innerHTML = "";
      const stage = document.createElement("div");
      stage.className = "sg-stage";

      const img = document.createElement("img");
      // Критично для iOS: грузим сразу, без lazy
      img.loading = "eager";
      img.fetchPriority = "high";   // iOS 17.2+ ок
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

      function render() {
        const src = photos[i];
        if (!src) return;

        // Без анимаций — так стабильнее в iOS WebView/Telegram
        img.style.transition = "none";
        img.style.opacity = 1;

        // Детект iOS-Telegram: включаем «жёсткий» ретрай только там
        const isTg = !!(window.Telegram && window.Telegram.WebApp);
        const isIos = /iP(hone|ad|od)/.test(navigator.userAgent);
        const isTgIos = isTg && (window.Telegram.WebApp.platform === "ios" || isIos);

        let attempt = 0;
        const MAX_ATTEMPTS = 2;

        function withBuster(u, n) {
          try {
            const url = new URL(u, location.href);
            url.searchParams.set("_sg", `${Date.now()}_${n}`);
            return url.toString();
          } catch {
            return u + (u.includes("?") ? "&" : "?") + `_sg=${Date.now()}_${n}`;
          }
        }

        function trySet(original) {
          img.src = (isTgIos && attempt > 0) ? withBuster(original, attempt) : original;

          if (!isTgIos) return; // в обычных браузерах этого достаточно

          // Страховка: если за ~1.5с так и не загрузилось — ретрай с бестером
          let done = false;
          const timer = setTimeout(() => {
            if (done) return;
            if (!img.complete || img.naturalWidth === 0) {
              if (attempt < MAX_ATTEMPTS) {
                attempt++;
                trySet(original);
              }
            }
          }, 1500);

          img.onload = () => { done = true; clearTimeout(timer); };
          img.onerror = () => {
            if (done) return;
            clearTimeout(timer);
            if (attempt < MAX_ATTEMPTS) { attempt++; trySet(original); }
          };
        }

        trySet(src);

        // Счётчик
        counter.textContent = `${i + 1} / ${photos.length}`;
      }

      function next() { i = (i + 1) % photos.length; render(); }
      function prev() { i = (i - 1 + photos.length) % photos.length; render(); }

      btnNext.addEventListener("click", next);
      btnPrev.addEventListener("click", prev);

      // Свайпы
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