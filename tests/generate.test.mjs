import assert from 'node:assert/strict';
import { alternates, consonantsMeet, doublesConsonant, hasDoubledConsonant } from '../src/generate.js';
import { isBlocked } from '../src/blocklist.js';
import { canGenerate, generate, pickCount, hasMergingJunction, mergesAtJunction, syllableIsKnown, tokenize } from '../src/generate.js';

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

let seed = 42;
const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

for (let i = 0; i < 2000; i++) {
  const r = generate(known, 2, rng);
  assert.ok(r.syllables.length >= 1 && r.syllables.length <= 2);
  for (const s of r.syllables) assert.ok(syllableIsKnown(s, known), `bad syllable ${s}`);
}

assert.equal(generate(new Set(['l', 'm']), 3, rng), null, 'no vowel, no output');

assert.equal(generate(new Set(['a']), 2, rng), null, 'single letter syllables are never shown');
assert.equal(generate(new Set(['a', 'e']), 2, rng), null, 'vowels alone cannot form 2 letters');
const combosOnly = generate(new Set(['ei']), 2, rng);
assert.ok(combosOnly.syllables.every((s) => s.toLowerCase() === 'ei'));

for (let i = 0; i < 3000; i++) {
  for (const s of generate(known, 3, rng).syllables) assert.ok(s.length >= 2, `single letter ${s}`);
}

const seen = new Set();
const small = new Set(['a', 'l']);
const shown = [];
for (let i = 0; i < 40; i++) {
  const r = generate(small, 1, rng, { seen });
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
  for (const s of generate(withCk, 3, rng).syllables) {
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
  for (const s of generate(withSt, 3, rng).syllables) {
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
  const r = generate(vowelHeavy, 4, rng);
  assert.ok(!hasMergingJunction(r.syllables), `merging junction in ${r.syllables.join(' ')}`);
}

const tally = { 1: 0, 2: 0, 3: 0, 4: 0 };
for (let i = 0; i < 10000; i++) tally[pickCount(3, rng)]++;
assert.ok(tally[3] > 7850 && tally[3] < 8150, `80% full length, got ${tally[3]}`);
assert.ok(tally[1] > 900 && tally[1] < 1100 && tally[2] > 900 && tally[2] < 1100, 'rest split evenly');
assert.equal(pickCount(0, rng), 1, 'zero is clamped to one');
assert.equal(tally[4], 0);
assert.ok([...Array(50)].every(() => pickCount(1, rng) === 1));

const rich = new Set(['a', 'e', 'i', 'o', 'u', 'ei', 'au', 'l', 'm', 's', 't', 'sch', 'st', 'ck', 'ch']);
let oneLetter = 0;
let twoLetter = 0;
for (let i = 0; i < 5000; i++) {
  const r = generate(rich, 4, rng, { twoLetters: true });
  for (const s of r.syllables) {
    assert.ok(s.length === 1 || s.length === 2, `not one or two letters: ${s}`);
    if (s.length === 1) oneLetter++;
    else twoLetter++;
  }
}
assert.ok(oneLetter > 100, `single-letter syllables such as 'O ma' appear (${oneLetter})`);
assert.ok(twoLetter > oneLetter, 'two-letter syllables stay the norm');
assert.ok(canGenerate(new Set(['a', 'l']), { twoLetters: true }));
assert.ok(!canGenerate(new Set(['a', 'e']), { twoLetters: true }), 'lone vowels alone give no round of two letters');
assert.ok(canGenerate(new Set(['a', 'ei']), { twoLetters: true }), 'ei makes a two-letter syllable');
assert.ok(!canGenerate(new Set(['a', 'e']), { twoLetters: false }), 'never a single letter without the option');
assert.ok(!canGenerate(new Set(['l', 'm']), { twoLetters: true }), 'no vowel, no syllable');
assert.ok(canGenerate(new Set(['ei']), { twoLetters: true }), 'ei is two letters');
for (let i = 0; i < 500; i++) {
  for (const x of generate(new Set(['sch', 'a', 'l']), 3, rng, { twoLetters: true }).syllables) {
    assert.ok(!x.toLowerCase().includes('sch'), 'sch never fits in one or two letters');
  }
}
assert.ok(canGenerate(new Set(['sch', 'a']), { twoLetters: false }));
let threeLetter = 0;
for (let i = 0; i < 3000; i++) {
  if (generate(known, 2, rng).syllables.some((s) => s.length === 3)) threeLetter++;
}
assert.ok(threeLetter > 0, 'longer syllables still possible when the option is off');

// capitalisation: only the first letter of made-up rounds, and both cases occur
let capitalFirst = 0;
let lowerFirst = 0;
for (let i = 0; i < 2000; i++) {
  const r = generate(known, 3, rng);
  assert.ok(r.syllables.slice(1).every((x) => x === x.toLowerCase()), `later syllable capitalised: ${r.syllables}`);
  assert.equal(r.syllables[0].slice(1), r.syllables[0].slice(1).toLowerCase());
  if (r.syllables[0][0] !== r.syllables[0][0].toLowerCase()) capitalFirst++;
  else lowerFirst++;
}
assert.ok(capitalFirst > 800 && lowerFirst > 800, `first letter capitalised about half the time: ${capitalFirst}/${lowerFirst}`);

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
  const r = generate(risky, 3, rng, { twoLetters: true });
  assert.ok(!isBlocked(r.syllables), `blocked string shown: ${r.syllables.join(' ')}`);
}

// limitation we accept: with only a vowel pair the junction cannot be avoided
const onlyEi = generate(new Set(['ei']), 2, rng, { twoLetters: true });
assert.ok(onlyEi.syllables.every((x) => x.toLowerCase() === 'ei'));

// never throws for odd maximum
assert.ok(generate(known, 0, rng).syllables.length >= 1);

assert.deepEqual(tokenize('Tee'), ['t', 'ee']);
assert.deepEqual(tokenize('Aal'), ['aa', 'l']);
assert.ok(!syllableIsKnown('tee', new Set(['t', 'e'])), 'ee needs its own unit');
assert.ok(syllableIsKnown('tee', new Set(['t', 'ee'])));
assert.ok(mergesAtJunction('te', 'er'), 'e + e across syllables would read as ee');
const free = new Set(['t', 's', 'l', 'ee', 'aa']);
const seenSyllables = new Set();
for (let i = 0; i < 3000; i++) {
  for (const x of generate(free, 2, rng, { twoLetters: false }).syllables) seenSyllables.add(x.toLowerCase());
}
assert.ok(seenSyllables.has('tee') || seenSyllables.has('see'), 'syllables like tee/see appear with the option off');
const strict = new Set();
for (let i = 0; i < 3000; i++) {
  for (const x of generate(free, 2, rng, { twoLetters: true }).syllables) strict.add(x.toLowerCase());
}
assert.ok(![...strict].some((x) => x.length > 2), 'no three-letter syllables with the option on');

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
  const on = generate(doublePool, 3, rng, { twoLetters: true, avoidDoubled: true });
  assert.ok(!hasDoubledConsonant(on.syllables), `doubled consonant: ${on.syllables.join(' ')}`);
  const off = generate(doublePool, 3, rng, { twoLetters: true, avoidDoubled: false });
  if (hasDoubledConsonant(off.syllables)) doubledOff++;
}
assert.ok(doubledOff > 100, `doubles still appear with the option off (${doubledOff})`);

// only the first letter of the first syllable may be uppercase, with every letter known
const everything = new Set(['a', 'e', 'i', 'o', 'u', 'ä', 'ö', 'ü', 'ei', 'au', 'eu', 'äu', 'ie', 'aa', 'ee', 'oo',
  'b', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'z', 'ch', 'sch', 'ck', 'qu', 'st', 'sp']);
for (const twoLetters of [true, false]) {
  for (let i = 0; i < 4000; i++) {
    const r = generate(everything, 4, rng, { twoLetters, avoidDoubled: true });
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
      const r = generate(lowVowels, 4, rng, { twoLetters, avoidDoubled });
      assert.ok(!hasMergingJunction(r.syllables), `vowels meet: ${r.syllables.join(' ')} (twoLetters=${twoLetters})`);
    }
  }
}
const mixedUmlaut = new Set(['ä', 'ö', 'ü', 'u', 'a', 'l', 'n', 'ei', 'au']);
for (let i = 0; i < 3000; i++) {
  const r = generate(mixedUmlaut, 3, rng, { avoidDoubled: true });
  assert.ok(!hasMergingJunction(r.syllables), `vowels meet: ${r.syllables.join(' ')}`);
}

// vowels and consonants take turns (option "alternate")
assert.ok(consonantsMeet('al', 'ma'));
assert.ok(consonantsMeet('Es', 'te'));
assert.ok(consonantsMeet('mal', 'sch'.slice(0, 1) + 'u'));
assert.ok(!consonantsMeet('ma', 'la'));
assert.ok(!consonantsMeet('al', 'am'));
assert.ok(!consonantsMeet('la', 'am'));
assert.ok(alternates(['La', 'ma']));
assert.ok(alternates(['Ba', 'na', 'ne']));
assert.ok(alternates(['Tisch']), 'sch counts as one consonant unit');
assert.ok(alternates(['Schu', 'le']));
assert.ok(alternates(['Ei']), 'a vowel pair counts as one vowel unit');
assert.ok(!alternates(['Hand']), 'n and d are two consonants in a row');
assert.ok(!alternates(['Kis', 'te']));
assert.ok(!alternates(['Rol', 'ler']));
assert.ok(!alternates(['Spin', 'ne']));
assert.ok(alternates(['Mal']));

const turnsKnown = new Set(['a', 'e', 'i', 'o', 'l', 'm', 's', 'n', 't']);
for (const twoLetters of [true, false]) {
  let hitsOff = 0;
  for (let i = 0; i < 4000; i++) {
    const on = generate(turnsKnown, 4, rng, { twoLetters, alternate: true, avoidDoubled: false });
    assert.ok(alternates(on.syllables), `not alternating: ${on.syllables.join(' ')} (twoLetters=${twoLetters})`);
    const off = generate(turnsKnown, 4, rng, { twoLetters, alternate: false, avoidDoubled: false });
    if (!alternates(off.syllables)) hitsOff++;
  }
  assert.ok(hitsOff > 200, `without the option consonants do meet (${hitsOff}, twoLetters=${twoLetters})`);
}

// a round never consists of a single letter
const lonely = [new Set(['a', 'e', 'i', 'o', 'l', 'm', 's']), new Set(['a', 'o', 'l']), new Set(['a', 'ei', 'l'])];
for (const known of lonely) {
  for (const twoLetters of [true, false]) {
    for (const max of [1, 2, 3]) {
      for (let i = 0; i < 1500; i++) {
        const r = generate(known, max, rng, { twoLetters, avoidDoubled: true });
        assert.ok(r.syllables.join('').length >= 2, `single-letter round: ${r.syllables.join(' ')} (max ${max}, twoLetters ${twoLetters})`);
      }
    }
  }
}
// ...but a single-letter syllable still occurs inside longer rounds (O ma)
let singleInside = 0;
for (let i = 0; i < 3000; i++) {
  const r = generate(new Set(['a', 'e', 'i', 'o', 'l', 'm', 's']), 2, rng, { twoLetters: true, avoidDoubled: true });
  if (r.syllables.length > 1 && r.syllables.some((x) => x.length === 1)) singleInside++;
}
assert.ok(singleInside > 50, `one-letter syllables still appear inside longer rounds (${singleInside})`);


for (const [name, known, options] of [
  ['vowel combinations only', ['ei', 'au'], {}],
  ['combinations and a coda-only consonant', ['ei', 'ck', 'a'], {}],
  ['two letters, combinations and unusable onset', ['ei', 'ie', 'b'], { twoLetters: true }],
  ['one combination, all options', ['eu'], { twoLetters: true, avoidDoubled: true, alternate: true }],
  ['alternate without single vowels', ['a', 'm', 'l', 's'], { alternate: true }],
]) {
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const r = generate(new Set(known), 3, rng, { seen, ...options });
    assert.ok(r, `${name}: a round is always found`);
    assert.ok(!hasMergingJunction(r.syllables), `${name}: merging junction in ${r.syllables.join(' ')}`);
    if (options.alternate) assert.ok(alternates(r.syllables), `${name}: not alternating: ${r.syllables.join(' ')}`);
  }
}

console.log('all tests passed');
