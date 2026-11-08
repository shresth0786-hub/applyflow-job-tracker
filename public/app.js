import { boards, compareKeywords } from './logic.js';
import { loadModel, predict } from './matcher.js';
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
$('#open-match').addEventListener('click', async () => {
  $('#match-dialog').showModal();
  try {
    const response = await fetch('/api/ai/status', { signal: AbortSignal.timeout(4000), cache: 'no-store' });
    const status = await response.json();
    $('#ai-status').textContent = status.available ? 'Zephyr is ready on the app server.' : 'Zephyr is offline. Start the local model to use AI assistance.';
  } catch { $('#ai-status').textContent = 'Zephyr status is unavailable. Try again when the local model is running.'; }
});
$('#application-form').addEventListener('submit', event => { event.preventDefault(); const form = new FormData(event.currentTarget); const title = String(form.get('title')).trim(); const company = String(form.get('company')).trim(); if (!title || !company) { notify('Enter a job title and company.'); return; } const url = String(form.get('url')).trim(); if (url && !safeUrl(url)) { notify('Enter an http or https job link.'); return; } applications.unshift({ title, company, status: form.get('status'), url }); const saved = save(); renderApplications(); event.currentTarget.reset(); $('#application-dialog').close(); if (saved) notify('Application added. Nice work!'); });
$('#application-list').addEventListener('change', event => { if (event.target.matches('[data-index]')) { const item = applications[Number(event.target.dataset.index)]; if (item && statuses.includes(event.target.value)) { item.status = event.target.value; save(); renderApplications(); } } });
$('#application-list').addEventListener('click', event => { const button = event.target.closest('[data-delete]'); if (!button) return; const index = Number(button.dataset.delete); if (!applications[index]) return; if (!confirm(`Remove ${applications[index].title} at ${applications[index].company}?`)) return; applications.splice(index, 1); save(); renderApplications(); });
$('#match-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget, button = form.querySelector('button[type=submit]');
  const data = new FormData(form), resume = String(data.get('resume')).trim(), description = String(data.get('description')).trim();
  const output = $('#match-results');
  if (resume.length < 30 || description.length < 30) { output.textContent = 'Add at least 30 characters to each field for a useful comparison.'; return; }
  button.disabled = true; output.textContent = 'Reviewing your experience…';
  try {
    const result = compareKeywords(resume, description);
    const model = await loadModel();
    const chips = words => words.length ? words.map(word => `<span>${escapeHtml(word)}</span>`).join('') : '<em>None found</em>';
    const assessment = model ? `<p><strong>${predict(model, resume, description) >= model.threshold ? 'Similar to reviewed matches' : 'Review the requirements carefully'}</strong> · Model feedback is a guide; check the requirements yourself.</p>` : '<p>Keyword review is available. Model feedback will appear here when a model passes evaluation.</p>';
    output.innerHTML = result.total ? `${assessment}<h3>${result.matched.length} of ${result.total} keywords found</h3><p>Use the terms below to check relevant experience. Add a concrete example for skills you have; only include truthful details.</p><strong>Found in your resume</strong><div class="chips found">${chips(result.matched)}</div><strong>Requirements to review</strong><div class="chips">${chips(result.missing)}</div><p>These terms do not measure your qualifications or predict an employer’s decision.</p>` : '<p>No meaningful keywords found. Try a longer job description.</p>';
  } catch { output.textContent = 'The comparison could not finish. Please try again.'; }
  finally { button.disabled = false; }
});

for (const button of document.querySelectorAll('[data-ai-action]')) button.addEventListener('click', async () => {
  const data = new FormData($('#match-form'));
  const resume = String(data.get('resume')).trim(), description = String(data.get('description')).trim();
  const result = $('#ai-result'), status = $('#ai-status');
  if (resume.length < 30 || (button.dataset.aiAction === 'advice' && description.length < 30) || resume.length > 3000 || description.length > 3000) {
    status.textContent = 'Enter 30–3000 characters for the resume and, for advice, the job description.'; return;
  }
  const controls = document.querySelectorAll('[data-ai-action]');
  controls.forEach(control => { control.disabled = true; });
  result.textContent = ''; status.textContent = 'Zephyr is writing. This can take a few minutes on CPU…';
  try {
    const response = await fetch('/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resume, description, action: button.dataset.aiAction }), signal: AbortSignal.timeout(245000) });
    const payload = await response.json();
    if (!response.ok || typeof payload.text !== 'string') throw new Error(payload.error || 'The assistant could not respond.');
    result.textContent = payload.text;
    status.textContent = payload.truncated ? 'Zephyr reached its output limit. The response may be incomplete and can contain invented details; check every claim.' : 'Zephyr can invent details. Check every claim before using.';
  } catch (error) { status.textContent = error.name === 'TimeoutError' ? 'Zephyr took too long. Please try again.' : error.message || 'The assistant is unavailable.'; }
  finally { controls.forEach(control => { control.disabled = false; }); }
});
