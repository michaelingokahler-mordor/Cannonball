# Polizeiverhalten in Test Drive II: The Duel

Recherche am26.10.2026 anhand des [eingescannten Accolade-Originalhandbuchs](https://mirrors.apple2.org.za/ftp.apple.asimov.net/documentation/games/misc/TestDriveII-UserManual.pdf#page=5), insbesondere „Radar Detector“, „Police“ und „Rear View Mirror“. Das Handbuch beschreibt die Spielregeln; genaue Erkennungsradien und interne KI-Algorithmen sind damit nicht belegt.

Der Radarwarner blinkt und piept vor einer nahen Kontrolle. Die Polizei verfolgt den Spieler, bis er entkommt oder sie ihn überholt. Nach dem Überholen muss der Spieler anhalten und erhält ein Knöllchen; die Rennuhr läuft währenddessen weiter. Zusätzlich beschreibt das Handbuch einen geparkten Wagen mit einem Beamten, der am Straßenrand zum Anhalten auffordert. Anhalten oder Weiterfahren sind möglich; Einholen führt zum Knöllchen. Eine Kollision mit Polizeiwagen oder Beamtem beendet das Spiel. Der Spiegel hilft, Verfolger zu beobachten. Eine Fortschrittsanzeige kann den verfolgenden Polizeiwagen zusätzlich markieren.

## Übertragung auf Cannonball

- Sichtbare Warnung und ein tatsächliches Fahrzeug gehen dem Anhalten voraus.
- Freiwilliges Anhalten und gelungene Flucht bleiben verständliche Alternativen. Überholen und Ausbremsen gehören zur späteren erweiterten Verfolgung.
- Unser fester Zeitaufschlag folgt der bereits gewählten Cannonball-Regel und vereinfacht den Aufenthalt; er ist keine Behauptung über die genaue damalige Zeitabrechnung.
- Beschädigte Rücklichter bzw. sichtbarer Fahrzeugschaden als Anlass, Verstärkung aus Seitenstraßen, zunehmende Eskalation, Nagelbretter und die sichere End-Straßensperre sind Cannonball-Entscheidungen. Die Eskalationsidee stammt vom Nutzer.
- Vollständige Gleichbehandlung der vier Rennteams ist eine Anforderung an Cannonball; das Handbuch allein belegt diesen Umfang bei Test Drive II nicht.

## Erfahrungen aus Velvet Cruise

Aktuell im lokalen Quellstand geprüft: `src/game/track.ts` und `src/game/race.ts` besitzen einen kurzen Gabelungsablauf mit Start, Nase/Entscheidung und Ende. Dieselbe Teilungsfunktion bestimmt die Straßenpositionen; die Kamera richtet sich weich auf den gewählten Weg aus. `PROP_GAP` hält Dekoration von der Straße fern.

Die Plus-Grafik trennt native Bildauflösung und Sprite-Dichte von physikalischen Weltmaßen. Für Cannonball bedeutet das:640/1280 dürfen keine anderen Kollisionskörper, Strecken oder KI-Ergebnisse erzeugen. Aus `tools/qa/plus-native-browser.cjs` und `check-road-effects.mjs` übernehmen wir das Prinzip gezielter Testszenen mit echten Renderbildern, Mehrbild-Manövern und getrennten Test-/Fortschrittsdaten. Ein vorhandener Screenshot gilt nicht als Nachweis für flüssiges Fahrgefühl.

Nach der ausdrücklichen Vorgabe, auch Fahrphysik und Kollisionen aus Velvet Cruise zu verwenden, wurde `Race.yieldSafe` direkt als `src/driving.ts` übernommen und für Meter/KM/H mit achtfacher Reisekompression angepasst: reservierter ganzer Spurwechselkorridor,1,8 Sekunden Vorschau, bewegter rückwärtiger Verkehr und die Unterscheidung zwischen Ausweichen und Einscheren zum Spieler. Die Verkehrssteuerung verwendet diese Prüfung tatsächlich. Weitere gemeinsame Grundlagen sind die von der Kamera getrennte reale Spielerposition (`playerZ`), einheitliche Fahrzeug-Halbbreiten und Bremsen vor dem Auffahren. Cannonballs bidirektionaler Verkehr und dauerhafte Schäden verwenden zusätzlich die geprüfte kontinuierliche Kontaktauflösung; seine bereits bestätigten Fahrgeschwindigkeiten bleiben erhalten.

Der späteren Grafikaufwertung dienen neu ausgearbeitete Formen, Materialien, Fahrzeugansichten und Landschaften; bloßes Vergrößern der vorhandenen Bilder erfüllt dieses Ziel nicht. Velvet Cruise bleibt unverändert und wird nicht als fremde Anwendung in Cannonball eingebaut.
