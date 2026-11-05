// Builds data/words.json from the German Wiktionary extract (kaikki.org) and a word frequency list,
// plus the hand-written list scripts/handwritten-words.json (those entries always stay).
// Usage:
//   node scripts/build-words.mjs <de-extract.jsonl.gz> <frequency.txt> <out.json> [maxRank]
// Words listed in scripts/word-exclusions.txt are dropped from the Wiktionary part.
// Output: one "Sprech·sil·ben" string per line, hand-written words first.
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
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
if (!Number.isInteger(MAX_RANK) || MAX_RANK < 1) {
  console.error(`maxRank must be a positive integer, got "${maxRankArg}"`);
  process.exit(1);
}
for (const path of [extractPath, frequencyPath]) {
  if (!existsSync(path)) {
    console.error(`input file not found: ${path}`);
    process.exit(1);
  }
}
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
  return [parts[0].slice(0, first.length), parts[0].slice(first.length), ...parts.slice(1)];
}

const exclusions = readFileSync(join(here, 'word-exclusions.txt'), 'utf8')
  .split('\n')
  .map((line) => line.trim().toLowerCase())
  .filter((line) => line && !line.startsWith('#'));
for (const line of exclusions) {
  if (line === '~' || line === '^') {
    console.error(`empty pattern "${line}" in word-exclusions.txt would exclude every word`);
    process.exit(1);
  }
}
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
// Every lowercase German spelling in the extract: is it a headword of its own (not only an inflected form),
// and is it a participle. A capitalised word whose lowercase twin is a headword is a nominalised verb,
// adjective or function word (Jetzt, Viel, Aus); a participle (gemacht) is not a word for a reading drill.
// Inflected forms of verbs and adjectives that slip through (Ist, Guter) are listed in word-exclusions.txt.
const lowercaseWords = new Map();
// Capitalised words that are good nouns for children although a lowercase twin exists.
const KEEP_NOUNS = new Set([
  'Abend', 'Arm', 'Ball', 'Blau', 'Dank', 'Ernst', 'Frau', 'Freund', 'Frieden', 'Grad', 'Grün', 'Heim', 'Klasse',
  'Kraft', 'Laden', 'Leben', 'Licht', 'Mensch', 'Mittel', 'Morgen', 'Norden', 'Nutzen', 'Paar', 'Plan', 'Regen',
  'Reifen', 'Ring', 'Rot', 'Rücken', 'Schaden', 'Schatten', 'Schuld', 'Schwarz', 'Wagen', 'Weg', 'Weihnachten',
  'Weise', 'Wert', 'Zeit',
]);
// For a kept noun, a lowercase twin of this word class (frau, zeit, mensch) is only a function word: drop it.
const FUNCTION_POS = new Set(['pron', 'prep', 'intj', 'det', 'conj', 'num']);
const lines = createInterface({ input: createReadStream(extractPath).pipe(createGunzip()) });
let scanned = 0;
for await (const line of lines) {
  scanned += 1;
  const entry = JSON.parse(line);
  if (entry.lang_code === 'de' && entry.word[0] === entry.word[0].toLowerCase()) {
    const senses = entry.senses ?? [];
    const participle = senses.some((sense) => (sense.tags ?? []).includes('form-of') && (sense.tags ?? []).includes('perfect'));
    const headword = !senses.every((sense) => (sense.tags ?? []).includes('form-of'));
    const known = lowercaseWords.get(entry.word);
    lowercaseWords.set(entry.word, {
      headword: headword || (known?.headword ?? false),
      participle: participle || (known?.participle ?? false),
    });
  }
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
    break;
  }
}

const dropped = [];
for (const key of [...found.keys()]) {
  const word = key.replaceAll('·', '');
  const capitalised = word[0] !== word[0].toLowerCase();
  const twin = capitalised ? lowercaseWords.get(word.toLowerCase()) : undefined;
  if ((capitalised && twin?.headword && !KEEP_NOUNS.has(word)) || lowercaseWords.get(word)?.participle) {
    found.delete(key);
    dropped.push(key);
  }
}
for (const noun of KEEP_NOUNS) {
  for (const [key, { pos }] of [...found]) {
    if (key.replaceAll('·', '') === noun.toLowerCase() && FUNCTION_POS.has(pos)) found.delete(key);
  }
}

const handwritten = JSON.parse(readFileSync(join(here, 'handwritten-words.json'), 'utf8'));
const taken = new Set(handwritten.map((entry) => entry.replaceAll('·', '')));
const generated = [...found.entries()]
  .sort((a, b) => a[1].rank - b[1].rank)
  .map(([key]) => key)
  .filter((key) => !taken.has(key.replaceAll('·', '')));
const result = [...handwritten, ...generated];
writeFileSync(outPath, `[\n${result.map((entry) => JSON.stringify(entry)).join(',\n')}\n]\n`);
console.error(`scanned ${scanned} entries, kept ${result.length} (${handwritten.length} hand-written, ${new Set(removed).size} excluded, ${dropped.length} nominalised or participle forms dropped)`);
if (process.env.SHOW_DROPPED) console.error(dropped.join(' '));
