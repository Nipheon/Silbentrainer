# Silbentrainer

Leseübung für Grundschulkinder im Browser. Lehrkraft oder Eltern wählen die
bekannten Buchstaben und die höchste Silbenzahl, die Walzen zeigen dazu passende
Silben und, wenn möglich, echte Wörter.

## Starten

Die Seite lädt ES-Module und braucht deshalb einen Webserver (ein Doppelklick auf
`index.html` reicht nicht):

```
python3 -m http.server 8000
```

Dann `http://localhost:8000` öffnen. Tests: `npm test` (Node 20 oder neuer).

## Gespeicherte Einstellung

„Los geht's“ speichert die Auswahl im Browser (`localStorage`, nur lokal, keine Übertragung).
Beim nächsten Aufruf startet die Seite direkt mit den Walzen; „Buchstaben ändern“ führt
zurück zur Auswahl. Ohne spielbare gespeicherte Auswahl erscheint zuerst die Auswahlseite.

## Regeln

- Silben bestehen standardmäßig aus einem oder zwei Buchstaben (`O ma`, `la`, `al`, `ei`).
  Ohne diese Option haben Silben nie einen einzelnen Buchstaben, sind aber länger möglich, auch mit `sch`, `ch`, `ck`, `st`, `sp`, `qu` und Doppelvokalen (`Tee`, `See`, `Aal`).
- Jede Silbe hat einen Vokal; in erfundenen Silben stehen `st`, `sp`, `qu` nur am Silbenanfang und `ck` nur am Ende. Echte Wörter folgen ihrer üblichen Trennung (`Zu·cker`, `E·cke`).
- Am Silbenübergang folgen nie zwei Vokale aufeinander (nicht `Mi il`, `Lo am`, `Le im`). Lässt eine Auswahl keine zweite Silbe zu (zum Beispiel nur `ei` und `au`), gibt es nur einsilbige Runden.
- Eine Runde besteht nie aus nur einem Buchstaben (`O ma` ja, `E` allein nein).
- Optional (Standard aus): Vokal und Konsonant wechseln sich ab, auch zwischen Silben (nicht `al ma`) und in echten Wörtern (nicht `Kis·te`, `Hand`).
- Optional (Standard an): keine Doppelung von `b d f g k l m n p r s t z` am Silbenübergang (nicht `at te`, `am ma`, `es se`, `ak ku`); gilt auch für echte Wörter wie `Rol·ler`. `h j v w` werden im Deutschen nicht verdoppelt.
- Eine bereits gezeigte Kombination kommt in derselben Sitzung nicht wieder.
- Erfundene Silben laufen durch eine Sperrliste (`src/blocklist.js`).
- Echte Wörter werden bevorzugt: Gibt es zur Auswahl ein passendes, noch nicht gezeigtes Wort, besteht eine Runde in drei von vier Fällen daraus (`realRatio` in `src/generate.js`).
- Der Abstand zwischen den Silben hat drei Stufen: 1 kein Abstand, 2 halber, 3 voller Abstand (Standard).

## Wörterliste

`data/words.json` enthält etwa 1500 echte Wörter mit Sprechsilben (`Ba·na·ne`, `O·ma`):
155 von Hand geschriebene (`scripts/handwritten-words.json`, sie haben Vorrang) und
die 3000 häufigsten Wörter des deutschen Wiktionary, soweit sie kindgeeignet sind.
Beim Bauen entfallen:

- Wörter aus `scripts/word-exclusions.txt` (Gewalt, Sex, Schimpfwörter, Alkohol und Drogen, Militär, Politik, Religion, Namen, englische Wörter), von Hand gepflegt und nach einer Durchsicht durch drei unabhängige Prüfer ergänzt.
- Nominalisierte Formen (`Jetzt`, `Viel`, `Aus`: großgeschrieben, obwohl es das kleingeschriebene Wort gibt) und Partizipien (`ge·macht`). Gute Nomen mit Zwilling (`Weg`, `Licht`, `Rot`) stehen in einer Rettungsliste im Skript.
- Wörter unter drei Buchstaben und Wörter mit zwei aufeinanderfolgenden Vokalen am Silbenübergang. Die Handliste enthält dagegen auch kurze Wörter wie `ja`, `am`, `Ei`.

Neu bauen (Eingaben liegen nicht im Repo):

```
node scripts/build-words.mjs <de-extract.jsonl.gz> <de_50k.txt> data/words.json
```

- `de-extract.jsonl.gz`: Wiktionary-Auszug von <https://kaikki.org/dictionary/rawdata.html> (Deutsch).
- `de_50k.txt`: Worthäufigkeitsliste aus <https://github.com/hermitdave/FrequencyWords> (nur zum Auswählen häufiger Wörter benutzt, nicht weitergegeben).

## Lizenzen

- Code: MIT, siehe `LICENSE` (ausgenommen `data/words.json`, siehe unten).
- Schrift **Grundschrift von Christian Urff**, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/),
  Quelle: <https://urff.app/grundschrift/>, Lizenztext in `fonts/grundschrift/LICENSE.md`.
- Ersatzschrift **Andika** (SIL), SIL Open Font License 1.1, siehe `fonts/OFL.txt`.
- Wörterliste `data/words.json`: enthält Wörter und Silbentrennungen aus dem [deutschen Wiktionary](https://de.wiktionary.org),
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), siehe `data/LICENSE.md`.

## KI-Hinweis

Der Code wurde mit Unterstützung von KI geschrieben: Claude (Anthropic, Modell
Claude Sonnet 5.5). Der Autor hat die Ergebnisse geprüft und steuert das Projekt.
