# Licence of data/words.json

`words.json` contains word forms and syllable divisions taken from the German Wiktionary
(<https://de.wiktionary.org>, content by Wiktionary contributors), selected and adapted with
`scripts/build-words.mjs`, plus a hand-written list of words (`scripts/handwritten-words.json`).

The file is licensed under **Creative Commons Attribution-ShareAlike 4.0 International**
(CC BY-SA 4.0): <https://creativecommons.org/licenses/by-sa/4.0/>.

Word selection used frequency ranks from the FrequencyWords list by Hermit Dave
(<https://github.com/hermitdave/FrequencyWords>, built from OpenSubtitles); no frequency data is included in this file.

Changes: filtered by word frequency and for child suitability, syllable divisions adapted to
reading syllables (a single leading vowel is split off: `Oma` becomes `O·ma`).

The source code of the project stays under the MIT licence (`../LICENSE`); the share-alike
condition applies to this data file and adaptations of it, not to the code that reads it.
