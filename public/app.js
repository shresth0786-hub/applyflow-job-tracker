import { boards, compareKeywords } from './logic.js';
const $ = selector => document.querySelector(selector);
const storageKey = 'applyflow-applications-v1';
const statuses = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];
let applications = [];
try { const data = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (Array.isArray(data)) applications = data.filter(item => item && typeof item.title === 'string' && typeof item.company === 'string' && statuses.includes(item.status)); } catch { /* Start with an empty list if storage is unavailable or malformed. */ }
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
function notify(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('visible'); clearTimeout(notify.timer); notify.timer = setTimeout(() => toast.classList.remove('visible'), 3000); }
function save() { try { localStorage.setItem(storageKey, JSON.stringify(applications)); return true; } catch { notify('Could not save in this browser. Your changes may not persist.'); return false; } }
function safeUrl(value) { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
function renderApplications() {
  $('#total-count').textContent = applications.length;
  $('#application-count').textContent = applications.length;
  $('#progress-count').textContent = applications.filter(a => a.status === 'Applied').length;
  $('#interview-count').textContent = applications.filter(a => a.status === 'Interview').length;
  $('#offer-count').textContent = applications.filter(a => a.status === 'Offer').length;
  const list = $('#application-list');
  if (!applications.length) { list.innerHTML = '<div class="empty-state"><div class="empty-icon">▤<span>✦</span></div><div><strong>Your next opportunity starts here</strong><p>Found a role you like? Add it here and keep track of your progress.</p></div><button class="button button-light" data-open-dialog>＋ Add application</button></div>'; return; }
  list.innerHTML = applications.map((item, index) => { const url = safeUrl(item.url); return `<div class="application-row"><div class="company-avatar">${escapeHtml(item.company.charAt(0).toUpperCase())}</div><div class="application-info"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.company)}${url ? ` · <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">View job ↗</a>` : ''}</span></div><label class="sr-only" for="status-${index}">Status for ${escapeHtml(item.title)} at ${escapeHtml(item.company)}</label><select id="status-${index}" class="status-select" data-index="${index}">${statuses.map(status => `<option${item.status === status ? ' selected' : ''}>${status}</option>`).join('')}</select><button class="delete-button" data-delete="${index}" aria-label="Remove ${escapeHtml(item.title)} at ${escapeHtml(item.company)}">×</button></div>`; }).join('');
}
function updateBoards() {
  const keyword = $('#keyword').value.trim(); const location = $('#location').value.trim();
  $('#boards').innerHTML = boards.map(board => `<a class="board" href="${escapeHtml(board.url(keyword, location))}" target="_blank" rel="noopener noreferrer" data-board="${board.id}"><span class="board-logo ${board.color}">${board.mark}</span><span class="board-copy"><strong>${board.name}</strong><small>${board.subtitle}</small></span><span class="board-arrow">↗</span></a>`).join('');
}
$('#today').textContent = new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
renderApplications(); updateBoards();
$('#keyword').addEventListener('input', updateBoards); $('#location').addEventListener('input', updateBoards);
$('#boards').addEventListener('click', event => { if (!$('#keyword').value.trim()) { event.preventDefault(); $('#keyword').focus(); notify('Add a role or keyword to start your search.'); } });
$('#search-form').addEventListener('submit', event => { event.preventDefault(); window.open(boards[0].url($('#keyword').value.trim(), $('#location').value.trim()), '_blank', 'noopener,noreferrer'); });
document.addEventListener('click', event => { if (event.target.closest('[data-open-dialog]')) $('#application-dialog').showModal(); const close = event.target.closest('[data-close]'); if (close) document.getElementById(close.dataset.close).close(); });
$('#open-match').addEventListener('click', () => $('#match-dialog').showModal());
$('#application-form').addEventListener('submit', event => { event.preventDefault(); const form = new FormData(event.currentTarget); const title = String(form.get('title')).trim(); const company = String(form.get('company')).trim(); if (!title || !company) { notify('Enter a job title and company.'); return; } const url = String(form.get('url')).trim(); if (url && !safeUrl(url)) { notify('Enter an http or https job link.'); return; } applications.unshift({ title, company, status: form.get('status'), url }); const saved = save(); renderApplications(); event.currentTarget.reset(); $('#application-dialog').close(); if (saved) notify('Application added. Nice work!'); });
$('#application-list').addEventListener('change', event => { if (event.target.matches('[data-index]')) { const item = applications[Number(event.target.dataset.index)]; if (item && statuses.includes(event.target.value)) { item.status = event.target.value; save(); renderApplications(); } } });
$('#application-list').addEventListener('click', event => { const button = event.target.closest('[data-delete]'); if (!button) return; const index = Number(button.dataset.delete); if (!applications[index]) return; if (!confirm(`Remove ${applications[index].title} at ${applications[index].company}?`)) return; applications.splice(index, 1); save(); renderApplications(); });
$('#match-form').addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget); const result = compareKeywords(String(data.get('resume')), String(data.get('description'))); const chips = words => words.length ? words.map(word => `<span>${escapeHtml(word)}</span>`).join('') : '<em>None found</em>'; $('#match-results').innerHTML = result.total ? `<h3>${result.matched.length} of ${result.total} keywords found</h3><p>These are frequent words in the job description, not a measure of your qualifications. Only add skills you actually have.</p><strong>Found in your resume</strong><div class="chips found">${chips(result.matched)}</div><strong>Worth reviewing</strong><div class="chips">${chips(result.missing)}</div>` : '<p>No meaningful keywords found. Try a longer job description.</p>'; });
