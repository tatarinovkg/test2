
(function(){
  try {
    if (!sessionStorage.getItem('noAutoFocusPatchApplied')) {
      sessionStorage.setItem('noAutoFocusPatchApplied', '1');
      if (location.hash) {
        sessionStorage.setItem('savedHash', location.hash);
        history.replaceState(null, document.title, location.pathname + location.search);
      }
      /* auto-scroll/focus disabled */
      var restore = function(){
        var h = sessionStorage.getItem('savedHash');
        if (h) { sessionStorage.removeItem('savedHash'); }
        window.removeEventListener('click', restore, {once:true});
        window.removeEventListener('keydown', restore, {once:true});
        window.removeEventListener('wheel', restore, {once:true});
      };
      window.addEventListener('click', restore, {once:true});
      window.addEventListener('keydown', restore, {once:true});
      window.addEventListener('wheel', restore, {once:true});
    }
  } catch(e){}
})();

;

(function(){
  try {
    if (!sessionStorage.getItem('noAutoFocusPatchApplied')) {
      sessionStorage.setItem('noAutoFocusPatchApplied', '1');
      if (location.hash) {
        try {
          sessionStorage.setItem('savedHash', location.hash);
        } catch (e) {}
        if (history && history.replaceState) {
          try { history.replaceState(null, document.title, location.pathname + location.search); } catch(e){}
        } else {
          // Fallback: do nothing, we won't modify the hash.
        }
      }
      // Ensure start at top (ES5-safe signature)
      if (typeof window.scrollTo === 'function') { window.scrollTo(0, 0); }
      // After first user interaction, we simply clear the saved hash marker.
      var restored = false;
      var restore = function(){
        if (restored) return;
        restored = true;
        try { sessionStorage.removeItem('savedHash'); } catch(e){}
        detach();
      };
      function detach(){
        if (window.removeEventListener) {
          window.removeEventListener('click', restore, false);
          window.removeEventListener('keydown', restore, false);
          window.removeEventListener('wheel', restore, false);
        }
        if (document && document.removeEventListener) {
          document.removeEventListener('touchstart', restore, false);
        }
      }
      if (window.addEventListener) {
        window.addEventListener('click', restore, false);
        window.addEventListener('keydown', restore, false);
        window.addEventListener('wheel', restore, false);
      }
      if (document && document.addEventListener) {
        document.addEventListener('touchstart', restore, false);
      }
    }
  } catch(e){}
})();
