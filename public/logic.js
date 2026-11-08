export const boards = [
  { id: 'linkedin', name: 'LinkedIn', subtitle: 'Grow your network', mark: 'in', color: 'linkedin', url: (q, l) => `https://www.linkedin.com/jobs/search/?${new URLSearchParams({ keywords: q, location: l })}` },
  { id: 'naukri', name: 'Naukri', subtitle: 'Discover opportunities', mark: 'N', color: 'naukri', url: (q, l) => `https://www.naukri.com/${slug(q)}-jobs${l ? `-in-${slug(l)}` : ''}` },
  { id: 'indeed', name: 'Indeed', subtitle: 'Find your next role', mark: 'i', color: 'indeed', url: (q, l) => `https://www.indeed.com/jobs?${new URLSearchParams({ q, l })}` },
  { id: 'glassdoor', name: 'Glassdoor', subtitle: 'Search roles', mark: 'g', color: 'glassdoor', url: (q) => `https://www.glassdoor.com/Job/jobs.htm?${new URLSearchParams({ 'sc.keyword': q })}` },
  { id: 'wellfound', name: 'Wellfound', subtitle: 'Browse startup jobs', mark: 'w', color: 'wellfound', url: () => 'https://wellfound.com/jobs' },
  { id: 'google', name: 'Google Jobs', subtitle: 'Search the web', mark: 'G', color: 'google', url: (q, l) => `https://www.google.com/search?${new URLSearchParams({ q: `${q} jobs ${l}`.trim(), ibp: 'htl;jobs' })}` }
];
function slug(value) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'all'; }
const stopWords = new Set('a an and are as at be been being but by can candidate company could experience for from have has in into is it job knowledge of on or our role skills such that the their they this to using we will with work working you your years ability strong including required requirements preferred responsibilities looking team opportunity experience'.split(' '));
export function compareKeywords(resume, description) {
  const words = text => (text.toLowerCase().match(/[a-z][a-z0-9+#.-]{1,}/g) || []).map(w => w.replace(/[.]+$/, '')).filter(w => w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w));
  const resumeWords = new Set(words(resume));
  const counts = new Map();
  for (const word of words(description)) counts.set(word, (counts.get(word) || 0) + 1);
  const keywords = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b)).slice(0, 25);
  return { matched: keywords.filter(w => resumeWords.has(w)), missing: keywords.filter(w => !resumeWords.has(w)), total: keywords.length };
}
