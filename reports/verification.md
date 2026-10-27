# Pennsylvania prototype verification

Stand:26.10.2026. Geprüft wird die erste Musteretappe, keine vollständige Coast-to-Coast-Kampagne.

## Automatisierte Prüfungen

- `npm test`: **53/53 bestanden**. County-Seeds, Getriebe, Servicekosten, sichere Snapshots, beschädigte Daten, Rollenwechsel, Polizei, Grenzflucht, Verkehr und Kommentare sind abgedeckt.
- `npm run build`: TypeScript-Prüfung und Vite-Produktionsbuild bestanden.
- Vollständiger deterministischer360-km-Lauf mit Verkehr: **875,68 simulierte Fahrsekunden =14:35,68 Minuten**. Zwei Servicehalte, keine Verstöße, ein Rempler,49,79l Restkraftstoff. Der Testfahrer fährt auf der rechten Fahrbahn und verwendet normale Eingaben/Serviceaktionen. Dies ist ein automatisierter Controllerlauf, kein menschlicher Spieltest.
- Ein stillstehender neuer Spieler wird in den ersten zehn Sekunden nicht von startenden Rivalen gerammt.

## Browser

Chromium über Playwright CLI auf dem Windows-Arbeitsplatz. Prüfskripte:`tools/browser-*.js`.

- Reale UI:Start, manuelles Beschleunigen/Schalten, sechs Ansichts-/Auflösungskombinationen, Karte, Service, Speichern ohne Heilung, exaktes Fortsetzen nach Reload und Verlassen des Halts.
- Native Buffer:640×360,960×540,1280×720. Ansichtswechsel verändern Reise, Countys und RNG nicht.
- Render-Fall mit einem Frontfahrzeug und einem rückwärtigen Polizeiwagen:genau ein Front- und ein Spiegelobjekt in allen sechs Kombinationen, Zustand unverändert.
- Gamepad-Eingaben über den UI-Ereignispfad injiziert:Service verlassen, Checkbox aktivieren, Einstellungen bleiben pausiert. Beide unabhängig gefundenen Gamepad-Fehler wurden vor dem Fix reproduziert und danach nachgeprüft.
- Keine JavaScript-Seitenfehler. Schriften lokal geladen; keine externen Font-Anfragen.

Einzelne Renderzeit-Stichproben lagen ungefähr zwischen2,4 und8,4ms. Dies ist kein vollständiger60-FPS-Leistungsnachweis; Frameabstände, lange Fahrten und andere Geräte benötigen weitere Messungen.

## Native Windows-Ausgabe

- Eigene Electron-Anwendung, frischer Cannonball-Inhalt und getrenntes Datenverzeichnis.
- Velvet-Cruise-Laufzeit unverändert kopiert; alte Anwendung, Tesana-Ressourcen und Spielstände ausgeschlossen.
- Nativer Start unter Windows x64/Electron33.4.11:Startseite erkannt, Start betätigt, Fahransicht640×360 gezeichnet, Screenshot erfasst.
- Keine Rendererfehler und kein Node-Zugriff aus dem Spielrenderer. Context Isolation/Sandbox aktiv, externe Navigation blockiert.
- Weitere Builds erhalten vorhandene Ausgaben und schreiben eine neue Ausgabe plus`output/windows/latest.json`.
- ZIP-Export mit vollständiger CRC-Prüfung und SHA-256.

Maschinenlesbare Berichte/Screenshots:`output/qa/` und`output/playwright/`. Aktuelle Windows-Ausgabe mit Manifest:`output/windows/latest.json`.

## Abnahmegrenzen

Kontinuierliches menschliches Spielen/Hören, Feintuning von Schwierigkeit und Fahrgefühl sowie physisches Gamepad und Smartphone bleiben offen. Die Browser-Systemstimme ersetzt keine aufgenommenen Figurensprecher. Weitere Staaten und die vollständige Familienkarriere gehören nicht zu dieser ersten Auslieferung.
