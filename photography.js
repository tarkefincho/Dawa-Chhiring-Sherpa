const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.site-header nav');
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  navigation.classList.toggle('is-open', open);
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  navigation.classList.remove('is-open');
  menuButton.setAttribute('aria-expanded', 'false');
}));

const lightbox = document.querySelector('.image-lightbox');
const lightboxImage = document.querySelector('#photo-lightbox-image');
const photos = [...document.querySelectorAll('.photo-zoom')];
let activePhoto = 0;
function showPhoto(index) {
  activePhoto = (index + photos.length) % photos.length;
  const photo = photos[activePhoto];
  lightboxImage.src = photo.dataset.image;
  lightboxImage.alt = photo.dataset.alt;
  document.querySelector('.lightbox-prev').hidden = photos.length < 2;
  document.querySelector('.lightbox-next').hidden = photos.length < 2;
}
photos.forEach((photo, index) => photo.addEventListener('click', () => {
  showPhoto(index);
  lightbox.showModal();
}));
document.querySelector('.lightbox-prev').addEventListener('click', () => showPhoto(activePhoto - 1));
document.querySelector('.lightbox-next').addEventListener('click', () => showPhoto(activePhoto + 1));
document.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
lightbox.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') { event.preventDefault(); showPhoto(activePhoto - 1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); showPhoto(activePhoto + 1); }
});
let swipeStartX = null;
lightbox.addEventListener('pointerdown', event => { swipeStartX = event.clientX; });
lightbox.addEventListener('pointerup', event => {
  if (swipeStartX === null) return;
  const distance = event.clientX - swipeStartX;
  swipeStartX = null;
  if (Math.abs(distance) > 55) showPhoto(activePhoto + (distance < 0 ? 1 : -1));
});
