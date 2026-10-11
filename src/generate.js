export const VOWELS = ['a', 'e', 'i', 'o', 'u', 'ä', 'ö', 'ü'];
export const VOWEL_COMBOS = ['ei', 'au', 'eu', 'äu', 'ie'];
export const CONSONANTS = [
  'b', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'z',
];
export const CONSONANT_COMBOS = ['ch', 'sch', 'ck', 'qu'];

const ALL_UNITS = [...VOWELS, ...VOWEL_COMBOS, ...CONSONANTS, ...CONSONANT_COMBOS].sort(
  (a, b) => b.length - a.length,
);
const VOWEL_UNITS = new Set([...VOWELS, ...VOWEL_COMBOS]);

const PATTERNS = [
  { shape: 'KV', weight: 55 },
  { shape: 'KVK', weight: 20 },
  { shape: 'VK', weight: 15 },
  { shape: 'V', weight: 10 },
];

function pick(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

function pickWeighted(list, rng) {
  const total = list.reduce((sum, item) => sum + item.weight, 0);
  let roll = rng() * total;
  for (const item of list) {
    roll -= item.weight;
    if (roll < 0) return item;
  }
  return list[list.length - 1];
}

export function unitPools(known) {
  const has = (unit) => known.has(unit);
  return {
    vowels: [...VOWELS, ...VOWEL_COMBOS].filter(has),
    onsets: [...CONSONANTS, ...CONSONANT_COMBOS].filter((u) => has(u) && u !== 'ck'),
    codas: [...CONSONANTS, ...CONSONANT_COMBOS].filter((u) => has(u) && u !== 'qu'),
  };
}

export function makeSyllable(pools, rng) {
  if (pools.vowels.length === 0) return null;
  const feasible = PATTERNS.filter(({ shape }) => {
    if (shape.startsWith('K') && pools.onsets.length === 0) return false;
    if (shape.endsWith('K') && pools.codas.length === 0) return false;
    return true;
  });
  const { shape } = pickWeighted(feasible, rng);
  let out = '';
  if (shape.startsWith('K')) out += pick(pools.onsets, rng);
  out += pick(pools.vowels, rng);
  if (shape.endsWith('K')) out += pick(pools.codas, rng);
  return out;
}

export function tokenize(syllable) {
  const text = syllable.toLowerCase();
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const unit = ALL_UNITS.find((u) => text.startsWith(u, i));
    if (!unit) return null;
    tokens.push(unit);
    i += unit.length;
  }
  return tokens;
}

export function syllableIsKnown(syllable, known) {
  const tokens = tokenize(syllable);
  if (!tokens) return false;
  return tokens.some((t) => VOWEL_UNITS.has(t)) && tokens.every((t) => known.has(t));
}

export function parseWords(entries) {
  return entries.map((entry) => ({ text: entry.replaceAll('·', ''), syllables: entry.split('·') }));
}

export function wordIsKnown(word, known) {
  return word.syllables.every((s) => syllableIsKnown(s, known));
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function generate(known, maxSyllables, words, rng = Math.random, realRatio = 0.6) {
  const pools = unitPools(known);
  if (pools.vowels.length === 0) return null;

  const count = 1 + Math.floor(rng() * maxSyllables);
  const candidates = words.filter((w) => w.syllables.length === count && wordIsKnown(w, known));
  if (candidates.length > 0 && rng() < realRatio) {
    return { syllables: pick(candidates, rng).syllables, real: true };
  }

  const syllables = Array.from({ length: count }, () => makeSyllable(pools, rng));
  if (rng() < 0.5) syllables[0] = capitalize(syllables[0]);
  return { syllables, real: false };
}
