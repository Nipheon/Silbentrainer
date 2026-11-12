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
import { MAX_CHOICES, SPACING_CHOICES, TIMER_CHOICES, describeSelection, restoreState } from './state.js';

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
const WORDS_WAIT_MS = 1500;
const WORDS_TIMEOUT_MS = 8000;
const CLOCK_TICK_MS = 250;
const NO_VOWEL_ERROR = 'Wähle mindestens einen Vokal.';
const NO_CONSONANT_ERROR =
  'Wähle zusätzlich einen Konsonanten oder eine Vokalverbindung, damit Silben mit mindestens zwei Buchstaben entstehen.';

let known = new Set();
let maxSyllables = 2;
let spacing = 3;
let minutes = 5;
let twoLetters = true;
let avoidDoubled = true;
let alternate = false;
let words = [];
let spinning = false;
let timers = [];
// Timed session: 'off' (no timer), 'ready' (clock not started), 'running', 'over' (time up, last word on screen), 'done' (summary).
let phase = 'off';
let rounds = 0;
let endsAt = 0;
let clockId = null;
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
  spacing = state.spacing;
  minutes = state.minutes;
  twoLetters = state.twoLetters;
  avoidDoubled = state.avoidDoubled;
  alternate = state.alternate;
  return state.saved;
}

function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ known: [...known], max: maxSyllables, spacing, minutes, twoLetters, avoidDoubled, alternate }),
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
    error.textContent = [...known].some((u) => VOWELS.includes(u) || VOWEL_COMBOS.includes(u))
      ? NO_CONSONANT_ERROR
      : NO_VOWEL_ERROR;
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

function buildSegments(container, choices, getValue, setValue, label = String) {
  const refresh = () => {
    container.querySelectorAll('.segment').forEach((button) => {
      const checked = Number(button.dataset.value) === getValue();
      button.setAttribute('aria-checked', String(checked));
      button.tabIndex = checked ? 0 : -1;
    });
  };
  const select = (n, { focus = false } = {}) => {
    setValue(n);
    refresh();
    if (focus) container.querySelector('.segment[tabindex="0"]').focus();
  };
  for (const n of choices) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'segment';
    button.textContent = label(n);
    button.dataset.value = String(n);
    button.setAttribute('role', 'radio');
    button.addEventListener('click', () => select(n));
    button.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const next = (choices.indexOf(n) + step + choices.length) % choices.length;
      select(choices[next], { focus: true });
    });
    container.append(button);
  }
  refresh();
}

function refreshAlternate() {
  $('#alternate').setAttribute('aria-checked', String(alternate));
}

function refreshNoDoubles() {
  $('#no-doubles').setAttribute('aria-checked', String(avoidDoubled));
}

function refreshTwoLetters() {
  $('#two-letters').setAttribute('aria-checked', String(twoLetters));
  $('#more-sounds').hidden = twoLetters;
  $('#more-sounds-note').hidden = !twoLetters;
}

const FIT_MAX_REM = 6;
const FIT_MIN_REM = 1;
const FIT_MARGIN = 0.98;
const FIT_PASSES = 5;

function fitReels() {
  const field = $('#reels');
  const spans = [...field.children];
  if (spans.length === 0) return;
  const style = getComputedStyle(field);
  const avail = field.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  if (avail <= 0) return;
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const gaps = (parseFloat(style.columnGap) || 0) * (spans.length - 1);
  const room = avail - gaps;
  const measure = () => spans.reduce((sum, span) => sum + span.getBoundingClientRect().width, 0);
  let size = FIT_MAX_REM * rem;
  field.style.setProperty('--syllable-size', `${size}px`);
  // Glyph widths are not always linear in font size (hinting), so measure again after resizing.
  for (let pass = 0; pass < FIT_PASSES; pass += 1) {
    const textWidth = measure();
    if (textWidth <= room) break;
    size = Math.max(FIT_MIN_REM * rem, (size * room * FIT_MARGIN) / textWidth);
    field.style.setProperty('--syllable-size', `${size}px`);
  }
}

function showReels(syllables) {
  const field = $('#reels');
  field.dataset.count = String(syllables.length);
  field.dataset.spacing = String(spacing);
  field.replaceChildren(
    ...syllables.map((text) => {
      const span = document.createElement('span');
      span.className = 'syllable';
      span.textContent = text;
      return span;
    }),
  );
  fitReels();
}

function cancelSpin() {
  timers.forEach(({ id, repeating }) => (repeating ? clearInterval(id) : clearTimeout(id)));
  timers = [];
  spinning = false;
  $('#start').removeAttribute('aria-disabled');
}

function formatClock(ms) {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function wordsText(n) {
  return `${n} ${n === 1 ? 'Wort' : 'Wörter'}`;
}

function renderClock(ms) {
  $('#clock').textContent = formatClock(ms);
}

function renderCount() {
  // The round on screen is still being read, so it only counts once the next one starts.
  $('#count').textContent = wordsText(Math.max(0, rounds - 1));
}

function stopClock() {
  clearInterval(clockId);
  clockId = null;
}

function resetSession() {
  cancelSpin();
  stopClock();
  phase = minutes ? 'ready' : 'off';
  rounds = 0;
  $('#done').hidden = true;
  $('#reels').hidden = false;
  $('#reels').replaceChildren();
  $('#result').textContent = '';
  $('#start').hidden = false;
  $('#start').textContent = 'START';
  $('#prompt').hidden = false;
  $('#prompt').textContent = minutes ? 'Drücke START. Dann läuft die Zeit.' : 'Drücke START und lies die Silben.';
  $('#timer-bar').hidden = !minutes;
  if (minutes) {
    renderClock(minutes * 60000);
    renderCount();
  }
}

function startClock() {
  phase = 'running';
  endsAt = Date.now() + minutes * 60000;
  clockId = setInterval(tick, CLOCK_TICK_MS);
  tick();
}

function tick() {
  const left = endsAt - Date.now();
  renderClock(left);
  if (left <= 0) timeOver();
}

function timeOver() {
  stopClock();
  phase = 'over';
  if (!spinning) {
    showOver();
    announce('Die Zeit ist um.');
  }
}

function showOver() {
  $('#start').textContent = 'Fertig';
  $('#prompt').textContent = 'Die Zeit ist um. Lies das letzte Wort.';
}

function showResult() {
  phase = 'done';
  $('#reels').hidden = true;
  $('#start').hidden = true;
  $('#prompt').hidden = true;
  $('#timer-bar').hidden = true;
  $('#done-count').textContent = `${wordsText(rounds)} gelesen`;
  $('#done').hidden = false;
  announce(`Geschafft! ${wordsText(rounds)} gelesen`);
  $('#done-title').focus();
}

function onStart() {
  if (spinning) return;
  if (phase === 'running') tick();
  if (phase === 'over') {
    showResult();
    return;
  }
  if (phase === 'done') return;
  if (phase === 'ready') startClock();
  spin();
}

function spin(animate = true) {
  if (spinning) return;
  const round = generate(known, maxSyllables, words, Math.random, { seen, twoLetters, avoidDoubled, alternate });
  if (!round) return;
  if (phase === 'running') {
    rounds += 1;
    renderCount();
  }
  const pools = unitPools(known, { twoLetters });

  showReels(round.syllables);
  const spans = [...document.querySelectorAll('#reels .syllable')];
  const prompt = $('#prompt');
  const finish = () => {
    cancelSpin();
    fitReels();
    const shown = round.syllables.join(' ');
    announce(phase === 'over' ? `${shown}. Die Zeit ist um.` : shown);
    prompt.textContent =
      round.syllables.length === 1
        ? 'Lies die Silbe. Bereit für die nächste Runde?'
        : `Lies die ${round.syllables.length} Silben. Bereit für die nächste Runde?`;
    if (phase === 'over') showOver();
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
  cancelSpin();
  $('#setup').hidden = true;
  $('#play').hidden = false;
  $('#summary').textContent = describeSelection(known, maxSyllables, twoLetters, avoidDoubled, alternate, spacing);
  await Promise.race([wordsReady, new Promise((resolve) => setTimeout(resolve, WORDS_WAIT_MS))]);
  if ($('#play').hidden) return;
  resetSession();
  if (!minutes) spin(false);
  $('#start').focus();
}

function showSetup() {
  cancelSpin();
  stopClock();
  phase = 'off';
  $('#play').hidden = true;
  $('#setup').hidden = false;
  $('#setup h1').focus();
}

async function loadWords() {
  try {
    const response = await fetch('data/words.json', { signal: AbortSignal.timeout(WORDS_TIMEOUT_MS) });
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
  buildSegments($('#max'), MAX_CHOICES, () => maxSyllables, (n) => (maxSyllables = n));
  buildSegments($('#spacing'), SPACING_CHOICES, () => spacing, (n) => (spacing = n));
  buildSegments($('#minutes'), TIMER_CHOICES, () => minutes, (n) => (minutes = n), (n) => (n === 0 ? 'aus' : String(n)));
  refreshTwoLetters();
  refreshNoDoubles();
  refreshAlternate();
  $('#alternate').addEventListener('click', () => {
    alternate = !alternate;
    refreshAlternate();
  });
  $('#no-doubles').addEventListener('click', () => {
    avoidDoubled = !avoidDoubled;
    refreshNoDoubles();
  });
  $('#two-letters').addEventListener('click', () => {
    twoLetters = !twoLetters;
    refreshTwoLetters();
    $('#setup-error').hidden = true;
  });
  $('#go').addEventListener('click', showPlay);
  $('#start').addEventListener('click', onStart);
  $('#again').addEventListener('click', () => {
    resetSession();
    $('#start').focus();
  });
  $('#back').addEventListener('click', showSetup);
  let reelsWidth = 0;
  new ResizeObserver(() => {
    const width = $('#reels').clientWidth;
    if (width === reelsWidth || spinning) return;
    reelsWidth = width;
    fitReels();
  }).observe($('#reels'));
  document.fonts.addEventListener('loadingdone', fitReels);
  wordsReady = loadWords();
  if (hasSavedConfig && canGenerate(known, { twoLetters })) showPlay();
  else $('#setup').hidden = false;
}

init();
