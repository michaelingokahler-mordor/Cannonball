# Verlässliche Grundabläufe nach dem zweiten Spieltest

Der Nutzer hat die Reihenfolge bestätigt: zuerst Polizei und Verkehr samt klarer Streckenwahl stabilisieren; die filmische Eskalation mit Verstärkung, Ausbremsen, Nagelbrettern und Straßensperre folgt anschließend. Bestehende eigene Geschwindigkeit, Handschaltung, Ressourcen, Service- und Speicherregeln sowie 640×360/1280×720 bleiben Grundlage.

Die Eskalationskette ist das eigene Cannonball-Konzept des Nutzers. Test Drive II liefert die historische Referenz für den einfacheren Warn-/Verfolgungs-/Anhalteablauf, Velvet Cruise die erprobten Grundlagen für Straßenführung, Kamerabezug und gezielte Tests.

## Nachgewiesene Ursachen

- Normale Fahrten mit Seed42 und1976 reproduzieren eine dauernde Sirene nach dem Anhalten rechts bei x1,5. Die Streife bleibt25m voraus und seitlich0,32 entfernt; der erlaubte Abstand beträgt0,3. Die Arcade-Kamera blendet genau diesen Wagen aus. Ton hängt am globalen Verfolgungszustand, statt am tatsächlichen Fahrzeug.
- Fahrzeugbilder und Kollisionsbreiten stimmen nicht überein. Außerdem verwendet die Kollisionsauflösung bereits veränderte Spielerpositionen zur Schuldzuweisung weiterer Kontakte. Eine Fahrzeugkette kann den Spieler mehrfach rückwärts setzen und zuvor geprüfte Wagen erneut überlappen lassen. Die Arcade-Kamera bildet das eigene Sprite ungefähr42m voraus ab und kann dadurch einen vorderen Wagen unter dem eigenen Auto verschwinden lassen.
- Die Abzweigung ist tatsächlich12km lang parallel angelegt. Danach bleiben die Wege über weitere38km mit nahezu konstantem Abstand nebeneinander sichtbar.
- Kurven liegen in den Streckendaten; ihre sichtbare Biegung sitzt fast ausschließlich an der Horizontlinie. Die Extra-Kurven der Nebenstrecke werden in der Zeichnung bisher nicht verwendet.
- Serviceansagen prüfen Entfernung, aber nicht die Erreichbarkeit auf der gewählten Route.

## Gewählter Ansatz

Weitere Abstandskorrekturen im bestehenden Kontaktschleifen-Code würden die Kopplung erhalten. Stattdessen bekommen Verkehr und Kontakte ein eigenes Modul mit unveränderlichen Vorher-Positionen, gemeinsamen Fahrzeugmaßen und stabiler Auflösung mehrerer Fahrzeuge. Polizeifahrzeuge bleiben echte Weltobjekte; Polizeiablauf, Ton und Darstellung müssen auf dieselben Positionen zugreifen. Natürliche Fahrten und Bildfolgen ergänzen die bisherigen günstigen Einzelzustände.

Die Straße behält die komprimierte Reise. Eine kurze Gabelung ersetzt die lange Parallelzufahrt, die nicht gewählte Strecke verlässt den Blick. Eine gemeinsame Streckenbeschreibung liefert erkennbare Kurven und die dazu passenden Ansagen. Die Karte kombiniert den früheren Atlascharakter mit der aktuellen Lesbarkeit.

## Verhalten der nächsten Fassung

- Alltagsverkehr bremst, wartet, hupt kurz bei wirklicher Behinderung und überholt nur mit Platz. Fahrzeuge dürfen nicht durch den Spieler fahren. Körpermaße und Darstellung stimmen überein; Mehrfachkontakte ändern nicht nachträglich die Schuldzuweisung.
- Eine sichtbare Streife fährt regulär, eine andere steht am Straßenrand. Tempo und sichtbarer schwerer Fahrzeugschaden können einen Anhaltevorgang auslösen. Rechts anhalten führt nach tatsächlicher Anfahrt zu genau einem Knöllchen und Zeitaufschlag. Kein endloser Zustand ohne Fortschritt, keine unsichtbare Dauersirene und kein rückwärts teleportierender Polizeiwagen.
- Flucht und Grenzregel bleiben erhalten. Die größere Verfolgungseskalation wird in dieser Fassung nicht als fertig dargestellt.
- Die vier Rennteams besitzen feste, erklärbare Risikoprofile: risikofreudig, ausgewogen, vorsichtig und sparsam. Sie bremsen in Orten und unterschiedlich früh bei sichtbarer Polizei. Beobachtete Verstöße führen ebenfalls zu Knöllchen und einem echten Aufenthalt; es gibt keine pauschale Immunität. Vollständig gespielte Verfolgungsmanöver zwischen Polizei und Rivalen gehören zum späteren Chase-Ausbau.
- Die Gabelung ist wenige Sekunden vorher erkennbar, mit einem klaren Trennpunkt und Zielschildern. Die Wahl erfolgt durch Lenken. Auf der Nebenstrecke werden keine unerreichbaren Servicehalte der Hauptstraße empfohlen. Straßenkurven und Ansagen stimmen in Richtung und Ort überein.
- Die rechte Karte zeigt wieder Gelände, Fluss, eine gewundene Straße und die Nebenroute; Symbole, Namen, eigene Position und vier Teams bleiben lesbar. Ein gemeinsamer Kartenpfad positioniert Straße und Marker.

## Grenzen und spätere Arbeit

Modellspezifische Cockpits beginnen später mit Steinbach Turbo und Hohenfels690. Die Nutzerbilder dienen als Referenz für Proportionen, Materialdetails, Instrumente, Spiegel, Polizeiszenen und eine eigene Serviceansicht. Sie werden nicht in die Laufzeitgrafik kopiert.

Englisch wird als vollständige zweite Sprache geplant: Menüs, Hilfe, HUD, Servicetexte, Meldungen und Crew-Kommentare, unabhängig von MPH/KM/H. Ein Sprachwechsel darf die Fahrt nicht verändern. Systemsprachausgabe muss zur gewählten Sprache passen; aufgenommene Stimmen bleiben separat.

Prüfung und klare menschliche Testziele stehen in `docs/TESTPLAN-03.md`; die weitere Reihenfolge steht in `docs/BACKLOG.md`.
