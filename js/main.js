// 移动端菜单
function onMobileNavShow() {
  const body = document.body;
  const navToggle = document.getElementById('sea-nav-toggle');
  const dimmer = document.getElementById('sea-nav-dimmer');
  const closeBtn = document.getElementById('sea-menu-close-icon');
  const CLASS_NAME = 'sea-nav-on';
  if (!navToggle) return;

  navToggle.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    body.classList.toggle(CLASS_NAME);
  });

  const closeFun = (e) => {
    if (!body.classList.contains(CLASS_NAME)) return;
    e.preventDefault();
    body.classList.remove(CLASS_NAME);
  };

  dimmer.addEventListener('click', closeFun);
  closeBtn.addEventListener('click', closeFun);
}

function createImageLightbox() {
  let lightbox = document.getElementById('sea-image-lightbox');
  if (lightbox) return lightbox;

  lightbox = document.createElement('div');
  lightbox.id = 'sea-image-lightbox';
  lightbox.className = 'sea-image-lightbox';
  lightbox.innerHTML = [
    '<button type="button" class="sea-image-lightbox__close" aria-label="Close image preview">&times;</button>',
    '<div class="sea-image-lightbox__inner">',
    '  <img class="sea-image-lightbox__image" alt="">',
    '</div>'
  ].join('');

  const closeBtn = lightbox.querySelector('.sea-image-lightbox__close');

  const closeLightbox = () => {
    lightbox.classList.remove('sea-image-lightbox--open');
    document.body.classList.remove('sea-image-lightbox-on');
  };

  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox || e.target === closeBtn) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && lightbox.classList.contains('sea-image-lightbox--open')) {
      closeLightbox();
    }
  });

  lightbox.closeLightbox = closeLightbox;
  document.body.appendChild(lightbox);
  return lightbox;
}

function applyArticleImageScale(img) {
  if (!img.naturalWidth) return;

  const content = img.closest('.sea-article-content, .sea-doc');
  const contentWidth = content ? content.clientWidth : window.innerWidth;
  const maxDisplayRatio = window.innerWidth <= 768 ? 0.82 : 0.55;
  const displayScale = 0.5;
  const baseWidth = Math.min(
    Math.round(img.naturalWidth * 0.3),
    Math.round(contentWidth * maxDisplayRatio)
  );
  const targetWidth = Math.max(1, Math.round(baseWidth * displayScale));

  img.style.zoom = '1';
  img.style.width = `${targetWidth}px`;
  img.style.maxWidth = '100%';
  img.style.height = 'auto';
}

function onArticleImagesReady() {
  const images = document.querySelectorAll('.sea-doc img');
  if (!images.length) return;

  const lightbox = createImageLightbox();
  const lightboxImage = lightbox.querySelector('.sea-image-lightbox__image');
  const rescaleImages = function () {
    images.forEach(function (img) {
      applyArticleImageScale(img);
    });
  };

  images.forEach(function (img) {
    const onImageLoad = function () {
      applyArticleImageScale(img);
    };

    if (img.complete) {
      onImageLoad();
    } else {
      img.addEventListener('load', onImageLoad, { once: true });
    }

    img.classList.add('sea-doc-image');

    img.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();

      lightboxImage.src = img.currentSrc || img.src;
      lightboxImage.alt = img.alt || '';
      lightbox.classList.add('sea-image-lightbox--open');
      document.body.classList.add('sea-image-lightbox-on');
    });
  });

  window.addEventListener('resize', rescaleImages);
}

onMobileNavShow();
onArticleImagesReady();
