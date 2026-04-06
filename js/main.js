const MOBILE_MEDIA_BREAKPOINT = 768;
const MEDIA_MOBILE_MAX_RATIO = 1;
const MEDIA_DESKTOP_MAX_RATIO = 0.92;
const MEDIA_MOBILE_VIEWPORT_PADDING_RATIO = 0.96;
const MEDIA_DESKTOP_VIEWPORT_PADDING_RATIO = 0.9;

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

function resolveMediaContainerWidth(element) {
  const content = element.closest('.sea-article-content, .sea-doc');
  return content ? content.clientWidth : window.innerWidth;
}

function getAdaptiveMediaWidth(intrinsicWidth, containerWidth) {
  const isMobile = window.innerWidth <= MOBILE_MEDIA_BREAKPOINT;
  const ratioByDevice = isMobile ? MEDIA_MOBILE_MAX_RATIO : MEDIA_DESKTOP_MAX_RATIO;
  const viewportRatio = isMobile
    ? MEDIA_MOBILE_VIEWPORT_PADDING_RATIO
    : MEDIA_DESKTOP_VIEWPORT_PADDING_RATIO;
  const widthByContainer = Math.round(containerWidth * ratioByDevice);
  const widthByViewport = Math.round(window.innerWidth * viewportRatio);
  const maxWidth = Math.max(1, Math.min(widthByContainer, widthByViewport));

  if (!intrinsicWidth || intrinsicWidth <= 0) {
    return maxWidth;
  }

  return Math.max(1, Math.min(Math.round(intrinsicWidth), maxWidth));
}

function applyArticleImageScale(img) {
  const contentWidth = resolveMediaContainerWidth(img);
  const targetWidth = getAdaptiveMediaWidth(img.naturalWidth, contentWidth);

  img.style.removeProperty('zoom');
  img.style.width = targetWidth + 'px';
  img.style.maxWidth = '100%';
  img.style.height = 'auto';
}

function applyArticleVideoScale(video) {
  const contentWidth = resolveMediaContainerWidth(video);
  const intrinsicWidth = video.videoWidth || 0;
  const targetWidth = getAdaptiveMediaWidth(intrinsicWidth, contentWidth);

  video.style.width = targetWidth + 'px';
  video.style.maxWidth = '100%';
  video.style.height = 'auto';
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

function onArticleVideosReady() {
  const videos = document.querySelectorAll('.sea-doc video');
  if (!videos.length) return;

  const rescaleVideos = function () {
    videos.forEach(function (video) {
      applyArticleVideoScale(video);
    });
  };

  videos.forEach(function (video) {
    const onVideoReady = function () {
      applyArticleVideoScale(video);
    };

    if (video.readyState >= 1) {
      onVideoReady();
    } else {
      video.addEventListener('loadedmetadata', onVideoReady, { once: true });
    }
  });

  window.addEventListener('resize', rescaleVideos);
}

onMobileNavShow();
onArticleImagesReady();
onArticleVideosReady();








