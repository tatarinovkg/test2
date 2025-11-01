(function () {
  function qsa(a, b = document) { return Array.from(b.querySelectorAll(a)); }

  // Нормализация массива url'ов
  function normalizePhotos(root) {
    let photos;
    const rawAttr = root.getAttribute("data-photos");

    if (rawAttr) {
      let raw = rawAttr.replace(/&quot;/g, '"').replace(/&apos;/g, "'");
      try {
        const parsed = JSON.parse(raw);
        photos = Array.isArray(parsed) ? parsed : [];
      } catch {
        photos = raw.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
      }
    } else {
      photos = Array.from(root.querySelectorAll("img[src]")).map(img => img.getAttribute("src")).filter(Boolean);
    }

    const pickUrl = (p) => (typeof p === "string" ? p : (p && (p.url || p.src || p.href)) || "");
    photos = photos.map(pickUrl).filter(Boolean);

    // к абсолютным
    photos = photos.map(u => { try { return new URL(u, location.href).toString(); } catch { return u; } });

    // убрать наш служебный параметр, если вдруг прилип
    photos = photos.map(u => {
      try { const url = new URL(u); url.searchParams.delete("_sg"); return url.toString(); } catch { return u; }
    });

    // дедуп
    photos = photos.filter((v, i, a) => a.indexOf(v) === i);
    return photos;
  }

  // Простой прелоадер через Image() с ретраями и кэш-бастером (без fetch — не нужен CORS)
  function loadWithRetry(url, { attempts = 2, timeout = 1500, bust = false } = {}) {
    return new Promise((resolve, reject) => {
      let n = 0, done = false, t = null;
      const base = url;

      function withBuster(u, nTry) {
        try {
          const uo = new URL(u, location.href);
          if (bust || nTry > 0) uo.searchParams.set("_sg", `${Date.now()}_${nTry}`);
          return uo.toString();
        } catch { return u + (u.includes("?") ? "&" : "?") + `_sg=${Date.now()}_${nTry}`; }
      }

      function tryOnce() {
        const test = new Image();
        const candidate = withBuster(base, n);
        const clear = () => { if (t) clearTimeout(t); test.onload = test.onerror = null; };

        t = setTimeout(() => {
          if (done) return;
          test.onload = test.onerror = null;
          n++;
          if (n <= attempts) tryOnce();
          else { clear(); reject(new Error("timeout")); }
        }, timeout);

        test.onload = () => { if (done) return; done = true; clear(); resolve(candidate); };
        test.onerror = () => {
          if (done) return;
          n++;
          if (n <= attempts) tryOnce();
          else { clear(); reject(new Error("error")); }
        };
        test.src = candidate;
      }
      tryOnce();
    });
  }

  function build(root) {
    if (root.__sg) return;

    const photos = normalizePhotos(root);
    if (!photos.length) return;

    // Разметка (без <img>): сцена + «холст» под background-image + контролы
    root.innerHTML = "";

    const stage = document.createElement("div");
    stage.className = "sg-stage";
    // фолбэк аспекта, если нетCSS aspect-ratio в проекте
    if (!CSS.supports?.("aspect-ratio: 1 / 1")) {
      const spacer = document.createElement("div");
      spacer.style.cssText = "width:100%;padding-top:56.25%;";
      stage.appendChild(spacer);
      stage.style.position = "relative";
    } else {
      stage.style.aspectRatio = "16 / 9";
      stage.style.position = "relative";
    }

    // сам «холст» (замена img): тянем картинку фоном
    const canvas = document.createElement("div");
    canvas.className = "sg-canvas";
    canvas.style.cssText = [
      "position:absolute", "inset:0",
      "background-repeat:no-repeat",
      "background-position:center",
      "background-size:contain",
      "transition:none" // никаких анимаций — меньше шансов залипнуть
    ].join(";");

    stage.appendChild(canvas);

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

    // невидимая «коробка» для прелоада соседей (держим картинки в DOM — WKWebView это любит)
    const preloadBin = document.createElement("div");
    preloadBin.style.cssText = "position:absolute;left:-99999px;top:-99999px;width:1px;height:1px;overflow:hidden;";
    root.appendChild(preloadBin);

    let i = 0;
    const isTg = !!(window.Telegram && window.Telegram.WebApp);
    const isIos = /iP(hone|ad|od)/.test(navigator.userAgent);
    const isTgIos = isTg && (window.Telegram.WebApp.platform === "ios" || isIos);

    // отрисовка фона через проверенный url (с ретраями только на iOS TG)
    function paint(url) {
      // экранируем кавычки
      const safe = url.replace(/"/g, "%22");
      canvas.style.backgroundImage = `url("${safe}")`;
      // микрорефлоу для WebKit, чтоб «разбудить» слой
      void canvas.offsetHeight;
    }

    function setSlide(index) {
      const total = photos.length;
      if (!total) return;
      i = (index + total) % total;
      const src = photos[i];

      counter.textContent = `${i + 1} / ${total}`;

      const retryOpts = isTgIos ? { attempts: 2, timeout: 1500, bust: false } : { attempts: 0, timeout: 0, bust: false };

      loadWithRetry(src, retryOpts)
          .then(finalUrl => { paint(finalUrl); })
          .catch(() => {
            // последний шанс: с бестером
            loadWithRetry(src, { attempts: 1, timeout: 1200, bust: true })
                .then(paint)
                .catch(() => paint(src)); // хотя бы поставим исходный
          });

      // прелоад соседей (в DOM!)
      const ahead = [ (i + 1) % total, (i + 2) % total ];
      ahead.forEach(idx => {
        const u = photos[idx];
        // не размножаем дубли
        if (!u || preloadBin.querySelector(`img[data-u="${CSS.escape(u)}"]`)) return;
        const ph = document.createElement("img");
        ph.setAttribute("data-u", u);
        // просто src — без бестера, нам важно прогреть кеш
        ph.src = u;
        preloadBin.appendChild(ph);
      });
    }

    function next() { setSlide(i + 1); }
    function prev() { setSlide(i - 1); }

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

    if (photos.length === 1) {
      btnNext.style.display = "none";
      btnPrev.style.display = "none";
      controls.classList.add("single");
    }

    // первый кадр
    setSlide(0);

    root.__sg = true;
  }

  function init() { qsa(".smart-gallery").forEach(build); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  new MutationObserver(() => init()).observe(document.documentElement, { childList: true, subtree: true });
})();