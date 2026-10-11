import {
  CONSONANTS,
  CONSONANT_COMBOS,
  VOWELS,
  VOWEL_COMBOS,
  generate,
  makeSyllable,
  parseWords,
  unitPools,
} from './generate.js';

const STORAGE_KEY = 'silbentrainer.v1';
const GROUPS = {
  vowels: VOWELS,
  vowelCombos: VOWEL_COMBOS,
  consonants: CONSONANTS,
  consonantCombos: CONSONANT_COMBOS,
};
const MAX_CHOICES = [1, 2, 3, 4];
const SPIN_MS = 600;
const SPIN_STAGGER_MS = 350;
const TICK_MS = 70;

const known = new Set();
let maxSyllables = 2;
let words = [];
let spinning = false;

const $ = (selector) => document.querySelector(selector);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      saved.known.forEach((unit) => known.add(unit));
      if (MAX_CHOICES.includes(saved.max)) maxSyllables = saved.max;
    }
  } catch {
    // no saved state
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ known: [...known], max: maxSyllables }));
  } catch {
    // storage unavailable
  }
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
        save();
      });
      container.append(tile);
    }
  }
}

function buildMaxChoices() {
  const container = $('#max');
  for (const n of MAX_CHOICES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'segment';
    button.textContent = String(n);
    button.setAttribute('role', 'radio');
    button.addEventListener('click', () => {
      maxSyllables = n;
      refreshMaxChoices();
      save();
    });
    container.append(button);
  }
  refreshMaxChoices();
}

function refreshMaxChoices() {
  document.querySelectorAll('.segment').forEach((button) => {
    button.setAttribute('aria-checked', String(Number(button.textContent) === maxSyllables));
  });
}

function showReels(syllables) {
  const reels = $('#reels');
  reels.dataset.count = String(syllables.length);
  reels.replaceChildren(
    ...syllables.map((text) => {
      const reel = document.createElement('div');
      reel.className = 'reel';
      const span = document.createElement('span');
      span.className = 'syllable';
      span.textContent = text;
      reel.append(span);
      return reel;
    }),
  );
}

function spin() {
  if (spinning) return;
  const round = generate(known, maxSyllables, words);
  if (!round) return;
  const pools = unitPools(known);

  showReels(round.syllables);
  const reelNodes = [...document.querySelectorAll('.reel')];
  const prompt = $('#prompt');
  const result = $('#result');
  const finish = () => {
    spinning = false;
    $('#start').disabled = false;
    const text = round.syllables.join(' ');
    result.textContent = text;
    prompt.textContent =
      round.syllables.length === 1
        ? 'Lies die Silbe. Bereit für die nächste Runde?'
        : `Lies die ${round.syllables.length} Silben. Bereit für die nächste Runde?`;
  };

  if (reducedMotion) {
    finish();
    return;
  }

  spinning = true;
  $('#start').disabled = true;
  prompt.textContent = 'Die Walzen drehen sich …';
  let remaining = reelNodes.length;
  reelNodes.forEach((reel, index) => {
    const span = reel.querySelector('.syllable');
    reel.classList.add('spinning');
    const timer = setInterval(() => {
      span.textContent = makeSyllable(pools, Math.random);
    }, TICK_MS);
    setTimeout(() => {
      clearInterval(timer);
      span.textContent = round.syllables[index];
      reel.classList.remove('spinning');
      remaining -= 1;
      if (remaining === 0) finish();
    }, SPIN_MS + index * SPIN_STAGGER_MS);
  });
}

function showPlay() {
  const pools = unitPools(known);
  if (pools.vowels.length === 0) {
    $('#setup-error').hidden = false;
    return;
  }
  $('#setup').hidden = true;
  $('#play').hidden = false;
  const letters = [...known].sort((a, b) => a.localeCompare(b, 'de')).join(', ');
  $('#summary').textContent = `Bekannt: ${letters} · höchstens ${maxSyllables} ${maxSyllables === 1 ? 'Silbe' : 'Silben'}`;
  showReels(['·']);
  $('#prompt').textContent = 'Drücke START und lies die Silben.';
  $('#result').textContent = '';
}

function showSetup() {
  $('#play').hidden = true;
  $('#setup').hidden = false;
}

async function init() {
  load();
  buildTiles();
  buildMaxChoices();
  $('#go').addEventListener('click', showPlay);
  $('#start').addEventListener('click', spin);
  $('#back').addEventListener('click', showSetup);
  try {
    const response = await fetch('data/words.json');
    words = parseWords(await response.json());
  } catch {
    words = [];
  }
}

init();
