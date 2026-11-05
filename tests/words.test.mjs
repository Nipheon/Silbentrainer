import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VOWELS, VOWEL_COMBOS, hasMergingJunction, parseWords, tokenize } from '../src/generate.js';

const entries = JSON.parse(readFileSync(new URL('../data/words.json', import.meta.url), 'utf8'));
const handwritten = new Set(JSON.parse(readFileSync(new URL('../scripts/handwritten-words.json', import.meta.url), 'utf8')));
const vowelUnits = new Set([...VOWELS, ...VOWEL_COMBOS]);

assert.ok(Array.isArray(entries) && entries.length > 1000, 'word list is large');
assert.equal(new Set(entries).size, entries.length, 'no duplicate entries');

for (const [index, word] of parseWords(entries).entries()) {
  assert.ok(word.syllables.length <= 4, `${word.text}: at most four syllables`);
  assert.ok(!hasMergingJunction(word.syllables), `${word.text}: two vowels meet at a syllable junction`);
  assert.ok(!/\p{Lu}/u.test(word.text.slice(1)), `${word.text}: capital letter inside a word`);
  if (!handwritten.has(entries[index])) {
    assert.ok(word.text.length >= 3, `${word.text}: generated words have at least three letters`);
  }
  for (const syllable of word.syllables) {
    const tokens = tokenize(syllable);
    assert.ok(tokens, `${word.text}: unknown letters in "${syllable}"`);
    assert.ok(tokens.some((unit) => vowelUnits.has(unit)), `${word.text}: "${syllable}" has no vowel`);
  }
}

console.log('word list tests passed');
