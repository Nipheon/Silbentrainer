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

- Silben bestehen standardmäßig aus genau zwei Buchstaben. Ohne diese Option sind
  längere Silben möglich, auch mit `sch`, `ch`, `ck`, `st`, `sp`, `qu` und Doppelvokalen (`Tee`, `See`, `Aal`).
- Jede Silbe hat einen Vokal; `st`, `sp`, `qu` nur am Silbenanfang, `ck` nur am Ende.
- Am Silbenübergang entstehen kein `ei`, `ai`, `au`, `eu`, `äu`, `ie`, `aa`, `ee` und `oo`.
- Optional (Standard an): keine Doppelung von `l`, `m`, `n`, `p`, `t` am Silbenübergang (nicht `at te`, `am ma`); gilt auch für echte Wörter wie `Rol·ler`.
- Eine bereits gezeigte Kombination kommt in derselben Sitzung nicht wieder.
- Erfundene Silben laufen durch eine Sperrliste (`src/blocklist.js`).
- Echte Wörter stehen in `data/words.json`, von Hand mit Sprechsilben geschrieben.

## Lizenzen

- Code: MIT, siehe `LICENSE`.
- Schrift **Grundschrift von Christian Urff**, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/),
  Quelle: <https://urff.app/grundschrift/>, Lizenztext in `fonts/grundschrift/LICENSE.md`.
- Ersatzschrift **Andika** (SIL), SIL Open Font License 1.1, siehe `fonts/OFL.txt`.
