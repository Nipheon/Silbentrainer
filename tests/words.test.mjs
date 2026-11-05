import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VOWELS, VOWEL_COMBOS, parseWords, tokenize } from '../src/generate.js';

const entries = JSON.parse(readFileSync(new URL('../data/words.json', import.meta.url), 'utf8'));
const vowelUnits = new Set([...VOWELS, ...VOWEL_COMBOS]);

assert.ok(Array.isArray(entries) && entries.length > 1000, 'word list is large');
assert.equal(new Set(entries).size, entries.length, 'no duplicate entries');

for (const word of parseWords(entries)) {
  assert.ok(word.syllables.length <= 4, `${word.text}: at most four syllables`);
  for (const syllable of word.syllables) {
    const tokens = tokenize(syllable);
    assert.ok(tokens, `${word.text}: unknown letters in "${syllable}"`);
    assert.ok(tokens.some((unit) => vowelUnits.has(unit)), `${word.text}: "${syllable}" has no vowel`);
  }
}

console.log('word list tests passed');
