# Prüfung der zweiten Musteretappe (0.2)

Stand: 26.10.2026. Grundlage sind der erste menschliche Spieltest und die fünf anschließenden Entscheidungen. Die eigene Fahrzeuggeschwindigkeit und die Zeitkompression bleiben erhalten. Spielbar ist weiterhin Pennsylvania mit zwei Fahrzeugen; die übrige Kampagne ist nicht fertig.

## Umgesetzt

- Nur 640×360 und 1280×720; bisherige 960-Einstellungen werden auf 1280 übernommen.
- Gemeinsame Geometrie für Darstellung und Fahrphysik: befahrbare rechte Abzweigung, zurückführende Nebenstraße, Servicehöfe, Parkbuchten und feste Servicegebäude. Straßennahe Dekoration wird gegen beide Straßen geprüft.
- Automatischer Service beim Stillstand auf der Parkbucht. Nach Verlassen des Menüs verhindert eine Sperre die sofortige Wiederöffnung. Tanken, Fahrerwechsel, Reparatur, Erholung und sicheres Speichern verwenden weiterhin ihre expliziten Regeln.
- Ruhigerer Alltagsverkehr und erkennbare Trucks. NPCs bremsen, halten Abstand, beenden Überholvorgänge und ordnen sich wieder rechts ein. Bei einem NPC-Auffahrunfall wird der Spieler nicht für den fremden Fehler beschädigt. Vier Rennteams behalten ihr höheres Überlandtempo.
- Sichtbare Polizei vor dem Auslösen, durchgängiges Polizeifahrzeug während der Verfolgung, Anhalten mit tatsächlichem Kontakt, Flucht und steigende Wahrscheinlichkeit späterer Kontrollen. Abstände und Reaktionszeit verwenden reale Sekunden. Die Streife kann die echte Abzweigung nehmen; eine auf der Hauptstraße zurückgebliebene Streife verliert den Wagen nach anhaltender Trennung.
- Rechte Karte mit eigener Position, vier Rennteams, benannten Servicehalten und unterschiedlichen Symbolen. Rechter Cockpitspiegel, fahrzeugspezifische Augenhöhe, regelmäßige MPH-Tachoteilung, lesbarere Instrumente sowie Drehzahlbänder und kleine Schaltlampe. Wiederholte Geschwindigkeitsschilder und unnötige Einblendungen reduziert; Beifahrerkommentare bleiben erhalten.
- Gesicherte Spielstände der ersten Ausgabe werden auf den neuen Halteplatz übernommen. Ressourcen, Uhr, Zufallszustand und bestehende County-Ergebnisse bleiben erhalten.

## Automatisierte Prüfung

`npm test`: **81/81 bestanden**, keine übersprungenen Tests. `npm run build`: TypeScript und Vite-Produktionsbuild bestanden.

Ein vollständiger 360-km-Controllerlauf auf der rechten Fahrbahn mit Verkehr, manueller Schaltung und zwei tatsächlich angefahrenen Servicebuchten benötigte **758,48 simulierte Fahrsekunden (12:38,48 Minuten)**. Ergebnis: zwei Servicehalte, keine Knöllchen, ein Rempler, 41,71 Liter Restkraftstoff und 94,30 % Fahrzeugzustand. Dies ist ein automatisierter Simulationslauf, kein menschlicher Spieltest. Bericht: `output/qa/tests-v02.txt`.

Bei der unabhängigen Prüfung wurden Überhol-Wechsel vor Abschluss, seitlich entfernte Knöllchen, verdeckte normale Beifahrerkommentare und ein auf der Nebenstraße festhängendes Polizeiereignis gefunden. Die Ursachen sind korrigiert und durch Regressionstests abgedeckt. Eine Dekoration auf der Ausfahrt und der Schildmast am Abzweig wurden zusätzlich anhand echter Renderbilder korrigiert.

## Browser

Chromium über Playwright CLI auf dem Windows-Arbeitsplatz:

- Durchgehende Browserfahrt vom Start zur ersten Tankstelle mit normalen Gas-, Brems-, Lenk- und Schalteingaben. Kein direktes Versetzen des Wagens und kein E-Tastendruck. Nach **106,03 echten Simulationssekunden** öffnete Sundown Gas automatisch bei 44.819,96 m, x=1,737 und Stillstand. Keine Kollision und keine Seitenfehler. `output/qa/physical-stop.json`, `output/playwright/v02-physical-service.png`.
- Start, manuelles Schalten, alle vier Ansichts-/Auflösungskombinationen, Papierkarte, Volltanken mit festem Zeitaufschlag und kleinem Erholungsbonus, Fahrerwechsel ohne Heilung, wiederholtes Speichern ohne Heilung, exaktes Fortsetzen und Weiterfahrt geprüft. `output/qa/browser-smoke-v02.json`.
- Ein Frontfahrzeug und ein tatsächlicher rückwärtiger Polizeiwagen werden in beiden Ansichten und Auflösungen jeweils genau einmal vor bzw. hinter dem Spieler gezeichnet. Zeichnen verändert den Zustand nicht. `output/qa/render-smoke-v02.json`.
- Service verlassen und Einstellungs-Checkbox über injizierte Gamepad-Ereignisse geprüft; der Einstellungsdialog hält die Welt pausiert. `output/qa/controller-smoke-v02.json`. Ein physisches Gamepad wurde damit nicht geprüft.
- Native Bildpuffer und regelmäßige 20er-MPH-Skala anhand derselben Szene geprüft. Einzelne gemessene Renderzeiten sind Stichproben, kein allgemeiner 60-FPS-Nachweis.
- Zusätzliche Bilder in beiden Auflösungen zeigen eine noch nicht ausgelöste Streife am Straßenrand, denselben Wagen später im echten Rückspiegel sowie einen Truck neben einem normalen Auto. Bei 592 m Abstand ist der Polizeiwagen in 640 klein; der frühe Beifahrerhinweis ergänzt die Sicht. Bei 137 m ist er gut erkennbar. Bericht: `output/playwright/v02-police-traffic-visual.json`.

## Windows und Auslieferung

`tools/build-windows.mjs --smoke` hat die frische Windows-Ausgabe **20261026T182449730Z-4bec4b94** erstellt und erfolgreich gestartet: Startseite, Spielstart, 640×360-Fahransicht und Screenshot bestätigt; keine Rendererfehler und kein Node-Zugriff im Spielrenderer. Eigener Spielstandordner, Sandbox und Context Isolation sind aktiv. Das geprüfte native Bild wurde zusätzlich angesehen.

`tools/package-delivery.py` hat ein ZIP mit **90 Einträgen / 118.467.955 Bytes** erstellt und alle CRCs geprüft. SHA-256: `b0799eb445286ba3d8844308872fe19e9c9f2bbc5d3ee07e82929b6689e5d883`. Die Ausgabe ist in `output/windows/latest.json` und `output/qa/delivery.json` festgehalten. Ältere Ausgaben bleiben erhalten.

## Noch zu beurteilen

Die nächste menschliche Fahrt soll vor allem Servicezufahrt, Nebenroute, Verkehr, Polizeisichtbarkeit, Cockpithöhe und Instrumente in beiden Auflösungen beurteilen. Umfangreichere Fahrzeug- und Landschaftsgrafiken, weitere Bundesstaaten, die vollständige Karriere und aufgenommene Figurensprecher sind weitere Entwicklungsarbeit. Kontinuierliches menschliches Spielen/Hören sowie physisches Gamepad und Smartphone bleiben offen.
