import test from 'node:test';
import assert from 'node:assert/strict';
import { boards, compareKeywords } from '../public/logic.js';

test('keyword comparison counts distinct common terms and excludes filler words', () => {
  const result = compareKeywords('Built React apps with TypeScript and accessibility.', 'Looking for React, React and TypeScript experience with accessibility and testing.');
  assert.deepEqual(result.matched, ['react', 'accessibility', 'typescript']);
  assert.deepEqual(result.missing, ['testing']);
  assert.equal(result.total, 4);
});

test('keyword comparison handles text with no meaningful terms', () => {
  assert.deepEqual(compareKeywords('resume', 'the and for'), { matched: [], missing: [], total: 0 });
});

test('job searches encode input and point to the intended sites', () => {
  const urls = Object.fromEntries(boards.map(board => [board.id, new URL(board.url('C++ & React', 'New York'))]));
  assert.equal(urls.linkedin.hostname, 'www.linkedin.com');
  assert.equal(urls.linkedin.searchParams.get('keywords'), 'C++ & React');
  assert.equal(urls.linkedin.searchParams.get('location'), 'New York');
  assert.equal(urls.indeed.searchParams.get('q'), 'C++ & React');
  assert.equal(urls.indeed.searchParams.get('l'), 'New York');
  assert.equal(urls.naukri.pathname, '/c-react-jobs-in-new-york');
  assert.equal(urls.glassdoor.searchParams.get('sc.keyword'), 'C++ & React');
  assert.equal(urls.wellfound.hostname, 'wellfound.com');
  assert.equal(urls.google.searchParams.get('q'), 'C++ & React jobs New York');
});
