import {
  CONSONANTS,
  CONSONANT_COMBOS,
  VOWELS,
  VOWEL_COMBOS,
} from './generate.js';

export const MAX_CHOICES = [1, 2, 3, 4];
export const DEFAULT_MAX = 2;
export const SPACING_CHOICES = [1, 2, 3];
export const DEFAULT_SPACING = 3;
export const TIMER_CHOICES = [0, 2, 3, 5, 7, 10];
export const DEFAULT_MINUTES = 5;
export const DEFAULT_KNOWN = ['a', 'e', 'i', 'o', 'l', 'm', 's'];

const ALL_UNITS = new Set([...VOWELS, ...VOWEL_COMBOS, ...CONSONANTS, ...CONSONANT_COMBOS]);

export function restoreState(raw) {
  const state = {
    saved: false,
    known: new Set(DEFAULT_KNOWN),
    max: DEFAULT_MAX,
    spacing: DEFAULT_SPACING,
    minutes: DEFAULT_MINUTES,
    twoLetters: true,
    avoidDoubled: true,
    alternate: false,
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
  if (SPACING_CHOICES.includes(saved.spacing)) state.spacing = saved.spacing;
  if (TIMER_CHOICES.includes(saved.minutes)) state.minutes = saved.minutes;
  if (typeof saved.twoLetters === 'boolean') state.twoLetters = saved.twoLetters;
  if (typeof saved.avoidDoubled === 'boolean') state.avoidDoubled = saved.avoidDoubled;
  if (typeof saved.alternate === 'boolean') state.alternate = saved.alternate;
  return state;
}

export function describeSelection(known, max, twoLetters, avoidDoubled = false, alternate = false, spacing = DEFAULT_SPACING) {
  const units = [...known]
    .filter((unit) => !(twoLetters && CONSONANT_COMBOS.includes(unit)))
    .sort((a, b) => a.localeCompare(b, 'de'));
  const syllables = max === 1 ? 'Silbe' : 'Silben';
  const mode = twoLetters ? 'ein oder zwei Buchstaben pro Silbe' : 'Silben beliebig lang';
  const doubles = avoidDoubled ? ' · ohne Doppelkonsonanten' : '';
  const turns = alternate ? ' · Vokal und Konsonant im Wechsel' : '';
  const gap = spacing === DEFAULT_SPACING ? '' : ` · Abstand ${spacing}`;
  return `Bekannt: ${units.join(', ')} · höchstens ${max} ${syllables} · ${mode}${doubles}${turns}${gap}`;
}
