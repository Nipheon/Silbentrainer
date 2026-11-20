# Silbentrainer

Leseübung für Grundschulkinder im Browser. Lehrkraft oder Eltern wählen die
bekannten Buchstaben und die höchste Silbenzahl, die Walzen zeigen dazu passende
Silben.

## Starten

Die Seite lädt ES-Module und braucht deshalb einen Webserver (ein Doppelklick auf
`index.html` reicht nicht):

```
python3 -m http.server 8000
```

Dann `http://localhost:8000` öffnen. Tests: `npm test` (Node 20 oder neuer).

## Gespeicherte Einstellung

„Los geht's“ speichert die Auswahl im Browser (`localStorage`, nur lokal, keine Übertragung).
Beim nächsten Aufruf öffnet die Seite direkt die Walzen (mit Lesezeit erscheint die erste Runde erst nach START); „Buchstaben ändern“ führt
zurück zur Auswahl. Ohne spielbare gespeicherte Auswahl erscheint zuerst die Auswahlseite.

## Regeln

- Silben bestehen standardmäßig aus einem oder zwei Buchstaben (`O ma`, `la`, `al`, `ei`).
  Ohne diese Option haben Silben nie einen einzelnen Buchstaben, sind aber länger möglich, auch mit `sch`, `ch`, `ck`, `st`, `sp`, `qu` und Doppelvokalen (`Tee`, `See`, `Aal`).
- Jede Silbe hat einen Vokal; in erfundenen Silben stehen `st`, `sp`, `qu` nur am Silbenanfang und `ck` nur am Ende.
- Am Silbenübergang folgen nie zwei Vokale aufeinander (nicht `Mi il`, `Lo am`, `Le im`). Lässt eine Auswahl keine zweite Silbe zu (zum Beispiel nur `ei` und `au`), gibt es nur einsilbige Runden.
- Eine Runde besteht nie aus nur einem Buchstaben (`O ma` ja, `E` allein nein).
- Optional (Standard aus): Vokal und Konsonant wechseln sich ab, auch zwischen Silben (nicht `al ma`).
- Optional (Standard an): keine Doppelung von `b d f g k l m n p r s t z` am Silbenübergang (nicht `at te`, `am ma`, `es se`, `ak ku`). `h j v w` werden im Deutschen nicht verdoppelt.
- Eine bereits gezeigte Kombination kommt in derselben Sitzung nicht wieder.
- Alle Silben laufen durch eine Sperrliste (`src/blocklist.js`).
- Der Abstand zwischen den Silben hat drei Stufen: 1 kein Abstand, 2 halber, 3 voller Abstand (Standard).
- Lesezeit: aus, 2, 3, 5, 7 oder 10 Minuten (Standard 5). Die Zeit läuft ab dem ersten START; danach bleibt das letzte Wort stehen, und „Fertig“ zeigt, wie viele Wörter gelesen wurden.

## Lizenzen

- Code: MIT, siehe `LICENSE`.
- Schrift **Grundschrift von Christian Urff**, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/),
  Quelle: <https://urff.app/grundschrift/>, Lizenztext in `fonts/grundschrift/LICENSE.md`.
- Ersatzschrift **Andika** (SIL), SIL Open Font License 1.1, siehe `fonts/OFL.txt`.

## KI-Hinweis

Der Code wurde mit Unterstützung von KI geschrieben: Claude (Anthropic, Modell
Claude Sonnet 5.5). Der Autor hat die Ergebnisse geprüft und steuert das Projekt.
