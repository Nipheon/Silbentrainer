import assert from 'node:assert/strict';
import { DEFAULT_KNOWN, describeSelection, restoreState } from '../src/state.js';

const empty = restoreState(null);
assert.equal(empty.saved, false, 'nothing stored means no saved configuration');
assert.deepEqual([...empty.known].sort(), ['a', 'e', 'i', 'l', 'm', 'o', 's'], 'first start preselects a e i o l m s');
assert.deepEqual(DEFAULT_KNOWN, ['a', 'e', 'i', 'o', 'l', 'm', 's']);
assert.equal(empty.max, 2);
assert.equal(empty.twoLetters, true);
assert.equal(empty.avoidDoubled, true, 'doubled consonants avoided by default');
assert.equal(empty.alternate, false, 'alternation is off by default');

assert.equal(restoreState('not json').saved, false);
assert.equal(restoreState('{"max":3}').saved, false, 'no known list means no configuration');
const good = restoreState(JSON.stringify({ known: ['a', 'l', 'sch'], max: 3, twoLetters: false }));
assert.deepEqual([...good.known].sort(), ['a', 'l', 'sch']);
assert.equal(good.saved, true);
assert.equal(good.max, 3);
assert.equal(good.twoLetters, false);

assert.equal(restoreState('not json').max, 2);
assert.equal(restoreState('42').known.size, 7, 'garbage falls back to the defaults');
assert.equal(restoreState('null').known.size, 7);
assert.equal(restoreState('42').saved, false);

const noKnown = restoreState(JSON.stringify({ max: 4, twoLetters: false }));
assert.equal(noKnown.max, 4, 'max is restored even when known is missing');
assert.equal(noKnown.known.size, 7, 'known is missing, so defaults');
assert.equal(noKnown.twoLetters, false);

const dirty = restoreState(JSON.stringify({ known: [1, null, 'xyz', 'a', {}, 'ei'], max: 9, twoLetters: 'yes' }));
assert.deepEqual([...dirty.known].sort(), ['a', 'ei'], 'only known units survive');
assert.equal(dirty.max, 2, 'out-of-range max falls back');
assert.equal(dirty.twoLetters, true, 'non-boolean flag falls back');

assert.equal(restoreState(JSON.stringify({ known: 'ab' })).known.size, 7, 'known that is not a list means no configuration');
assert.equal(restoreState(JSON.stringify({ known: [] })).known.size, 0, 'a saved empty selection is kept, not replaced');
assert.equal(restoreState(JSON.stringify({ known: [] })).saved, true);
assert.equal(restoreState(JSON.stringify({ known: ['a'] })).known.size, 1, 'a saved selection replaces the defaults');

assert.equal(
  describeSelection(new Set(['l', 'a', 'sch', 'ei']), 1, true),
  'Bekannt: a, ei, l · höchstens 1 Silbe · ein oder zwei Buchstaben pro Silbe',
  'two-letter mode hides consonant combos and names the mode',
);
assert.equal(
  describeSelection(new Set(['a', 'sch']), 3, false),
  'Bekannt: a, sch · höchstens 3 Silben · Silben beliebig lang',
);

assert.equal(restoreState(JSON.stringify({ known: ['a'], avoidDoubled: false })).avoidDoubled, false);
assert.equal(restoreState(JSON.stringify({ known: ['a'], avoidDoubled: 'no' })).avoidDoubled, true, 'non-boolean falls back');
assert.equal(
  describeSelection(new Set(['a', 'm']), 2, true, true),
  'Bekannt: a, m · höchstens 2 Silben · ein oder zwei Buchstaben pro Silbe · ohne Doppelkonsonanten',
);

assert.equal(restoreState(JSON.stringify({ known: ['a'], alternate: true })).alternate, true);
assert.equal(restoreState(JSON.stringify({ known: ['a'], alternate: 'yes' })).alternate, false, 'non-boolean falls back');
assert.equal(
  describeSelection(new Set(['a', 'm']), 2, true, true, true),
  'Bekannt: a, m · höchstens 2 Silben · ein oder zwei Buchstaben pro Silbe · ohne Doppelkonsonanten · Vokal und Konsonant im Wechsel',
);


assert.equal(empty.spacing, 3, 'spacing defaults to the widest step');
assert.equal(restoreState(JSON.stringify({ known: ['a'], spacing: 1 })).spacing, 1);
assert.equal(restoreState(JSON.stringify({ known: ['a'], spacing: 2 })).spacing, 2);
assert.equal(restoreState(JSON.stringify({ known: ['a'], spacing: 7 })).spacing, 3, 'unknown spacing falls back');
assert.equal(restoreState(JSON.stringify({ known: ['a'], spacing: '1' })).spacing, 3, 'non-number spacing falls back');
assert.ok(!describeSelection(new Set(['a']), 2, true).includes('Abstand'), 'default spacing is not mentioned');
assert.ok(describeSelection(new Set(['a']), 2, true, true, false, 1).includes('Abstand 1'));

assert.equal(empty.minutes, 5, 'timer defaults to 5 minutes');
for (const minutes of [0, 2, 3, 5, 7, 10]) {
  assert.equal(restoreState(JSON.stringify({ known: ['a'], minutes })).minutes, minutes);
}
assert.equal(restoreState(JSON.stringify({ known: ['a'], minutes: 4 })).minutes, 5, 'unknown minutes fall back');
assert.equal(restoreState(JSON.stringify({ known: ['a'], minutes: '3' })).minutes, 5, 'non-number minutes fall back');
assert.equal(restoreState(JSON.stringify({ known: ['a'] })).minutes, 5, 'old saved config gets the default timer');

console.log('state tests passed');
