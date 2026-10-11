export const VOWELS = ['a', 'e', 'i', 'o', 'u', 'ä', 'ö', 'ü'];
export const VOWEL_COMBOS = ['ei', 'au', 'eu', 'äu', 'ie'];
export const CONSONANTS = [
  'b', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'z',
];
export const CONSONANT_COMBOS = ['ch', 'sch', 'ck', 'qu', 'st', 'sp'];

const ONSET_ONLY = new Set(['qu', 'st', 'sp']);
const CODA_ONLY = new Set(['ck']);

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
    onsets: [...CONSONANTS, ...CONSONANT_COMBOS].filter((u) => has(u) && !CODA_ONLY.has(u)),
    codas: [...CONSONANTS, ...CONSONANT_COMBOS].filter((u) => has(u) && !ONSET_ONLY.has(u)),
  };
}

function feasiblePatterns(pools) {
  return PATTERNS.filter(({ shape }) => {
    const vowels = shape === 'V' ? pools.vowels.filter((v) => v.length > 1) : pools.vowels;
    if (vowels.length === 0) return false;
    if (shape.startsWith('K') && pools.onsets.length === 0) return false;
    if (shape.endsWith('K') && pools.codas.length === 0) return false;
    return true;
  });
}

export function canGenerate(known) {
  return feasiblePatterns(unitPools(known)).length > 0;
}

export function makeSyllable(pools, rng) {
  const feasible = feasiblePatterns(pools);
  if (feasible.length === 0) return null;
  const { shape } = pickWeighted(feasible, rng);
  const vowels = shape === 'V' ? pools.vowels.filter((v) => v.length > 1) : pools.vowels;
  let out = '';
  if (shape.startsWith('K')) out += pick(pools.onsets, rng);
  out += pick(vowels, rng);
  if (shape.endsWith('K')) out += pick(pools.codas, rng);
  return out;
}

export function tokenize(syllable) {
  const text = syllable.toLowerCase();
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const unit = ALL_UNITS.find(
      (u) => text.startsWith(u, i) && !(i > 0 && (u === 'st' || u === 'sp')),
    );
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
  return word.syllables.every((s) => s.length > 1 && syllableIsKnown(s, known));
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const MAX_ATTEMPTS = 200;
const FULL_LENGTH_SHARE = 0.8;

export function pickCount(maxSyllables, rng) {
  if (maxSyllables === 1 || rng() < FULL_LENGTH_SHARE) return maxSyllables;
  return 1 + Math.floor(rng() * (maxSyllables - 1));
}
const JUNCTION_RETRIES = 50;
const MERGING_PAIRS = new Set(['ei', 'ai', 'au', 'eu', 'äu', 'ie']);

export function mergesAtJunction(previous, next) {
  const pair = previous.slice(-1) + next.slice(0, 1);
  return MERGING_PAIRS.has(pair.toLowerCase());
}

export function hasMergingJunction(syllables) {
  return syllables.some((s, i) => i > 0 && mergesAtJunction(syllables[i - 1], s));
}

const comboKey = (syllables) => syllables.join('·').toLowerCase();

export function generate(
  known,
  maxSyllables,
  words,
  rng = Math.random,
  { realRatio = 0.6, seen = new Set() } = {},
) {
  const pools = unitPools(known);
  if (feasiblePatterns(pools).length === 0) return null;

  const knownWords = words.filter((w) => wordIsKnown(w, known));
  const draw = () => {
    const count = pickCount(maxSyllables, rng);
    const candidates = knownWords.filter(
      (w) =>
        w.syllables.length === count &&
        !seen.has(comboKey(w.syllables)) &&
        !hasMergingJunction(w.syllables),
    );
    if (candidates.length > 0 && rng() < realRatio) {
      return { syllables: pick(candidates, rng).syllables, real: true };
    }
    const syllables = [];
    for (let i = 0; i < count; i++) {
      let syllable = makeSyllable(pools, rng);
      for (let retry = 0; retry < JUNCTION_RETRIES && i > 0; retry++) {
        if (!mergesAtJunction(syllables[i - 1], syllable)) break;
        syllable = makeSyllable(pools, rng);
      }
      syllables.push(syllable);
    }
    if (rng() < 0.5) syllables[0] = capitalize(syllables[0]);
    return { syllables, real: false };
  };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const round = draw();
    if (!seen.has(comboKey(round.syllables))) {
      seen.add(comboKey(round.syllables));
      return round;
    }
  }
  seen.clear();
  const round = draw();
  seen.add(comboKey(round.syllables));
  return round;
}
