# Prüfung der dritten Musterfassung (0.3)

Stand:26.10.2026. Ziel ist die vom Nutzer gewählte verlässliche Grundfassung. Die vom Nutzer entworfene Eskalation mit mehreren Einheiten, Ausbremsen, Nagelbrettern und Straßensperre bleibt die anschließende Stufe. Die Recherche im Originalhandbuch von Test Drive II und die tatsächlich übernommenen Erfahrungen aus Velvet Cruise stehen in `docs/TEST-DRIVE-II-RESEARCH.md`.

## Ursachen und Änderungen

Die zweite Fassung wurde nicht allein durch weitere Testzahlen bestätigt. Die menschlich beobachteten Probleme wurden durch normale Fahrverläufe reproduziert:

- Bei einem Halt rechts konnte der Polizeiwagen knapp außerhalb des seitlichen Anhaltefensters steckenbleiben; zusätzlich lag er in der Arcade-Kamera außerhalb des Bildes. Die Begegnung verwendet jetzt einen physisch erreichbaren Treffbereich mit tatsächlicher Anfahrt und kurzer Anwesenheitszeit. Sirene und Hupen stammen aus den realen nahen Fahrzeugen.
- Sichtbare Fahrzeugbreiten, Kollisionsbreiten und Kamerabezug waren verschieden. Mehrere Kontakte konnten die Schuldzuweisung und Spielerposition innerhalb desselben Bildes verändern. Eine gemeinsame Körperdefinition, unveränderliche Vorher-Positionen, kontinuierliche Kontakte und eine stabile Auflösung mehrerer Fahrzeuge beheben diese Kopplung. Ein zusätzlicher Kontaktpass berücksichtigt die nachfolgende Polizeibewegung.
- Die lange Parallelzufahrt war tatsächlich so angelegt. Sie ist durch einen kurzen Entscheidungspunkt mit klarer Trennung und Kameraausrichtung ersetzt. Sichtbare Kurven und Beifahreransagen verwenden denselben Streckenplan; die Nebenroute empfiehlt keine unerreichbaren Hauptstraßen-Services.
- Die Karte verbindet wieder Atlascharakter, Gelände, Fluss und gewundene Straße mit den lesbaren Servicezeilen und Rennteam-Markern.
- Rennteams besitzen erklärte Fahrstile, reagieren unterschiedlich früh auf sichtbare Polizei und werden bei beobachteten Verstößen angehalten. Geplante Pausen und Knöllchen führen zum kontinuierlichen Rechtsheranfahren. Drei Verstöße beenden ihre Teilnahme. Angekommene Teams bleiben an getrennten begrenzten Positionen; sie können spätere Spielstände nicht mehr ungültig machen.

## Automatisiert

Frische Root-Prüfung nach der direkten Übernahme der vorausschauenden Spurwechselprüfung aus Velvet Cruise: **136/136 Tests bestanden**, keine übersprungenen Tests. TypeScript und Vite-Produktionsbuild erfolgreich. Bericht:`output/qa/tests-v03.txt`. Die übernommenen Regeln werden zusätzlich in `tests/velvet-driving.test.ts` geprüft.

Der vollständige 360-km-Controllerlauf benötigt **786,78 Fahrsekunden (13:06,78 Minuten)** mit zwei physisch angefahrenen Servicehalten. Ergebnis: kein Rempler, keine Knöllchen,42,67l Restkraftstoff und96,85% Zustand. Ein weiterer40-Minuten-Lauf prüft Rivalen nach der Zielankunft und sicheres Speichern vor dem Kauf einer Leistung. Diese Läufe sind automatisierte Simulationen, keine menschliche Abnahme.

Eine unabhängige Prüfung fand nach ersten grünen Tests noch vier Probleme: ungültige Spielstände nach Rivalenankunft, breite Schulterhalte ohne Auflösung, durch Verkehr blockierte engere Schulterhalte und eine unendlich vorausfahrende Streife. Diese wurden vor Auslieferung korrigiert. Die erneute unabhängige Prüfung bestätigte:

- 21 natürliche Haltevorgänge mit sieben Seeds und drei seitlichen Haltepositionen: genau ein Knöllchen, derselbe Wagen60m dahinter, Sirene aus.
- Zwei vollständige legale langsame Fahrten mit50 bzw.80km/h, allen fünf tatsächlich angefahrenen Servicestellen und Zielankunft.
- 20 erfolgreiche Speicherprüfungen vor/nach Servicekauf sowie zehn exakt wiederhergestellte Vorher-Spielstände.

Belege:`output/qa/review-v03-pullovers.json`, `review-v03-natural-0-50.json`, `review-v03-natural-42-80.json`. Frühere Fehlzustände bleiben getrennt als historische Reproduktionen erhalten.

## Darstellung und Browser

Native Bilder in beiden Auflösungen und Perspektiven wurden für Kurven, Gabelung, gewählte Nebenroute, nahe Vorderfahrzeuge und tatsächliche Polizeihalte aufgenommen. Die Hausgrundfläche am Abzweig wurde anhand einer echten Aufnahme zusätzlich korrigiert. Zeichnen bleibt zustandsneutral; unsichtbar kleine Fahrzeuge zählen nicht als Sichtnachweis.

Start/Schalten, vier Ansichts-/Auflösungskombinationen, Karte, Versorgung, Fahrerwechsel, Speichern ohne Heilung und exaktes Laden sind im Browser geprüft. Der Front-/Spiegeltest verwendet sichtbar nahe reale Weltobjekte. Berichte:`output/qa/browser-smoke-v03.json`, `render-smoke-v03.json`.

Die fünf Testfahrten sind absichtlich vorbereitete Startzustände. Die folgende Bewegung verwendet den normalen Eingabepfad; sie ist keine vorgetäuschte vollständig zurückgelegte Fahrt. Ein dauerhaftes Banner kennzeichnet den Test, der normale Speicher ist gesperrt. Ausführliche Ziele und erwartete Ergebnisse:`docs/TESTPLAN-03.md`.

Die abschließende Browserprüfung über normale Gas-/Brems-/Lenk-/Schalteingaben nach der Velvet-Cruise-Übernahme bestand ohne Seitenfehler:

- Polizeistart: nach8,68 Fahrsekunden genau ein Knöllchen; derselbe Wagen60m dahinter, Sirene0.
- Gabelung: nach24,35 Fahrsekunden tatsächlich auf der Nebenstrecke, ohne Routenauswahltaste.
- Service: nach18,92 Fahrsekunden automatisch Sundown Gas geöffnet; Speichern im Test deaktiviert.
- Verkehr:25 Sekunden Stillstand, Anfahren und Bremsen; keine fehlgeschlagene Fahrt. Alle fünf Startbuttons und Testbanner geprüft, bestehender Normalspielstand bytegleich erhalten.

Bericht:`output/qa/browser-foundation-v03.json`. Der injizierte Controller-Test bestand ebenfalls (Service verlassen, Checkbox bedienen, Welt pausiert); Bericht:`output/qa/controller-smoke-v03.json`.

Die native Windows-Ausgabe **20261026T204741407Z-64a6515d** startet erfolgreich: Startseite, Spielstart,640×360-Bildpuffer, keine Rendererfehler und kein Node-Zugriff im Spielrenderer. Das native Bild wurde angesehen. Das portable ZIP enthält90Einträge/118.474.359Bytes; alle CRCs bestanden, SHA-256:`0dd57963cc4a2f61d6b6b95013a85feff4357322a8d3707885055a8b9fb35c8b`. `output/windows/latest.json` und `output/qa/delivery.json` benennen diese Ausgabe. Die bisherigen Pakete bleiben erhalten.

## Nächste menschliche Abnahme

Zuerst die Testfahrten **Polizei**, **Verkehr** und **Abzweigung** beurteilen. Erst dann Karte/Kurven/Service und eine längere normale Fahrt. Klang und Fahrgefühl müssen menschlich beurteilt werden. Ein injizierter Gamepad-Test ersetzt keine Prüfung mit einem physischen Gerät. Individuelle Cockpits, zusätzliche Fahrzeug-/Landschaftsdetails und vollständiges Deutsch/Englisch sind im Backlog; weitere Staaten und Karriere folgen nach der Musteretappe.
