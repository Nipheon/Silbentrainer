import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { doublesConsonant, hasDoubledConsonant } from '../src/generate.js';
import { isBlocked } from '../src/blocklist.js';
import { canGenerate, generate, pickCount, hasMergingJunction, mergesAtJunction, parseWords, syllableIsKnown, tokenize, wordIsKnown } from '../src/generate.js';

const words = parseWords(JSON.parse(readFileSync(new URL('../data/words.json', import.meta.url))));
const known = new Set(['a', 'l', 'm']);

assert.deepEqual(tokenize('Schick'), ['sch', 'i', 'ck']);
assert.deepEqual(tokenize('Mei'), ['m', 'ei']);
assert.equal(tokenize('xa'), null);

assert.ok(syllableIsKnown('la', known));
assert.ok(syllableIsKnown('Mal', known));
assert.ok(!syllableIsKnown('lm', known), 'needs a vowel');
assert.ok(!syllableIsKnown('ma', new Set(['a'])), 'm unknown');
assert.ok(!syllableIsKnown('bie', new Set(['b', 'i', 'e'])), 'ie only with ie unit');
assert.ok(!syllableIsKnown('sche', new Set(['s', 'e', 'h'])), 'sch needs own unit');

const byText = (t) => words.find((w) => w.text === t);
assert.ok(wordIsKnown(byText('Lama'), known));
assert.ok(wordIsKnown(byText('Mama'), known));
assert.ok(!wordIsKnown(byText('Oma'), known));

let seed = 42;
const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

let real = 0;
for (let i = 0; i < 2000; i++) {
  const r = generate(known, 2, words, rng);
  assert.ok(r.syllables.length >= 1 && r.syllables.length <= 2);
  for (const s of r.syllables) assert.ok(syllableIsKnown(s, known), `bad syllable ${s}`);
  if (r.real) real++;
}
assert.ok(real > 0, 'real words appear');

assert.equal(generate(new Set(['l', 'm']), 3, words, rng), null, 'no vowel, no output');

assert.equal(generate(new Set(['a']), 2, words, rng), null, 'single letter syllables are never shown');
assert.equal(generate(new Set(['a', 'e']), 2, words, rng), null, 'vowels alone cannot form 2 letters');
const combosOnly = generate(new Set(['ei']), 2, words, rng);
assert.ok(combosOnly.syllables.every((s) => s.toLowerCase() === 'ei'));

for (let i = 0; i < 3000; i++) {
  for (const s of generate(known, 3, words, rng).syllables) assert.ok(s.length >= 2, `single letter ${s}`);
}
assert.ok(!wordIsKnown(byText('Oma'), new Set(['o', 'm', 'a'])), 'O·ma has a single-letter syllable');

const seen = new Set();
const small = new Set(['a', 'l']);
const shown = [];
for (let i = 0; i < 40; i++) {
  const r = generate(small, 1, words, rng, { realRatio: 0, seen });
  shown.push(r.syllables.join('').toLowerCase());
}
const distinctFirstRun = new Set(shown.slice(0, 2));
assert.equal(distinctFirstRun.size, 2, 'no repeat before the pool is exhausted');
const unique = new Set(shown.slice(0, 3));
assert.equal(unique.size, 3, 'la, al, lal each appear once before any repeat');
for (let i = 1; i < shown.length; i++) {
  assert.notEqual(shown[i], shown[i - 1], `same combination twice in a row at round ${i}`);
}

const withCk = new Set(['a', 'k', 'c', 'ck']);
for (let i = 0; i < 500; i++) {
  for (const s of generate(withCk, 3, words, rng).syllables) {
    assert.ok(!/^ck/i.test(s), 'ck only at end');
  }
}

assert.deepEqual(tokenize('Stein'), ['st', 'ei', 'n']);
assert.deepEqual(tokenize('Ast'), ['a', 's', 't'], 'st is a unit only at syllable start');
assert.ok(syllableIsKnown('Ast', new Set(['a', 's', 't'])));
assert.ok(!syllableIsKnown('sta', new Set(['a', 's', 't'])), 'initial st needs the st unit');
assert.ok(syllableIsKnown('sta', new Set(['a', 'st'])));

const withSt = new Set(['a', 'm', 's', 't', 'st', 'sp', 'p']);
for (let i = 0; i < 1000; i++) {
  for (const s of generate(withSt, 3, words, rng, { realRatio: 0 }).syllables) {
    assert.ok(!/(st|sp)$/i.test(s), 'st/sp never at syllable end');
  }
}

assert.ok(mergesAtJunction('Le', 'im'));
assert.ok(mergesAtJunction('ma', 'ie'));
assert.ok(mergesAtJunction('la', 'ut'));
assert.ok(!mergesAtJunction('Mal', 'im'), 'consonant at the junction is fine');
assert.ok(!mergesAtJunction('le', 'mi'));
assert.ok(hasMergingJunction(['ma', 'le', 'im']));

const vowelHeavy = new Set(['l', 'm', 'a', 'e', 'i', 'u', 'ie', 'au', 'ei']);
for (let i = 0; i < 5000; i++) {
  const r = generate(vowelHeavy, 4, words, rng, { realRatio: 0.3 });
  assert.ok(!hasMergingJunction(r.syllables), `merging junction in ${r.syllables.join(' ')}`);
}
assert.ok(words.every((w) => !hasMergingJunction(w.syllables)), 'word list has no merging junction');

const tally = { 1: 0, 2: 0, 3: 0, 4: 0 };
for (let i = 0; i < 10000; i++) tally[pickCount(3, rng)]++;
assert.ok(tally[3] > 7850 && tally[3] < 8150, `80% full length, got ${tally[3]}`);
assert.ok(tally[1] > 900 && tally[1] < 1100 && tally[2] > 900 && tally[2] < 1100, 'rest split evenly');
assert.equal(pickCount(0, rng), 1, 'zero is clamped to one');
assert.equal(tally[4], 0);
assert.ok([...Array(50)].every(() => pickCount(1, rng) === 1));

const rich = new Set(['a', 'e', 'i', 'o', 'u', 'ei', 'au', 'l', 'm', 's', 't', 'sch', 'st', 'ck', 'ch']);
for (let i = 0; i < 5000; i++) {
  const r = generate(rich, 4, words, rng, { twoLetters: true, realRatio: 0.5 });
  for (const s of r.syllables) assert.equal(s.length, 2, `not two letters: ${s}`);
}
assert.ok(canGenerate(new Set(['a', 'l']), { twoLetters: true }));
assert.ok(!canGenerate(new Set(['a', 'e']), { twoLetters: true }));
assert.ok(canGenerate(new Set(['ei']), { twoLetters: true }), 'ei is two letters');
assert.ok(!canGenerate(new Set(['sch', 'a']), { twoLetters: true }), 'sch never fits two letters');
assert.ok(canGenerate(new Set(['sch', 'a']), { twoLetters: false }));
assert.ok(wordIsKnown(byText('Mama'), known, { twoLetters: true }));
assert.ok(!wordIsKnown(byText('Mal'), known, { twoLetters: true }), 'Mal has three letters');
let threeLetter = 0;
for (let i = 0; i < 3000; i++) {
  if (generate(known, 2, words, rng).syllables.some((s) => s.length === 3)) threeLetter++;
}
assert.ok(threeLetter > 0, 'longer syllables still possible when the option is off');

// capitalisation: only the first letter of made-up rounds, and both cases occur
let capitalFirst = 0;
let lowerFirst = 0;
for (let i = 0; i < 2000; i++) {
  const r = generate(known, 3, words, rng, { realRatio: 0 });
  assert.ok(r.syllables.slice(1).every((x) => x === x.toLowerCase()), `later syllable capitalised: ${r.syllables}`);
  assert.equal(r.syllables[0].slice(1), r.syllables[0].slice(1).toLowerCase());
  if (r.syllables[0][0] !== r.syllables[0][0].toLowerCase()) capitalFirst++;
  else lowerFirst++;
}
assert.ok(capitalFirst > 800 && lowerFirst > 800, `first letter capitalised about half the time: ${capitalFirst}/${lowerFirst}`);

// real words keep their stored spelling
const keepsCase = new Set();
for (let i = 0; i < 500; i++) {
  const r = generate(new Set(['m', 'a', 'l', 'o', 'i', 's']), 3, words, rng, { realRatio: 1, twoLetters: true });
  if (r.real) keepsCase.add(r.syllables.join(''));
}
assert.ok(keepsCase.has('Salami') || keepsCase.has('Mama'), 'real words appear with stored casing');
assert.ok(![...keepsCase].some((w) => w === w.toLowerCase() && /^[A-ZÄÖÜ]/.test(w)));

// real words: never longer than the configured maximum, never already shown
const pool = new Set(['b', 'n', 'a', 'm', 'e']);
const twoAndThree = parseWords(['Ma·ma', 'Ba·na·ne', 'Na·ne']);
for (let i = 0; i < 1000; i++) {
  const r = generate(pool, 2, twoAndThree, rng, { realRatio: 1, twoLetters: true });
  assert.ok(r.syllables.length <= 2, `too many syllables: ${r.syllables}`);
}
const alreadyShown = new Set(['ma·ma', 'na·ne']);
for (let i = 0; i < 500; i++) {
  const r = generate(pool, 2, twoAndThree, rng, { realRatio: 1, twoLetters: true, seen: new Set(alreadyShown) });
  assert.ok(!(r.real && alreadyShown.has(r.syllables.join('·').toLowerCase())), `repeated real word ${r.syllables}`);
}

// merging pairs, one by one
for (const [a, b] of [['me', 'ut'], ['mä', 'ut'], ['mi', 'et'], ['me', 'it'], ['ma', 'it'], ['ma', 'ut']]) {
  assert.ok(mergesAtJunction(a, b), `${a} ${b} should merge`);
}
assert.ok(mergesAtJunction('mE', 'Ut'), 'junction check ignores case');

// blocklist
assert.ok(isBlocked(['hu', 're']));
assert.ok(isBlocked(['Na', 'zi']));
assert.ok(isBlocked(['mö', 'se']));
assert.ok(!isBlocked(['la', 'ma']));
const risky = new Set(['h', 'u', 'r', 'e', 'n', 'a', 'z', 'i', 'm', 'ö', 's', 'k', 'p', 'l', 'o']);
for (let i = 0; i < 20000; i++) {
  const r = generate(risky, 3, words, rng, { realRatio: 0, twoLetters: true });
  assert.ok(!isBlocked(r.syllables), `blocked string shown: ${r.syllables.join(' ')}`);
}

// limitation we accept: with only a vowel pair the junction cannot be avoided
const onlyEi = generate(new Set(['ei']), 2, words, rng, { twoLetters: true });
assert.ok(onlyEi.syllables.every((x) => x.toLowerCase() === 'ei'));

// never throws for odd maximum
assert.ok(generate(known, 0, words, rng).syllables.length >= 1);

// exact syllable count: shorter real words only in the shorter rounds (~20% of draws)
const mixed = parseWords(['am', 'Ma·ma']);
let oneSyllable = 0;
for (let i = 0; i < 5000; i++) {
  const r = generate(new Set(['m', 'a']), 2, mixed, rng, { realRatio: 1, twoLetters: true });
  if (r.real && r.syllables.length === 1) oneSyllable++;
}
assert.ok(oneSyllable > 750 && oneSyllable < 1250, `one-syllable words only for count 1, got ${oneSyllable}/5000`);

// real words with a merging junction are never served
const bad = parseWords(['la·ut']);
for (let i = 0; i < 300; i++) {
  const r = generate(new Set(['l', 'a', 'u', 't']), 2, bad, rng, { realRatio: 1, twoLetters: true });
  assert.ok(!(r.real && r.syllables.join('·') === 'la·ut'), 'word with merging junction served');
}

// doubled vowels are their own units, available when the two-letter option is off
assert.deepEqual(tokenize('Tee'), ['t', 'ee']);
assert.deepEqual(tokenize('Aal'), ['aa', 'l']);
assert.ok(!syllableIsKnown('tee', new Set(['t', 'e'])), 'ee needs its own unit');
assert.ok(syllableIsKnown('tee', new Set(['t', 'ee'])));
assert.ok(wordIsKnown(byText('Tee'), new Set(['t', 'ee'])));
assert.ok(!wordIsKnown(byText('Tee'), new Set(['t', 'e'])));
assert.ok(!wordIsKnown(byText('Tee'), new Set(['t', 'ee']), { twoLetters: true }), 'Tee has three letters');
assert.ok(mergesAtJunction('te', 'er'), 'e + e across syllables would read as ee');
const free = new Set(['t', 's', 'l', 'ee', 'aa']);
const seenSyllables = new Set();
for (let i = 0; i < 3000; i++) {
  for (const x of generate(free, 2, words, rng, { realRatio: 0, twoLetters: false }).syllables) seenSyllables.add(x.toLowerCase());
}
assert.ok(seenSyllables.has('tee') || seenSyllables.has('see'), 'syllables like tee/see appear with the option off');
const strict = new Set();
for (let i = 0; i < 3000; i++) {
  for (const x of generate(free, 2, words, rng, { realRatio: 0, twoLetters: true }).syllables) strict.add(x.toLowerCase());
}
assert.ok(![...strict].some((x) => x.length > 2), 'no three-letter syllables with the option on');
let realFree = false;
for (let i = 0; i < 2000 && !realFree; i++) {
  const r = generate(free, 1, words, rng, { realRatio: 1, twoLetters: false });
  if (r.real && ['Tee', 'See', 'Aal'].includes(r.syllables[0])) realFree = true;
}
assert.ok(realFree, 'Tee/See/Aal are served as real words with the option off');

// doubled consonants across a syllable junction (at te, op pe, am ma, en na)
for (const [a, b] of [['at', 'te'], ['op', 'pe'], ['am', 'ma'], ['en', 'na'], ['Al', 'la']]) {
  assert.ok(doublesConsonant(a, b), `${a} ${b} doubles`);
}
assert.ok(doublesConsonant('es', 'se'));
assert.ok(doublesConsonant('ak', 'ku'), 'Akku');
assert.ok(!doublesConsonant('at', 'se'));
for (const c of 'bdfgklmnprstz') assert.ok(doublesConsonant(`a${c}`, `${c}a`), `${c}${c} is avoided`);
for (const c of 'hjvwxq') assert.ok(!doublesConsonant(`a${c}`, `${c}a`), `${c}${c} does not occur in German, not avoided`);
assert.ok(!doublesConsonant('ma', 'ma'), 'vowel at the junction is fine');
assert.ok(!doublesConsonant('mi', 'it'), 'only consonants count as doubled');
assert.ok(!doublesConsonant('am', 'at'), 'vowel after the consonant is fine');
assert.ok(hasDoubledConsonant(['la', 'am', 'ma']));

const doublePool = new Set(['a', 'o', 'e', 'l', 'm', 'n', 'p', 't']);
let doubledOff = 0;
for (let i = 0; i < 4000; i++) {
  const on = generate(doublePool, 3, words, rng, { realRatio: 0.3, twoLetters: true, avoidDoubled: true });
  assert.ok(!hasDoubledConsonant(on.syllables), `doubled consonant: ${on.syllables.join(' ')}`);
  const off = generate(doublePool, 3, words, rng, { realRatio: 0, twoLetters: true, avoidDoubled: false });
  if (hasDoubledConsonant(off.syllables)) doubledOff++;
}
assert.ok(doubledOff > 100, `doubles still appear with the option off (${doubledOff})`);

// real words with a doubled consonant (Rol·ler, Sup·pe) are skipped only when the option is on
const doubledWords = parseWords(['Rol·ler']);
const rollerKnown = new Set(['r', 'o', 'l', 'e']);
let rollerOff = false;
for (let i = 0; i < 400; i++) {
  const on = generate(rollerKnown, 2, doubledWords, rng, { realRatio: 1, avoidDoubled: true });
  assert.ok(!(on.real && on.syllables.join('') === 'Roller'), 'Roller served despite the option');
  const off = generate(rollerKnown, 2, doubledWords, rng, { realRatio: 1, avoidDoubled: false });
  if (off.real && off.syllables.join('') === 'Roller') rollerOff = true;
}
assert.ok(rollerOff, 'Roller is served when the option is off');

// only the first letter of the first syllable may be uppercase, with every letter known, real words included
const everything = new Set(['a', 'e', 'i', 'o', 'u', 'ä', 'ö', 'ü', 'ei', 'au', 'eu', 'äu', 'ie', 'aa', 'ee', 'oo',
  'b', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'z', 'ch', 'sch', 'ck', 'qu', 'st', 'sp']);
for (const twoLetters of [true, false]) {
  for (let i = 0; i < 4000; i++) {
    const r = generate(everything, 4, words, rng, { twoLetters, avoidDoubled: true });
    const text = r.syllables.join('');
    assert.ok(text.slice(1) === text.slice(1).toLowerCase(), `uppercase after the first letter: ${r.syllables.join(' ')}`);
  }
}

// no two vowels meet across a syllable junction (Mi il, Lo am), whichever vowels they are
for (const a of 'aeiouäöü') {
  for (const b of 'aeiouäöü') assert.ok(mergesAtJunction(`m${a}`, `${b}l`), `${a} + ${b} must count as vowels meeting`);
}
assert.ok(mergesAtJunction('Mi', 'il'));
assert.ok(mergesAtJunction('Lo', 'am'));
assert.ok(!mergesAtJunction('Mil', 'am'), 'consonant before the vowel is fine');
assert.ok(!mergesAtJunction('lo', 'ma'));
assert.ok(!mergesAtJunction('la', 'sch'.slice(0, 1) + 'u'));
const lowVowels = new Set(['a', 'e', 'i', 'o', 'l', 'm', 's']);
for (const twoLetters of [true, false]) {
  for (const avoidDoubled of [true, false]) {
    for (let i = 0; i < 3000; i++) {
      const r = generate(lowVowels, 4, words, rng, { twoLetters, avoidDoubled, realRatio: 0.4 });
      assert.ok(!hasMergingJunction(r.syllables), `vowels meet: ${r.syllables.join(' ')} (twoLetters=${twoLetters})`);
    }
  }
}
const mixedUmlaut = new Set(['ä', 'ö', 'ü', 'u', 'a', 'l', 'n', 'ei', 'au']);
for (let i = 0; i < 3000; i++) {
  const r = generate(mixedUmlaut, 3, words, rng, { realRatio: 0, avoidDoubled: true });
  assert.ok(!hasMergingJunction(r.syllables), `vowels meet: ${r.syllables.join(' ')}`);
}

console.log('all tests passed');
