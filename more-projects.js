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

const projectGrid = document.querySelector('.more-projects-grid');
const viewButtons = document.querySelectorAll('.project-view-controls [data-view]');
try {
  const restore = JSON.parse(sessionStorage.getItem('portfolioArchiveRestore') || 'null');
  if (restore) {
    sessionStorage.removeItem('portfolioArchiveRestore');
    const isList = restore.view === 'list';
    projectGrid.classList.toggle('is-list-view', isList);
    projectGrid.classList.toggle('is-grid-view', !isList);
    viewButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === restore.view)));
    requestAnimationFrame(() => window.scrollTo(0, restore.scroll || 0));
  }
} catch { /* Keep the default grid if session storage is unavailable. */ }
viewButtons.forEach(button => button.addEventListener('click', () => {
  const isGrid = button.dataset.view === 'grid';
  projectGrid.classList.toggle('is-grid-view', isGrid);
  projectGrid.classList.toggle('is-list-view', !isGrid);
  viewButtons.forEach(option => option.setAttribute('aria-pressed', String(option === button)));
}));
document.querySelectorAll('.more-project-card').forEach(card => card.addEventListener('click', () => {
  try {
    sessionStorage.setItem('portfolioProjectReturn', JSON.stringify({
      url: location.href,
      scroll: window.scrollY,
      view: projectGrid.classList.contains('is-list-view') ? 'list' : 'grid'
    }));
  } catch { /* The project still opens if session storage is unavailable. */ }
}));
