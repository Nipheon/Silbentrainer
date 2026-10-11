import {
  CONSONANTS,
  CONSONANT_COMBOS,
  VOWELS,
  VOWEL_COMBOS,
  canGenerate,
  generate,
  makeSyllable,
  parseWords,
  unitPools,
} from './generate.js';
import { MAX_CHOICES, describeSelection, restoreState } from './state.js';

const STORAGE_KEY = 'silbentrainer.v1';
const GROUPS = {
  vowels: VOWELS,
  vowelCombos: VOWEL_COMBOS,
  consonants: CONSONANTS,
  consonantCombos: CONSONANT_COMBOS,
};
const SPIN_MS = 600;
const SPIN_STAGGER_MS = 350;
const TICK_MS = 70;
const ANNOUNCE_DELAY_MS = 60;
const SETUP_ERROR =
  'Wähle mindestens einen Vokal und einen Konsonanten, damit Silben mit mindestens zwei Buchstaben entstehen.';

let known = new Set();
let maxSyllables = 2;
let twoLetters = true;
let words = [];
let spinning = false;
let timers = [];
const seen = new Set();

const $ = (selector) => document.querySelector(selector);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // storage unavailable
  }
  const state = restoreState(raw);
  known = state.known;
  maxSyllables = state.max;
  twoLetters = state.twoLetters;
  return state.saved;
}

function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ known: [...known], max: maxSyllables, twoLetters }),
    );
  } catch {
    // storage unavailable
  }
}

function announce(text) {
  const result = $('#result');
  result.textContent = '';
  setTimeout(() => {
    result.textContent = text;
  }, ANNOUNCE_DELAY_MS);
}

function showSetupError() {
  const error = $('#setup-error');
  error.hidden = false;
  error.textContent = '';
  setTimeout(() => {
    error.textContent = SETUP_ERROR;
  }, ANNOUNCE_DELAY_MS);
}

function buildTiles() {
  for (const [group, units] of Object.entries(GROUPS)) {
    const container = $(`[data-group="${group}"]`);
    for (const unit of units) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'tile';
      tile.textContent = unit;
      tile.setAttribute('aria-pressed', String(known.has(unit)));
      tile.addEventListener('click', () => {
        if (known.has(unit)) known.delete(unit);
        else known.add(unit);
        tile.setAttribute('aria-pressed', String(known.has(unit)));
        $('#setup-error').hidden = true;
      });
      container.append(tile);
    }
  }
}

function selectMax(n, { focus = false } = {}) {
  maxSyllables = n;
  refreshMaxChoices();
  if (focus) document.querySelector('.segment[tabindex="0"]').focus();
}

function buildMaxChoices() {
  const container = $('#max');
  for (const n of MAX_CHOICES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'segment';
    button.textContent = String(n);
    button.setAttribute('role', 'radio');
    button.addEventListener('click', () => selectMax(n));
    button.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const next = (MAX_CHOICES.indexOf(n) + step + MAX_CHOICES.length) % MAX_CHOICES.length;
      selectMax(MAX_CHOICES[next], { focus: true });
    });
    container.append(button);
  }
  refreshMaxChoices();
}

function refreshMaxChoices() {
  document.querySelectorAll('.segment').forEach((button) => {
    const checked = Number(button.textContent) === maxSyllables;
    button.setAttribute('aria-checked', String(checked));
    button.tabIndex = checked ? 0 : -1;
  });
}

function refreshTwoLetters() {
  $('#two-letters').setAttribute('aria-checked', String(twoLetters));
  $('#more-sounds').hidden = twoLetters;
  $('#more-sounds-note').hidden = !twoLetters;
}

function showReels(syllables) {
  const field = $('#reels');
  field.dataset.count = String(syllables.length);
  field.replaceChildren(
    ...syllables.map((text) => {
      const span = document.createElement('span');
      span.className = 'syllable';
      span.textContent = text;
      return span;
    }),
  );
}

function cancelSpin() {
  timers.forEach(({ id, repeating }) => (repeating ? clearInterval(id) : clearTimeout(id)));
  timers = [];
  spinning = false;
  $('#start').removeAttribute('aria-disabled');
}

function spin(animate = true) {
  if (spinning) return;
  const round = generate(known, maxSyllables, words, Math.random, { seen, twoLetters });
  if (!round) return;
  const pools = unitPools(known, { twoLetters });

  showReels(round.syllables);
  const spans = [...document.querySelectorAll('#reels .syllable')];
  const prompt = $('#prompt');
  const finish = () => {
    cancelSpin();
    announce(round.syllables.join(' '));
    prompt.textContent =
      round.syllables.length === 1
        ? 'Lies die Silbe. Bereit für die nächste Runde?'
        : `Lies die ${round.syllables.length} Silben. Bereit für die nächste Runde?`;
  };

  if (reducedMotion || !animate) {
    finish();
    return;
  }

  spinning = true;
  $('#start').setAttribute('aria-disabled', 'true');
  prompt.textContent = 'Die Walzen drehen sich …';
  let remaining = spans.length;
  spans.forEach((span, index) => {
    span.classList.add('spinning');
    span.textContent = makeSyllable(pools, Math.random);
    const intervalId = setInterval(() => {
      span.textContent = makeSyllable(pools, Math.random);
    }, TICK_MS);
    timers.push({ repeating: true, id: intervalId });
    timers.push({
      repeating: false,
      id: setTimeout(() => {
        clearInterval(intervalId);
        span.textContent = round.syllables[index];
        span.classList.remove('spinning');
        remaining -= 1;
        if (remaining === 0) finish();
      }, SPIN_MS + index * SPIN_STAGGER_MS),
    });
  });
}

async function showPlay() {
  if (!canGenerate(known, { twoLetters })) {
    showSetupError();
    return;
  }
  save();
  await wordsReady;
  cancelSpin();
  $('#setup').hidden = true;
  $('#play').hidden = false;
  $('#summary').textContent = describeSelection(known, maxSyllables, twoLetters);
  spin(false);
  $('#start').focus();
}

function showSetup() {
  cancelSpin();
  $('#play').hidden = true;
  $('#setup').hidden = false;
  $('#setup h1').focus();
}

async function loadWords() {
  try {
    const response = await fetch('data/words.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const entries = await response.json();
    if (!Array.isArray(entries)) throw new Error('not a list');
    words = parseWords(entries.filter((entry) => typeof entry === 'string'));
  } catch {
    words = [];
    $('#data-warning').hidden = false;
  }
}

let wordsReady = Promise.resolve();

function init() {
  $('#load-error').hidden = true;
  const hasSavedConfig = load();
  buildTiles();
  buildMaxChoices();
  refreshTwoLetters();
  $('#two-letters').addEventListener('click', () => {
    twoLetters = !twoLetters;
    refreshTwoLetters();
    $('#setup-error').hidden = true;
  });
  $('#go').addEventListener('click', showPlay);
  $('#start').addEventListener('click', () => spin());
  $('#back').addEventListener('click', showSetup);
  wordsReady = loadWords();
  if (hasSavedConfig && canGenerate(known, { twoLetters })) showPlay();
  else $('#setup').hidden = false;
}

init();
