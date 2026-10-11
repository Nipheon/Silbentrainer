import {
  CONSONANTS,
  CONSONANT_COMBOS,
  VOWELS,
  VOWEL_COMBOS,
} from './generate.js';

export const MAX_CHOICES = [1, 2, 3, 4];
export const DEFAULT_MAX = 2;
export const DEFAULT_KNOWN = ['a', 'e', 'i', 'o', 'l', 'm', 's'];

const ALL_UNITS = new Set([...VOWELS, ...VOWEL_COMBOS, ...CONSONANTS, ...CONSONANT_COMBOS]);

export function restoreState(raw) {
  const state = {
    saved: false,
    known: new Set(DEFAULT_KNOWN),
    max: DEFAULT_MAX,
    twoLetters: true,
    avoidDoubled: true,
  };
  let saved;
  try {
    saved = JSON.parse(raw);
  } catch {
    return state;
  }
  if (!saved || typeof saved !== 'object') return state;
  state.saved = Array.isArray(saved.known);
  if (Array.isArray(saved.known)) {
    state.known = new Set();
    for (const unit of saved.known) {
      if (typeof unit === 'string' && ALL_UNITS.has(unit)) state.known.add(unit);
    }
  }
  if (MAX_CHOICES.includes(saved.max)) state.max = saved.max;
  if (typeof saved.twoLetters === 'boolean') state.twoLetters = saved.twoLetters;
  if (typeof saved.avoidDoubled === 'boolean') state.avoidDoubled = saved.avoidDoubled;
  return state;
}

export function describeSelection(known, max, twoLetters, avoidDoubled = false) {
  const units = [...known]
    .filter((unit) => !(twoLetters && CONSONANT_COMBOS.includes(unit)))
    .sort((a, b) => a.localeCompare(b, 'de'));
  const syllables = max === 1 ? 'Silbe' : 'Silben';
  const mode = twoLetters ? 'ein oder zwei Buchstaben pro Silbe' : 'Silben beliebig lang';
  const doubles = avoidDoubled ? ' · ohne Doppelkonsonanten' : '';
  return `Bekannt: ${units.join(', ')} · höchstens ${max} ${syllables} · ${mode}${doubles}`;
}
