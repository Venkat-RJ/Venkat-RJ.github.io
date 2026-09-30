export const accounts = ['Venkat-RJ', 'VenkatPortoAI', 'PranaAlphaLabs', 'venkat-lokaah'];
const profile = 'https://github.com/Venkat-RJ';
const query = `is:pr is:public ${accounts.map(name => `author:${name}`).join(' ')}`;
const search = `https://github.com/search?type=pullrequests&q=${encodeURIComponent(query)}`;
const clean = value => String(value ?? '').replace(/\u2014/g, ', ');
const esc = value => clean(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => new Date(value).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric', timeZone:'Asia/Kolkata'});
const descriptions = {
  'Venkat-RJ/Venkat-RJ.github.io': 'My personal website.',
  'Venkat-RJ/autoresearch-mac-mini': 'Adaptation of Karpathy’s autoresearch for Apple MPS, CPU, and CUDA.',
  'Venkat-RJ/razorpay-integration-plugin': 'Payment and billing workflows for Claude Code.',
};
export function pullState(pull) {
  if (pull.pull_request?.merged_at) return 'Merged';
  if (pull.state === 'closed') return 'Closed';
  return pull.draft ? 'Draft' : 'Open';
}
function githubURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' ? url.href : profile;
  } catch { return profile; }
}
export function render(data) {
  const repos = [...data.repos].sort((a,b) => Date.parse(b.pushed_at) - Date.parse(a.pushed_at));
  const pulls = [...data.pulls.items].sort((a,b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  const accountRows = accounts.map(name => {
    const count = repos.filter(repo => repo.owner.login.toLowerCase() === name.toLowerCase()).length;
    return `<li><a href="https://github.com/${name}">@${name}</a><span>${count ? `${count} public ${count === 1 ? 'repository' : 'repositories'}` : 'No public repositories'}</span></li>`;
  }).join('');
  const repoRows = repos.map(repo => `<li class="github-repo">
    <div class="github-row-title"><a href="${esc(githubURL(repo.html_url))}">${esc(repo.name)}</a>${repo.fork ? '<span class="github-tag">Fork</span>' : ''}${repo.archived ? '<span class="github-tag">Archived</span>' : ''}</div>
    <p>${esc(descriptions[repo.full_name] || repo.description || 'Public repository.')}</p>
    <div class="github-meta">${esc(repo.owner.login)}${repo.language ? ' · ' + esc(repo.language) : ''}<br>Repository updated ${esc(date(repo.pushed_at))}</div>
  </li>`).join('');
  const pullRows = pulls.map(pull => {
    const url = githubURL(pull.html_url);
    const path = new URL(url).pathname.split('/').filter(Boolean);
    const context = path.length >= 4 ? `${path[0]}/${path[1]} #${path[3]}` : '';
    const state = pullState(pull);
    return `<li class="github-pull"><div><a href="${esc(url)}">${esc(pull.title)}</a><div class="github-meta">${esc(context)} · ${esc(pull.user.login)}<br>Updated ${esc(date(pull.updated_at))}</div></div><span class="github-state state-${state.toLowerCase()}">${state}</span></li>`;
  });
  return `<ul class="github-accounts">${accountRows}</ul>
    <p class="github-totals">${repos.length} public repositories, including ${repos.filter(repo => repo.fork).length} forks · ${data.pulls.total_count} public pull requests</p>
    <div class="github-subheading"><h3>Repositories</h3><span>Latest updates first</span></div>
    <ul class="github-repos">${repoRows || '<li>No public repositories available.</li>'}</ul>
    <div class="github-subheading"><h3>Recent pull requests</h3><a href="${search}">All pull requests ↗</a></div>
    <ul class="github-pulls">${pullRows.slice(0,4).join('') || '<li>No public pull requests available.</li>'}</ul>
    ${pullRows.length > 4 ? `<details class="github-more"><summary>Show ${pullRows.length - 4} more recent pull requests</summary><ul class="github-pulls">${pullRows.slice(4).join('')}</ul></details>` : ''}`;
}
async function getJSON(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(),10000);
  try {
    const response = await fetch(url, {headers:{Accept:'application/vnd.github+json'},signal:controller.signal,credentials:'omit'});
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timeout); }
}
export async function loadPublicData() {
  async function repositories(account) {
    const repos = [];
    for (let page=1; ; page++) {
      const batch = await getJSON(`https://api.github.com/users/${account}/repos?sort=pushed&per_page=100&page=${page}`);
      if (!Array.isArray(batch)) throw new Error('Invalid repository response');
      repos.push(...batch.filter(repo => !repo.private).map(repo => ({
        id:repo.id,name:repo.name,full_name:repo.full_name,html_url:repo.html_url,description:repo.description,
        fork:repo.fork,archived:repo.archived,language:repo.language,pushed_at:repo.pushed_at,owner:{login:repo.owner.login},
      })));
      if (batch.length < 100) return repos;
    }
  }
  const results = await Promise.allSettled([
    ...accounts.map(repositories),
    getJSON(`https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=12`),
  ]);
  if (results.some(result => result.status !== 'fulfilled')) throw new Error('Public data unavailable');
  const pulls = results.pop().value;
  if (!Array.isArray(pulls.items) || pulls.incomplete_results || !Number.isInteger(pulls.total_count)) throw new Error('Incomplete pull request response');
  const repos = [...new Map(results.flatMap(result => result.value).map(repo => [repo.id,repo])).values()];
  return {accounts,fetchedAt:new Date().toISOString(),repos,pulls:{total_count:pulls.total_count,items:pulls.items.map(pull => ({
    id:pull.id,title:pull.title,html_url:pull.html_url,state:pull.state,draft:pull.draft,updated_at:pull.updated_at,
    user:{login:pull.user.login},pull_request:{merged_at:pull.pull_request?.merged_at},
  }))}};
}
function valid(data) {
  return data && JSON.stringify(data.accounts) === JSON.stringify(accounts) && Number.isFinite(Date.parse(data.fetchedAt)) && Array.isArray(data.repos) && data.repos.every(repo => repo?.owner?.login && repo.name) && Number.isInteger(data.pulls?.total_count) && Array.isArray(data.pulls.items) && data.pulls.items.every(pull => pull?.user?.login && pull.title);
}
export async function refresh(container,status,snapshot,storage) {
  const key = 'portfolio-github-four-accounts-v1';
  let saved = snapshot;
  try {
    const cache = JSON.parse(storage?.getItem(key) || 'null');
    if (valid(cache) && Date.parse(cache.fetchedAt) > Date.parse(saved.fetchedAt) && Date.parse(cache.fetchedAt) <= Date.now()) saved = cache;
  } catch { /* Storage is optional. */ }
  container.innerHTML = render(saved);
  if (Date.now() - Date.parse(saved.fetchedAt) < 15*60*1000) {
    status.textContent = `Public GitHub data checked ${date(saved.fetchedAt)}. Private work is not included.`;
    return;
  }
  try {
    const data = await loadPublicData();
    container.innerHTML = render(data);
    status.textContent = `Updated from GitHub ${date(data.fetchedAt)}. Private work is not included.`;
    try { storage?.setItem(key,JSON.stringify(data)); } catch { /* Keep the live view without caching. */ }
  } catch {
    status.textContent = `Saved public GitHub data from ${date(saved.fetchedAt)}. Live update unavailable; profile links still work.`;
  }
}
if (typeof document !== 'undefined') {
  const container = document.getElementById('github-content');
  const status = document.getElementById('github-status');
  const source = document.getElementById('github-snapshot');
  if (container && status && source) {
    let storage;
    try { storage = localStorage; } catch { /* Storage may be disabled. */ }
    refresh(container,status,JSON.parse(source.textContent),storage);
  }
}
