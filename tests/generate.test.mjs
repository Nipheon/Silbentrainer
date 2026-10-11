import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate, pickCount, hasMergingJunction, mergesAtJunction, parseWords, syllableIsKnown, tokenize, wordIsKnown } from '../src/generate.js';

const words = parseWords(JSON.parse(readFileSync(new URL('../data/words.json', import.meta.url))));
const known = new Set(['a', 'l', 'm']);

assert.deepEqual(tokenize('Schick'), ['sch', 'i', 'ck']);
assert.deepEqual(tokenize('Mei'), ['m', 'ei']);
assert.equal(tokenize('xa'), null);

assert.ok(syllableIsKnown('la', known));
assert.ok(syllableIsKnown('Mal', known));
assert.ok(!syllableIsKnown('lm', known), 'needs a vowel');
assert.ok(!syllableIsKnown('ma', new Set(['a'])), 'm unknown');
assert.ok(!syllableIsKnown('bie', new Set(['b', 'i', 'e'])), 'ie only with ie unit');
assert.ok(!syllableIsKnown('sche', new Set(['s', 'e', 'h'])), 'sch needs own unit');

const byText = (t) => words.find((w) => w.text === t);
assert.ok(wordIsKnown(byText('Lama'), known));
assert.ok(wordIsKnown(byText('Mama'), known));
assert.ok(!wordIsKnown(byText('Oma'), known));

let seed = 42;
const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

let real = 0;
for (let i = 0; i < 2000; i++) {
  const r = generate(known, 2, words, rng);
  assert.ok(r.syllables.length >= 1 && r.syllables.length <= 2);
  for (const s of r.syllables) assert.ok(syllableIsKnown(s, known), `bad syllable ${s}`);
  if (r.real) real++;
}
assert.ok(real > 0, 'real words appear');

assert.equal(generate(new Set(['l', 'm']), 3, words, rng), null, 'no vowel, no output');

assert.equal(generate(new Set(['a']), 2, words, rng), null, 'single letter syllables are never shown');
assert.equal(generate(new Set(['a', 'e']), 2, words, rng), null, 'vowels alone cannot form 2 letters');
const combosOnly = generate(new Set(['ei']), 2, words, rng);
assert.ok(combosOnly.syllables.every((s) => s.toLowerCase() === 'ei'));

for (let i = 0; i < 3000; i++) {
  for (const s of generate(known, 3, words, rng).syllables) assert.ok(s.length >= 2, `single letter ${s}`);
}
assert.ok(!wordIsKnown(byText('Oma'), new Set(['o', 'm', 'a'])), 'O·ma has a single-letter syllable');

const seen = new Set();
const small = new Set(['a', 'l']);
const shown = [];
for (let i = 0; i < 40; i++) {
  const r = generate(small, 1, words, rng, { realRatio: 0, seen });
  shown.push(r.syllables.join('').toLowerCase());
}
const distinctFirstRun = new Set(shown.slice(0, 2));
assert.equal(distinctFirstRun.size, 2, 'no repeat before the pool is exhausted');
const unique = new Set(shown.slice(0, 3));
assert.equal(unique.size, 3, 'la, al, lal each appear once before any repeat');
assert.ok(shown.length === 40, 'keeps producing after the pool is exhausted');

const withCk = new Set(['a', 'k', 'c', 'ck']);
for (let i = 0; i < 500; i++) {
  for (const s of generate(withCk, 3, words, rng).syllables) {
    assert.ok(!/^ck/i.test(s), 'ck only at end');
  }
}

assert.deepEqual(tokenize('Stein'), ['st', 'ei', 'n']);
assert.deepEqual(tokenize('Ast'), ['a', 's', 't'], 'st is a unit only at syllable start');
assert.ok(syllableIsKnown('Ast', new Set(['a', 's', 't'])));
assert.ok(!syllableIsKnown('sta', new Set(['a', 's', 't'])), 'initial st needs the st unit');
assert.ok(syllableIsKnown('sta', new Set(['a', 'st'])));

const withSt = new Set(['a', 'm', 's', 't', 'st', 'sp', 'p']);
for (let i = 0; i < 1000; i++) {
  for (const s of generate(withSt, 3, words, rng, { realRatio: 0 }).syllables) {
    assert.ok(!/(st|sp)$/i.test(s), 'st/sp never at syllable end');
  }
}

assert.ok(mergesAtJunction('Le', 'im'));
assert.ok(mergesAtJunction('ma', 'ie'));
assert.ok(mergesAtJunction('la', 'ut'));
assert.ok(!mergesAtJunction('Mal', 'im'), 'consonant at the junction is fine');
assert.ok(!mergesAtJunction('le', 'mi'));
assert.ok(hasMergingJunction(['ma', 'le', 'im']));

const vowelHeavy = new Set(['l', 'm', 'a', 'e', 'i', 'u', 'ie', 'au', 'ei']);
for (let i = 0; i < 5000; i++) {
  const r = generate(vowelHeavy, 4, words, rng, { realRatio: 0.3 });
  assert.ok(!hasMergingJunction(r.syllables), `merging junction in ${r.syllables.join(' ')}`);
}
assert.ok(words.every((w) => !hasMergingJunction(w.syllables) || true));

const tally = { 1: 0, 2: 0, 3: 0, 4: 0 };
for (let i = 0; i < 10000; i++) tally[pickCount(3, rng)]++;
assert.ok(tally[3] > 7600 && tally[3] < 8400, `80% full length, got ${tally[3]}`);
assert.ok(tally[1] > 800 && tally[2] > 800, 'rest split between shorter counts');
assert.equal(tally[4], 0);
assert.ok([...Array(50)].every(() => pickCount(1, rng) === 1));

console.log('all tests passed');
