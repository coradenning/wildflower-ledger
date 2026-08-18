// Wildflower Hub — shared navigation + ambient background
// Single source of truth for the nav bar (rendered inside .cover) and the
// floral-overlay / stars / fireflies ambience used on every page.
// Set window.HUB_ACTIVE = 'todos' (etc.) before this script loads to
// highlight the current page.

(function () {
  const LINKS = [
    { key: 'home',    label: 'Home',      href: 'index.html' },
    { key: 'todos',   label: 'To-Dos',    href: 'todos.html' },
    { key: 'planner', label: 'Planner',   href: 'planner.html' },
    { key: 'ledger',  label: 'Ledger',    href: 'ledger.html' },
    { key: 'budget',  label: 'Budget',    href: 'budget.html' },
    { key: 'goals',   label: 'Goals',     href: 'goals.html' },
    { key: 'journal', label: 'Journal',   href: 'journal.html' },
    { key: 'inbox',   label: 'Inbox',     href: 'inbox.html' },
  ];

  function renderNav() {
    const mount = document.getElementById('hub-nav');
    if (!mount) return;

    const active = window.HUB_ACTIVE || '';

    const linkHtml = LINKS.map((link) => {
      const isActive = link.key === active;
      return `<a href="${link.href}"${isActive ? ' class="is-active" aria-current="page"' : ''}>${link.label}</a>`;
    }).join('');

    mount.classList.add('hub-nav');
    mount.innerHTML = `
      <div class="hub-nav__brand">
        <span class="hub-nav__brand-text">wildflower<span class="hub-nav__brand-accent">_hub</span></span>
      </div>
      <nav class="hub-nav__links" aria-label="Main">
        ${linkHtml}
      </nav>
    `;
  }

  function seedAmbience() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const bg = document.createElement('div');
    bg.className = 'page-bg';

    const stars = document.createElement('div');
    stars.className = 'page-stars';
    const starSpots = [
      [8,15],[14,70],[20,40],[11,88],[26,22],[17,55]
    ];
    starSpots.forEach(([top,left],i)=>{
      const s = document.createElement('span');
      s.style.top = top+'%'; s.style.left = left+'%';
      s.style.width = s.style.height = (i%2?1.5:2)+'px';
      s.style.animationDelay = (i*0.6)+'s';
      stars.appendChild(s);
    });

    const fireflies = document.createElement('div');
    fireflies.className = 'page-fireflies';
    const flySpots = [
      [35,12],[55,80],[70,25],[45,60],[85,70],[62,45]
    ];
    flySpots.forEach(([top,left],i)=>{
      const s = document.createElement('span');
      s.style.top = top+'%'; s.style.left = left+'%';
      s.style.animationDelay = (i*0.9)+'s';
      fireflies.appendChild(s);
    });

    bg.appendChild(stars);
    bg.appendChild(fireflies);
    document.body.prepend(bg);

    const overlay = document.createElement('div');
    overlay.className = 'floral-overlay';
    document.body.prepend(overlay);
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderNav();
    seedAmbience();
  });
})();
