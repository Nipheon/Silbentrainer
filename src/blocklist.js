const BLOCKED = [
  'hure', 'nutte', 'fotze', 'votze', 'möse', 'moese', 'muschi', 'fick', 'fuck', 'wichs',
  'anus', 'anal', 'kack', 'kotz', 'scheis', 'pisse', 'pimmel', 'penis', 'arsch', 'titte',
  'porno', 'geil', 'nazi', 'hitler', 'neger', 'nigger', 'spast', 'mongo',
];

export function isBlocked(syllables) {
  const text = syllables.join('').toLowerCase();
  return BLOCKED.some((word) => text.includes(word));
}
