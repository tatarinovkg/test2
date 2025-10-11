
// Viewer enhancements: move controls below image, add counter, and fix iOS rounded corners.
(function() {
  const iOSFixStyles = `
  .rounded-clip, .photo-rounded-fix {
    overflow: hidden;
    border-radius: var(--radius, 0.75rem);
    -webkit-mask-image: -webkit-radial-gradient(white, black);
    mask-image: radial-gradient(circle, white, black);
  }
  img.rounded, img.rounded-md, img.rounded-lg, img.rounded-xl, img.rounded-2xl, .rounded img {
    border-radius: inherit !important;
  }
  .object-cover {
    object-fit: cover;
  }
  `;
  const style = document.createElement('style');
  style.textContent = iOSFixStyles;
  document.head.appendChild(style);

  function enhanceGalleries() {
    const galleries = Array.from(document.querySelectorAll(
      '[data-gallery], .gallery, .photo-viewer, .lightbox, .image-viewer'
    ));

    galleries.forEach(gal => {
      if (gal.__enhancedControls) return;
      const imgs = gal.querySelectorAll('img');
      if (!imgs.length) return;

      imgs.forEach(img => {
        img.classList.add('object-cover');
        const parent = img.parentElement;
        if (parent && !parent.classList.contains('photo-rounded-fix')) {
          parent.classList.add('photo-rounded-fix');
        }
      });

      const controlBar = document.createElement('div');
      controlBar.className = "w-full flex items-center justify-center gap-4 mt-3 select-none";
      const prevBtn = document.createElement('button');
      prevBtn.type = "button";
      prevBtn.className = "px-3 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition";
      prevBtn.textContent = "←";
      const counter = document.createElement('span');
      counter.className = "text-sm text-gray-700 dark:text-gray-300";
      const nextBtn = document.createElement('button');
      nextBtn.type = "button";
      nextBtn.className = "px-3 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition";
      nextBtn.textContent = "→";
      controlBar.appendChild(prevBtn);
      controlBar.appendChild(counter);
      controlBar.appendChild(nextBtn);

      let anchor = imgs[0];
      let container = anchor.closest('.image-container, .photo, .frame, .card, .relative, .overflow-hidden') || anchor.parentElement;
      (container.parentElement || gal).insertBefore(controlBar, (container.nextSibling));

      let index = 0;
      const images = Array.from(imgs);
      images.forEach((im, i) => { if (i !== index) im.style.display = 'none'; });
      function update() {
        images.forEach((im, i)=> im.style.display = (i===index ? '' : 'none'));
        counter.textContent = (index+1) + " / " + images.length;
      }
      function next() { index = (index + 1) % images.length; update(); }
      function prev() { index = (index - 1 + images.length) % images.length; update(); }
      nextBtn.addEventListener('click', next);
      prevBtn.addEventListener('click', prev);
      gal.setAttribute('tabindex', '0');
      gal.addEventListener('keydown', (e)=>{
        if (e.key === 'ArrowRight') next();
        if (e.key === 'ArrowLeft') prev();
      });
      update();
      gal.__enhancedControls = true;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhanceGalleries);
  } else {
    enhanceGalleries();
  }
})();
