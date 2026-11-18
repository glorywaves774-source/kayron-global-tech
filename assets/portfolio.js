// Renders portfolio projects managed in the admin dashboard.
// All text is inserted with textContent so admin-entered content can never run as code.
(function () {
  const grid = document.getElementById('portfolioGrid');
  const empty = document.getElementById('portfolioEmpty');
  if (!grid) return;

  function isWebLink(value) {
    try { const u = new URL(value); return u.protocol === 'https:' || u.protocol === 'http:'; } catch { return false; }
  }

  function card(project, index) {
    const article = document.createElement('article');
    article.className = 'portfolio-card';

    const number = document.createElement('span');
    number.className = 'card-index';
    number.textContent = String(index + 1).padStart(2, '0');

    const title = document.createElement('h2');
    title.textContent = project.name;

    article.append(number, title);

    if (project.project) {
      const sub = document.createElement('p');
      sub.className = 'portfolio-project';
      sub.textContent = project.project;
      article.append(sub);
    }
    const tags = [['Industry', project.industry], ['Service', project.service]].filter((t) => t[1]);
    if (tags.length) {
      const ul = document.createElement('ul');
      ul.className = 'portfolio-tags';
      tags.forEach(([label, value]) => {
        const li = document.createElement('li');
        li.title = label;
        li.textContent = value;
        ul.append(li);
      });
      article.append(ul);
    }

    if (project.description) {
      const desc = document.createElement('p');
      desc.textContent = project.description;
      article.append(desc);
    }

    if (project.client) {
      const client = document.createElement('p');
      client.className = 'portfolio-client';
      const label = document.createElement('span');
      label.textContent = 'Client';
      client.append(label, document.createTextNode(' ' + project.client));
      article.append(client);
    }

    if (project.url && isWebLink(project.url)) {
      const link = document.createElement('a');
      link.className = 'text-link portfolio-link';
      link.href = project.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Open live system';
      link.setAttribute('aria-label', 'Open ' + project.name + ' (opens in a new tab)');
      article.classList.add('has-link');
      const arrow = document.createElement('span');
      arrow.textContent = '↗';
      link.append(arrow);
      article.append(link);
    }
    return article;
  }

  fetch('/api/projects', { headers: { Accept: 'application/json' } })
    .then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json(); })
    .then((data) => {
      const projects = Array.isArray(data.projects) ? data.projects : [];
      grid.replaceChildren();
      if (!projects.length) { grid.hidden = true; empty.hidden = false; if (window.kayronReveal) window.kayronReveal([empty]); return; }
      projects.forEach((p, i) => grid.append(card(p, i)));
      if (window.kayronReveal) window.kayronReveal(grid.children);
    })
    .catch(() => {
      grid.replaceChildren();
      grid.hidden = true;
      empty.hidden = false;
    })
    .finally(() => grid.removeAttribute('aria-busy'));
})();
