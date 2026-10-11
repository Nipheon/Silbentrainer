import assert from 'node:assert/strict';
import { describeSelection, restoreState } from '../src/state.js';

const empty = restoreState(null);
assert.equal(empty.known.size, 0);
assert.equal(empty.max, 2);
assert.equal(empty.twoLetters, true);

const good = restoreState(JSON.stringify({ known: ['a', 'l', 'sch'], max: 3, twoLetters: false }));
assert.deepEqual([...good.known].sort(), ['a', 'l', 'sch']);
assert.equal(good.max, 3);
assert.equal(good.twoLetters, false);

assert.equal(restoreState('not json').max, 2);
assert.equal(restoreState('42').known.size, 0);
assert.equal(restoreState('null').known.size, 0);

const noKnown = restoreState(JSON.stringify({ max: 4, twoLetters: false }));
assert.equal(noKnown.max, 4, 'max is restored even when known is missing');
assert.equal(noKnown.twoLetters, false);

const dirty = restoreState(JSON.stringify({ known: [1, null, 'xyz', 'a', {}, 'ei'], max: 9, twoLetters: 'yes' }));
assert.deepEqual([...dirty.known].sort(), ['a', 'ei'], 'only known units survive');
assert.equal(dirty.max, 2, 'out-of-range max falls back');
assert.equal(dirty.twoLetters, true, 'non-boolean flag falls back');

assert.equal(restoreState(JSON.stringify({ known: 'ab' })).known.size, 0);

assert.equal(
  describeSelection(new Set(['l', 'a', 'sch', 'ei']), 1, true),
  'Bekannt: a, ei, l · höchstens 1 Silbe · zwei Buchstaben pro Silbe',
  'two-letter mode hides consonant combos and names the mode',
);
assert.equal(
  describeSelection(new Set(['a', 'sch']), 3, false),
  'Bekannt: a, sch · höchstens 3 Silben · Silben beliebig lang',
);

console.log('state tests passed');
