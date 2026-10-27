# Cannonball — Coast to Coast

Spielbare Pennsylvania-Musteretappe **0.3** in der 70er-Ära. Zwei Personen, ein Wagen und 360 virtuelle Kilometer bis Ohio. Die übrigen zwölf Bundesstaaten sind als Kampagnenroute sichtbar und noch nicht spielbar.

## Starten

Voraussetzung für den Quellstand: Node.js 24 und npm.

```powershell
npm ci
npm run dev
```

Danach die angezeigte lokale Adresse im Browser öffnen. Der Entwicklungsserver bindet nur an `127.0.0.1`.

```powershell
npm test
npm run check
npm run build
npm run preview
```

Der fertige Web-Build liegt in `dist/`. Die enthaltenen Schriften werden lokal geladen. Es gibt keine Konto-, Analyse- oder Cloud-Verbindung.

## Windows

```powershell
npm run build:windows
```

Der Builder nutzt ausschließlich den vorhandenen Electron-Laufzeitkern unter `D:\Velvet Cruise\WinExe`. Die alte Anwendung, ihre Ressourcen und Spielstände werden nicht übernommen oder geändert. Der neue Startpunkt ist `Cannonball.exe` in dem vom Builder gemeldeten Verzeichnis. `output/windows/latest.json` nennt die aktuelle Ausgabe. Eine vorhandene Ausgabe bleibt beim erneuten Bauen erhalten.

Die Anwendung verwendet ein eigenes Electron-Datenverzeichnis `Cannonball-Coast-to-Coast`. Der Dateibrowser-Build und die Windows-App haben getrennte lokale Spielstände.

## Steuerung

| Eingabe | Funktion |
|---|---|
| W / Pfeil hoch | Gas |
| S / Pfeil runter / Leertaste | Bremse |
| A / D oder Pfeile links / rechts | Lenken |
| Q / R | Runter- / hochschalten |
| E | Optional bestätigen, wenn man bereits auf dem Halteplatz steht |
| C | Cockpit / Arcade wechseln |
| M | Papierkarte einblenden |
| P / Escape | Pause |

Gamepad: linker Stick lenkt, RT/LT geben Gas und bremsen, LB/RB schalten. A bestätigt Menüs. D-Pad bewegt den Menüfokus; der linke Stick ändert einen fokussierten Auswahlwert. Start öffnet beziehungsweise schließt die Pause.

Der Steinbach Turbo besitzt eine verpflichtende Viergang-Handschaltung mit automatischer Kupplung. Der Hohenfels 690 fährt mit Dreigangautomatik. Die Spielnamen und Fahrzeugzeichnungen sind eigenständige Entwicklungsentwürfe.

## Die Fahrt

- Sechs aus echten und fiktiven Regionen zusammengesetzte Countys. Ein Seed legt pro County null oder ein Polizeiereignis fest. Laden und Streckenwechsel würfeln nichts neu aus.
- Vier KI-Rennteams und ruhigerer 70er-Alltagsverkehr mit Trucks fahren als echte Weltobjekte. NPCs halten Abstand, bremsen, können kurz hupen, überholen und ordnen sich wieder rechts ein. Gemeinsame Körpermaße und kontinuierliche Kontaktprüfung verhindern Durchfahren bei Spurwechseln; die Arcade-Kamera verwendet dieselbe Spielerposition wie die Physik. Der Rückspiegel zeigt dieselbe Welt hinter dem Wagen.
- Eine ausgeschilderte Nebenroute kostet zusätzliche Strecke, hat schlechteren Belag und umgeht den Kontrollabschnitt der Hauptstraße. Am Abzweig tatsächlich nach rechts lenken; die Straßen führen später wieder zusammen.
- Kontrollen und fahrende Streifen sind vor dem Auslösen sichtbar. Tempo oder schwerer Fahrzeugschaden können einen Halt auslösen. Bei einer Verfolgung kann man entkommen oder rechts anhalten und auf die herankommende Polizei warten. Die Sirene gehört zum tatsächlichen nahen Wagen. Erfolgreiche Fluchten erhöhen die Wahrscheinlichkeit kommender County-Kontrollen, ohne neu zu würfeln.
- Drei bestätigte Verstöße beenden den Versuch. Die Staatsgrenze nach Ohio beendet eine noch laufende Verfolgung. Diese Grenzregel ist eine bewusste Arcade-Vereinfachung.
- Kraftstoff, Reifen/Mechanik und beide Müdigkeitswerte bleiben während der Etappe erhalten.
- Alle zwölf Figuren sind wählbar. Ihre rollenspezifischen Eigenschaften sind unabhängig vom Geschlecht.

Fünf Fahrzeugfamilien mit zehn Modellen sind im Archiv dokumentiert. In dieser Musteretappe sind zwei Wagen fahrbar. Ein Pennsylvania-Abschluss gilt **nicht** als vollständiger Coast-to-Coast-Abschluss und erzeugt deshalb keine vorgetäuschte Familienfreischaltung.

Die Rennteams haben feste Fahrstile: Red Arrow fährt risikofreudig, Midnight Express ausgewogen, Long Shot vorsichtig und Blue Streak sparsam. Sie bremsen in Orten; vorsichtige Teams reagieren früher auf sichtbare Polizei. Beobachtete Verstöße kosten auch sie acht virtuelle Minuten. Nach drei Knöllchen scheidet ein Team aus. Das Roadbook in der Pause zeigt Fahrstile und Strafzähler. Vollständige Polizei-Verfolgungen zwischen KI-Teams und mehreren Einheiten folgen im späteren Chase-Ausbau.

## Gezielter nächster Test

Auf der Startseite **„Gezielte Testfahrten“** aufklappen: Verkehr, Polizei, Abzweigung, Kurven oder Service. Gewählter Wagen und Crew werden übernommen. Die vorgegebenen Startpositionen sind ausdrücklich Testaufbauten; danach fährt man mit der normalen Steuerung. Ein dauerhaftes Testbanner kennzeichnet die Fahrt, und Speichern ist gesperrt. Ein vorhandener normaler Spielstand bleibt erhalten.

Zuerst **Polizei** prüfen: an der sichtbaren Kontrolle zu schnell vorbeifahren, anschließend rechts anhalten. Genau ein Knöllchen und das Ende der Sirene erwarten. Danach **Verkehr** mit Stillstand/Bremsen und **Abzweigung** in beide Richtungen prüfen. Die vollständigen Ziele und erwarteten Ergebnisse stehen in [docs/TESTPLAN-03.md](docs/TESTPLAN-03.md).

## Service und Spielstände

Rechts auf den befestigten Hof fahren und auf der markierten Parkbucht vollständig anhalten. Das Servicemenü öffnet sich automatisch. Gebäude sind feste Hindernisse; eine aktive Verfolgung verhindert den sicheren Halt. Nach dem Weiterfahren muss man die Parkbucht verlassen, bevor sie erneut auslösen kann.

| Leistung | Fester virtueller Zeitaufschlag | Wirkung |
|---|---:|---|
| Volltanken | 7 Minuten | Tank voll, kleine Erholung |
| Werkstatt | 18 Minuten, mit Mechaniker kürzer | Mechanik/Reifen verbessern, mittlere Erholung |
| Diner | 35 Minuten | Deutliche Erholung beider Personen |
| Truckstop komplett | 45 Minuten, mit Mechaniker kürzer | Tanken, reparieren und erholen |

Die tatsächliche Aufenthaltsdauer im Menü zählt nicht. Jede Leistung wird pro Halt nur einmal verbucht. Fahrerwechsel und Speichern erzeugen keine zusätzliche Erholung. Speichern funktioniert ausschließlich am sicheren Servicehalt; beim Laden werden Uhr, Fahrzeug, Crew, Verkehr, KI und County-Pläne zusammen wiederhergestellt.

Browser-Schlüssel: `cannonball.pa.save.v1` und `cannonball.pa.settings.v1`. Bestehende Service-Spielstände werden in Format 2 übernommen und auf den zugehörigen neuen Halteplatz gesetzt; Ressourcen, Rennzeit und County-Ergebnisse bleiben erhalten. Einstellungen sind unabhängig vom Reisestand speicherbar. Ein blockierter oder voller Browser-Speicher wird als Fehler gemeldet; die Fahrt bleibt bedienbar.

## Darstellung und Ton

Native Auflösungen: **640×360 und 1280×720**. Cockpit und Arcade verwenden dieselbe Simulation. Die Cockpit-Augenhöhe ist fahrzeugspezifisch; die Spiegel stehen rechts. Die optionale Papierkarte rechts kombiniert Gelände, Fluss und gewundene Straße mit lesbaren Servicezeilen, eigener Position und vier KI-Teams. Eine kurze Gabelung ersetzt die lange Parallelzufahrt. Erkennbare Kurven und Ansagen stammen aus demselben Streckenplan. Der MPH-Tacho verwendet regelmäßige 20er-Schritte. Drehzahlbänder und eine kleine Schaltlampe helfen beim Handschalten.

Motor, Wind und Sirene entstehen prozedural. Optionale Crew-Sprachausgabe verwendet die verfügbare deutsche Systemstimme des Browsers; es sind keine aufgenommenen Schauspielerstimmen. Textkommentare funktionieren unabhängig davon.

## Grenzen und weitere Arbeit

Dies ist die dritte Fassung der spielbaren Musteretappe (0.3). Die vom Nutzer entworfene filmische Eskalation mit Verstärkung, Ausbremsen, Nagelbrettern und Straßensperre folgt nach Abnahme der Grundabläufe. Modellbezogene Cockpits, der größere Grafikpass, eine vollständige Deutsch/Englisch-Umschaltung, weitere Staaten und Karriere stehen in [docs/BACKLOG.md](docs/BACKLOG.md). Fahrgefühl, Schwierigkeit, Erholung und Serviceabstände brauchen weitere menschliche Spieltests. Smartphone- und physische Gamepad-Prüfung stehen aus.

Fahrzeug-Ressourcenwerte sind Balancingwerte. Zusatzkraftstoff gehört zum Spielumbau; die historische Großtank-Geschichte betraf insbesondere den präparierten PRDA-Sportvan und ist keine allgemeine Serieneigenschaft von Wohnmobilen.

Die aktuelle Prüfung steht in `reports/playtest-03.md`; `reports/playtest-02.md` und `reports/verification.md` dokumentieren die vorherigen Fassungen. Die Recherche zu Test Drive II und die konkret übernommenen Erfahrungen aus Velvet Cruise stehen in `docs/TEST-DRIVE-II-RESEARCH.md`.
