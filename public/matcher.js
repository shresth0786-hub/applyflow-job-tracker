const names = ['intercept', 'job_word_coverage', 'resume_word_coverage', 'term_frequency_cosine', 'log_resume_words', 'log_job_words'];
const stop = new Set('a an and are as at be been being but by can candidate company could experience for from have has in into is it job knowledge of on or our role skills such that the their they this to using we will with work working you your years ability strong including required requirements preferred responsibilities looking team opportunity'.split(' '));
function terms(text) {
  const result = new Map();
  for (let word of text.toLowerCase().match(/[a-z][a-z0-9+#.\-]{1,}/g) || []) {
    word = word.replace(/\.+$/, '');
    if (word.length > 2 && !stop.has(word)) result.set(word, (result.get(word) || 0) + 1);
  }
  return result;
}
export function modelFeatures(resume, description) {
  const a = terms(resume), b = terms(description);
  let overlap = 0, dot = 0;
  for (const [word, count] of a) if (b.has(word)) { overlap++; dot += count * b.get(word); }
  const values = map => [...map.values()];
  const sum = list => list.reduce((total, n) => total + n, 0);
  const denom = Math.sqrt(sum(values(a).map(n => n * n)) * sum(values(b).map(n => n * n)));
  return [1, overlap / Math.max(b.size, 1), overlap / Math.max(a.size, 1), denom ? dot / denom : 0, Math.min(Math.log1p(sum(values(a))) / 10, 1), Math.min(Math.log1p(sum(values(b))) / 10, 1)];
}
export function validateModel(model) {
  const m = model?.test_metrics, baseline = model?.baseline;
  return model?.schema === 'applyflow-reviewed-v1' && model.deployable === true && model.label_method === 'human_independent' && model.training_rights_confirmed === true &&
    JSON.stringify(model.features) === JSON.stringify(names) && Array.isArray(model.weights) && model.weights.length === names.length && model.weights.every(Number.isFinite) &&
    Number.isFinite(model.threshold) && model.threshold >= .2 && model.threshold <= .8 &&
    m && baseline && [m.f1, m.precision, m.recall, baseline.f1].every(n => Number.isFinite(n) && n >= 0 && n <= 1) &&
    Number.isInteger(m.positive) && Number.isInteger(m.negative) && m.positive >= 25 && m.negative >= 25 && m.positive + m.negative >= 100 &&
    m.f1 >= .75 && m.precision >= .75 && m.recall >= .75 && m.f1 >= baseline.f1 + .05;
}
export function predict(model, resume, description) {
  if (!validateModel(model)) throw new Error('Model has not passed evaluation');
  const x = modelFeatures(resume, description);
  const score = x.reduce((total, value, i) => total + value * model.weights[i], 0);
  return 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, score))));
}
export async function loadModel(fetcher = fetch) {
  try {
    const response = await fetcher('/models/matcher.json', { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    const model = await response.json();
    return validateModel(model) ? model : null;
  } catch { return null; }
}
