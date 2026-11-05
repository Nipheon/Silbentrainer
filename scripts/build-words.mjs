// Builds data/words.json from the German Wiktionary extract (kaikki.org) and a word frequency list,
// plus the hand-written list scripts/handwritten-words.json (those entries always stay).
// Usage:
//   node scripts/build-words.mjs <de-extract.jsonl.gz> <frequency.txt> <out.json> [maxRank]
// Words listed in scripts/word-exclusions.txt are dropped from the Wiktionary part.
// Output: one "Sprech·sil·ben" string per line, hand-written words first.
import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasMergingJunction, tokenize, VOWELS, VOWEL_COMBOS } from '../src/generate.js';

const [extractPath, frequencyPath, outPath, maxRankArg] = process.argv.slice(2);
const here = dirname(fileURLToPath(import.meta.url));
if (!extractPath || !frequencyPath || !outPath) {
  console.error('usage: node scripts/build-words.mjs <de-extract.jsonl.gz> <frequency.txt> <out.json> [maxRank]');
  process.exit(1);
}
const MAX_RANK = Number(maxRankArg ?? 3000);
const MAX_SYLLABLES = 4;
const MIN_LETTERS = 3; // shorter real words (ja, am, Ei, Ohr) come from the hand-written list; Wiktionary has letter names and abbreviations here
const POS = new Set(['noun', 'verb', 'adj', 'adv', 'num', 'intj', 'conj', 'prep', 'pron', 'det']);
const SKIP_TAGS = new Set(['form-of', 'outdated', 'archaic', 'historical', 'derogatory', 'vulgar', 'offensive', 'dialectal', 'regional']);
const VOWEL_UNITS = new Set([...VOWELS, ...VOWEL_COMBOS]);

const rank = new Map();
readFileSync(frequencyPath, 'utf8')
  .split('\n')
  .forEach((line, index) => {
    const [word] = line.split(' ');
    if (word && index < MAX_RANK && !rank.has(word)) rank.set(word, index + 1);
  });

const isVowelUnit = (unit) => VOWEL_UNITS.has(unit);

// One syllable: letters the app knows, exactly one vowel unit.
function validSyllable(syllable) {
  const tokens = tokenize(syllable);
  return tokens !== null && tokens.filter(isVowelUnit).length === 1;
}

// Wiktionary keeps a leading single vowel attached (Oma, Amei·se); Sprechsilben split it off (O·ma, A·mei·se).
// Only the pattern vowel + one consonant + vowel is split, so An·na and Ap·fel stay as they are.
function splitLeadingVowel(parts) {
  const tokens = tokenize(parts[0]);
  if (!tokens || tokens.length < 3) return parts;
  const [first, second, third] = tokens;
  if (!isVowelUnit(first) || isVowelUnit(second) || !isVowelUnit(third)) return parts;
  return [first, parts[0].slice(first.length), ...parts.slice(1)];
}

const exclusions = readFileSync(join(here, 'word-exclusions.txt'), 'utf8')
  .split('\n')
  .map((line) => line.trim().toLowerCase())
  .filter((line) => line && !line.startsWith('#'));
const stems = exclusions.filter((line) => line.startsWith('~')).map((line) => line.slice(1));
const prefixes = exclusions.filter((line) => line.startsWith('^')).map((line) => line.slice(1));
const exact = new Set(exclusions.filter((line) => !line.startsWith('~') && !line.startsWith('^')));
const excluded = (word) => {
  const lower = word.toLowerCase();
  return (
    exact.has(lower) || stems.some((stem) => lower.includes(stem)) || prefixes.some((prefix) => lower.startsWith(prefix))
  );
};
const removed = [];

const found = new Map();
const NOMINALIZED_FROM = new Set(['verb', 'pron', 'det', 'conj', 'prep']);
const lowerPos = new Map();
const lines = createInterface({ input: createReadStream(extractPath).pipe(createGunzip()) });
let scanned = 0;
for await (const line of lines) {
  scanned += 1;
  const entry = JSON.parse(line);
  if (entry.lang_code !== 'de' || !POS.has(entry.pos) || !entry.hyphenations) continue;
  const senses = entry.senses ?? [];
  if (senses.length > 0 && senses.every((sense) => (sense.tags ?? []).some((tag) => SKIP_TAGS.has(tag)))) continue;
  if (entry.word.length < MIN_LETTERS || !rank.has(entry.word.toLowerCase())) continue;
  // Nouns start uppercase, every other word class lowercase; no all-caps abbreviations.
  const startsUpper = entry.word[0] !== entry.word[0].toLowerCase();
  if (startsUpper !== (entry.pos === 'noun') || (entry.word.length > 1 && entry.word === entry.word.toUpperCase())) continue;
  for (const { parts } of entry.hyphenations) {
    const syllables = splitLeadingVowel(parts);
    // Words with two vowels meeting at a junction (Feu·er) are never shown, so they stay out of the file.
    if (syllables.length > MAX_SYLLABLES || !syllables.every(validSyllable) || hasMergingJunction(syllables)) continue;
    const key = syllables.join('·');
    if (excluded(entry.word)) {
      removed.push(entry.word);
      break;
    }
    if (key.replaceAll('·', '') !== entry.word) continue;
    if (!found.has(key)) found.set(key, { rank: rank.get(entry.word.toLowerCase()), pos: entry.pos });
    if (entry.pos !== 'noun') lowerPos.set(entry.word, entry.pos);
    break;
  }
}

// A noun like Haben or Etwas is only a nominalised verb or function word: drop it.
for (const [key, { pos }] of found) {
  if (pos === 'noun' && NOMINALIZED_FROM.has(lowerPos.get(key.replaceAll('·', '').toLowerCase()))) found.delete(key);
}

const handwritten = JSON.parse(readFileSync(join(here, 'handwritten-words.json'), 'utf8'));
const taken = new Set(handwritten.map((entry) => entry.replaceAll('·', '')));
const generated = [...found.entries()]
  .sort((a, b) => a[1].rank - b[1].rank)
  .map(([key]) => key)
  .filter((key) => !taken.has(key.replaceAll('·', '')));
const result = [...handwritten, ...generated];
writeFileSync(outPath, `[\n${result.map((entry) => JSON.stringify(entry)).join(',\n')}\n]\n`);
console.error(`scanned ${scanned} entries, kept ${result.length} (${handwritten.length} hand-written, ${new Set(removed).size} excluded)`);
