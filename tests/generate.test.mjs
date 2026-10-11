import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate, parseWords, syllableIsKnown, tokenize, wordIsKnown } from '../src/generate.js';

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

const vowelsOnly = generate(new Set(['a']), 2, words, rng);
assert.ok(vowelsOnly.syllables.every((s) => s.toLowerCase() === 'a'));

const withCk = new Set(['a', 'k', 'c', 'ck']);
for (let i = 0; i < 500; i++) {
  for (const s of generate(withCk, 3, words, rng).syllables) {
    assert.ok(!/^ck/i.test(s), 'ck only at end');
  }
}

console.log('all tests passed');
