import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.MOCK_PORT ?? 4321);

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const USERS = [
  {
    email: 'alice.qa@example.com',
    password: process.env.MOCK_PASSWORD ?? 'demo1234',
    name: 'Alice Chen',
    headline: 'Senior QA Automation Engineer',
  },
  {
    email: 'bob.qa@example.com',
    password: process.env.MOCK_PASSWORD ?? 'demo1234',
    name: 'Bob Liu',
    headline: 'SDET · API & UI automation',
  },
];

const contactStep = (fields) => ({ name: 'Contact info', fields });
const resumeStep = {
  name: 'Resume',
  fields: [
    {
      id: 'resume',
      label: 'Resume',
      type: 'file',
      required: true,
      accept: '.pdf,.doc,.docx',
      maxSizeMb: 2,
      hint: 'PDF, DOC or DOCX. Maximum 2 MB.',
    },
  ],
};
const reviewStep = { name: 'Review', review: true };

const JOBS = [
  {
    id: '1001',
    title: 'Senior QA Automation Engineer',
    company: 'Acme Cloud',
    location: 'Remote — United States',
    posted: '2 days ago',
    easyApply: true,
    description:
      'Own the end-to-end test strategy for our cloud console. Playwright, TypeScript, CI/CD, and a strong bias for developer experience.',
    steps: [
      contactStep([
        { id: 'firstName', label: 'First name', type: 'text', required: true, autocomplete: 'given-name' },
        { id: 'lastName', label: 'Last name', type: 'text', required: true, autocomplete: 'family-name' },
        { id: 'email', label: 'Email address', type: 'email', required: true, autocomplete: 'email' },
        { id: 'phone', label: 'Mobile phone number', type: 'tel', required: false, autocomplete: 'tel' },
      ]),
      resumeStep,
      reviewStep,
    ],
  },
  {
    id: '1002',
    title: 'SDET II',
    company: 'Nimbus Labs',
    location: 'Shanghai, China (Hybrid)',
    posted: '5 days ago',
    easyApply: true,
    description: 'Build API and UI automation for a data platform. Python or TypeScript welcome.',
    steps: [
      contactStep([{ id: 'email', label: 'Email address', type: 'email', required: true, autocomplete: 'email' }]),
      reviewStep,
    ],
  },
  {
    id: '1003',
    title: 'Product Designer',
    company: 'Vertex Studio',
    location: 'London, UK',
    posted: '1 week ago',
    easyApply: false,
    description: 'Design systems, prototyping, and close collaboration with engineering.',
    steps: [],
  },
  {
    id: '1004',
    title: 'Frontend Engineer',
    company: 'Ghost Systems',
    location: 'Remote',
    posted: '3 weeks ago',
    easyApply: false,
    broken: true,
    description: 'React, TypeScript, design systems. This posting has been closed.',
    steps: [],
  },
];

const applications = [];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const escapeHtml = (value = '') =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

function redirect(res, location) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
}

function parseCookies(req) {
  const header = req.headers.cookie ?? '';
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function sessionUser(req) {
  const token = parseCookies(req).li_at ?? '';
  if (!token.startsWith('mock.')) return null;
  const email = Buffer.from(token.slice(5), 'base64url').toString('utf8');
  return USERS.find((user) => user.email === email) ?? null;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function requireUser(req, res) {
  const user = sessionUser(req);
  if (!user) {
    redirect(res, `/login?redirect=${encodeURIComponent(req.url)}`);
    return null;
  }
  return user;
}

/* -------------------------------------------------------------------------- */
/* Pages                                                                       */
/* -------------------------------------------------------------------------- */

function layout({ title, user, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | LinkedIn (fixture)</title>
  <link rel="stylesheet" href="/public/styles.css">
</head>
<body>
  <header class="global-nav">
    <a class="brand" href="/feed"><span class="brand-mark">in</span> Jobs fixture</a>
    ${
      user
        ? `<nav class="global-nav__links">
            <a href="/feed">Home</a>
            <a href="/jobs">Jobs</a>
            <span class="nav-user" data-test-signed-in-user="${escapeHtml(user.email)}">${escapeHtml(user.name)}</span>
            <a href="/logout" class="nav-signout">Sign out</a>
          </nav>`
        : `<nav class="global-nav__links"><a href="/login">Sign in</a></nav>`
    }
  </header>
  <main class="page">${body}</main>
  <footer class="footer">Local LinkedIn-compatible fixture for the Easy Apply test suite — no real data.</footer>
  <script src="/public/app.js"></script>
</body>
</html>`;
}

function loginPage({ error = '', redirectTo = '/jobs' } = {}) {
  return layout({
    title: 'Sign in',
    user: null,
    body: `
    <section class="auth-card">
      <h1>Sign in</h1>
      <p class="muted">Fixture accounts: <code>alice.qa@example.com</code> / <code>bob.qa@example.com</code> — password <code>demo1234</code>.</p>
      ${error ? `<div class="alert alert-error" role="alert">${escapeHtml(error)}</div>` : ''}
      <form method="post" action="/login" class="auth-form">
        <input type="hidden" name="redirect" value="${escapeHtml(redirectTo)}">
        <label for="username">Email</label>
        <input id="username" name="email" type="email" autocomplete="username" required>
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required>
        <button type="submit" class="btn btn-primary">Sign in</button>
      </form>
    </section>`,
  });
}

function feedPage(user) {
  return layout({
    title: 'Feed',
    user,
    body: `
    <section class="feed">
      <h1 data-test-signed-in-user="${escapeHtml(user.email)}">Signed in as ${escapeHtml(user.name)}</h1>
      <p class="muted">${escapeHtml(user.headline)}</p>
      <div class="card">
        <h2>Your job alerts</h2>
        <p>3 new Easy Apply jobs match your profile.</p>
        <a class="btn btn-primary" href="/jobs">Browse jobs</a>
      </div>
    </section>`,
  });
}

function jobCards(jobs) {
  if (jobs.length === 0) {
    return `<li class="empty">No matching jobs. Try another keyword.</li>`;
  }
  return jobs
    .map(
      (job) => `
      <li class="jobs-search-results__list-item" data-occludable-job-id="${job.id}">
        <div class="job-card-container">
          <a class="job-card-container__link" href="/jobs/view/${job.id}"><strong>${escapeHtml(job.title)}</strong></a>
          <div class="artdeco-entity-lockup__subtitle">${escapeHtml(job.company)} · ${escapeHtml(job.location)}</div>
          <div class="job-card-container__metadata">${escapeHtml(job.posted)}</div>
          ${
            job.easyApply && !job.broken
              ? `<ul class="job-card-container__footer"><li class="job-card-container__apply-method">Easy Apply</li></ul>`
              : `<ul class="job-card-container__footer"><li class="job-card-container__apply-method job-card-container__apply-method--external">${job.broken ? 'Closed' : 'External apply'}</li></ul>`
          }
        </div>
      </li>`,
    )
    .join('');
}

function searchPage({ user, query, easyApplyOnly, results }) {
  return layout({
    title: 'Jobs',
    user,
    body: `
    <section class="jobs-search">
      <form class="jobs-search-box" method="get" action="/jobs" role="search">
        <input class="jobs-search-box__keyboard-text-input" name="q" aria-label="Search by title, skill, or company"
               placeholder="Search by title, skill, or company" value="${escapeHtml(query)}">
        <button class="jobs-search-box__submit-button btn btn-primary" type="submit">Search</button>
      </form>

      <div class="filter-bar">
        <label class="filter-pill">
          <input type="checkbox" id="f_AL" ${easyApplyOnly ? 'checked' : ''}> Easy Apply
        </label>
        <span class="muted" data-test-result-count>${results.length} result${results.length === 1 ? '' : 's'}</span>
      </div>

      <ul class="jobs-search-results__list">
        ${jobCards(results)}
      </ul>
    </section>

    <script>
      document.getElementById('f_AL')?.addEventListener('change', (event) => {
        const url = new URL(window.location.href);
        if (event.target.checked) url.searchParams.set('f_AL', '1');
        else url.searchParams.delete('f_AL');
        window.location.href = url.toString();
      });
      document.querySelector('.jobs-search-box')?.addEventListener('submit', (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const url = new URL(form.action, window.location.origin);
        url.searchParams.set('q', form.querySelector('input[name="q"]').value);
        window.location.href = url.toString();
      });
    </script>`,
  });
}

function jobPage({ user, job }) {
  const applyControl =
    job.easyApply && !job.broken
      ? `<button class="jobs-apply-button artdeco-button artdeco-button--3 artdeco-button--primary"
                 type="button" aria-label="Easy Apply to ${escapeHtml(job.title)} at ${escapeHtml(job.company)}">Easy Apply</button>`
      : job.broken
        ? `<div class="jobs-apply-button--disabled" data-test-job-closed>No longer accepting applications</div>`
        : `<button class="jobs-apply-button artdeco-button artdeco-button--3 artdeco-button--secondary"
                   type="button" aria-label="Apply to ${escapeHtml(job.title)} at ${escapeHtml(job.company)}">Apply</button>`;

  return layout({
    title: job.title,
    user,
    body: `
    <section class="job-details jobs-search__job-details--container" data-job-id="${job.id}">
      <a class="back-link" href="/jobs">← Back to search</a>
      <h1 class="job-details-jobs-unified-top-card__job-title">${escapeHtml(job.title)}</h1>
      <div class="job-details-jobs-unified-top-card__company-name">${escapeHtml(job.company)}</div>
      <div class="job-details-jobs-unified-top-card__primary-description">${escapeHtml(job.location)} · ${escapeHtml(job.posted)}</div>
      <div class="job-actions">${applyControl}</div>
      <section class="job-description">
        <h2>About the job</h2>
        <p>${escapeHtml(job.description)}</p>
        <h3>What you'll do</h3>
        <ul>
          <li>Design and maintain end-to-end test suites in CI.</li>
          <li>Partner with engineers on testability and fast feedback.</li>
          <li>Track quality signals and drive down flakiness.</li>
        </ul>
      </section>
    </section>
    <div id="easy-apply-root"></div>
    <script>window.__JOB__ = ${JSON.stringify({
      ...job,
      steps: job.steps,
    }).replace(/</g, '\\u003c')};</script>`,
  });
}

function errorPage({ user, title, message }) {
  return layout({
    title,
    user,
    body: `<section class="card error-card"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a class="btn" href="/jobs">Back to jobs</a></section>`,
  });
}

/* -------------------------------------------------------------------------- */
/* Routing                                                                     */
/* -------------------------------------------------------------------------- */

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;

  try {
    if (pathname === '/healthz') {
      return sendJson(res, 200, { ok: true, jobs: JOBS.length });
    }

    if (pathname === '/favicon.ico') {
      res.writeHead(204);
      return res.end();
    }

    if (pathname.startsWith('/public/')) {
      const file = path.join(__dirname, 'public', pathname.replace('/public/', ''));
      const extension = path.extname(file);
      const types = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
      if (!types[extension]) return send(res, 404, 'Not found');
      try {
        const content = await readFile(file);
        return send(res, 200, content, { 'Content-Type': types[extension] });
      } catch {
        return send(res, 404, 'Not found');
      }
    }

    if (pathname === '/') return redirect(res, '/jobs');

    if (pathname === '/login' && req.method === 'GET') {
      const user = sessionUser(req);
      if (user) return redirect(res, '/feed');
      return send(res, 200, loginPage({ redirectTo: url.searchParams.get('redirect') ?? '/jobs' }));
    }

    if (pathname === '/login' && req.method === 'POST') {
      const body = new URLSearchParams(await readBody(req));
      const email = (body.get('email') ?? '').trim().toLowerCase();
      const password = body.get('password') ?? '';
      const redirectTo = body.get('redirect') || '/jobs';
      const user = USERS.find((candidate) => candidate.email === email && candidate.password === password);

      if (!user) {
        return send(res, 200, loginPage({ error: 'Wrong email or password.', redirectTo }));
      }
      const token = `mock.${Buffer.from(user.email).toString('base64url')}`;
      res.setHeader(
        'Set-Cookie',
        `li_at=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`,
      );
      return redirect(res, redirectTo.startsWith('/') ? redirectTo : '/jobs');
    }

    if (pathname === '/logout') {
      res.setHeader('Set-Cookie', 'li_at=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
      return redirect(res, '/login');
    }

    if (pathname === '/feed') {
      const user = requireUser(req, res);
      if (!user) return;
      return send(res, 200, feedPage(user));
    }

    if (pathname === '/api/session') {
      const user = requireUser(req, res);
      if (!user) return;
      return sendJson(res, 200, { email: user.email, name: user.name });
    }

    if (pathname === '/jobs') {
      const user = requireUser(req, res);
      if (!user) return;

      const query = (url.searchParams.get('q') ?? '').trim();
      const easyApplyOnly = ['1', 'true'].includes(url.searchParams.get('f_AL') ?? '');
      const results = JOBS.filter((job) => {
        if (easyApplyOnly && !job.easyApply) return false;
        if (!query) return true;
        return `${job.title} ${job.company}`.toLowerCase().includes(query.toLowerCase());
      });

      return send(res, 200, searchPage({ user, query, easyApplyOnly, results }));
    }

    const jobMatch = /^\/jobs\/view\/([^/]+)$/.exec(pathname);
    if (jobMatch) {
      const user = requireUser(req, res);
      if (!user) return;

      const id = jobMatch[1];
      if (id === '1005') {
        return send(res, 500, errorPage({ user, title: 'Something went wrong', message: 'The job page failed to load (simulated 500).' }));
      }
      const job = JOBS.find((candidate) => candidate.id === id);
      if (!job) {
        return send(res, 404, errorPage({ user, title: 'Job not found', message: `No job with id ${id}.` }));
      }
      return send(res, 200, jobPage({ user, job }));
    }

    if (pathname === '/api/applications' && req.method === 'POST') {
      const user = requireUser(req, res);
      if (!user) return;
      const payload = JSON.parse((await readBody(req)) || '{}');
      applications.push({ at: new Date().toISOString(), user: user.email, ...payload });
      return sendJson(res, 201, { ok: true, id: applications.length });
    }

    if (pathname === '/api/applications/count') {
      const user = requireUser(req, res);
      if (!user) return;
      const mine = applications.filter((application) => application.user === user.email);
      return sendJson(res, 200, { count: mine.length });
    }

    return send(res, 404, errorPage({ user: sessionUser(req), title: 'Not found', message: `${req.method} ${pathname}` }));
  } catch (error) {
    console.error('[mock] request failed', error);
    return send(res, 500, errorPage({ user: null, title: 'Fixture error', message: String(error) }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock] LinkedIn-compatible fixture listening on http://127.0.0.1:${PORT}`);
});
