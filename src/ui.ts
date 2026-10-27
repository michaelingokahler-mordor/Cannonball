import { CREW, ROUTE_STATES, SERVICES, STAGE_LENGTH, VEHICLES, getCrew, getVehicle } from './data.ts';
import { isServiceApron, serviceAtParking, serviceOnApproach } from './layout.ts';
import type { RenderStats, RunState, ServiceAction, ServiceKind, TestScenarioId, UiActions, ViewSettings } from './model.ts';
import { TEST_SCENARIOS } from './test-scenarios.ts';
import { rivalPolicy } from './traffic.ts';

const $ = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const append = (parent: HTMLElement, ...children: (Node | string)[]): HTMLElement => { parent.append(...children); return parent; };
const label = (text: string): HTMLElement => $('span', 'eyebrow', text);
const button = (text: string, className: string, action: () => void): HTMLButtonElement => {
  const element = $('button', className, text); element.type = 'button'; element.addEventListener('click', action); return element;
};
const setText = (element: HTMLElement, value: string): void => { if (element.textContent !== value) element.textContent = value; };
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  return `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
};
const serviceNames: Record<ServiceKind, string> = { fuel: 'Tankstelle', garage: 'Werkstatt', diner: 'Diner', truckstop: 'Truckstop' };

export class GameUI {
  readonly canvas: HTMLCanvasElement;
  private readonly root: HTMLElement;
  private readonly actions: UiActions;
  private readonly home = $('main', 'roadbook-home');
  private readonly play = $('main', 'play-area');
  private readonly dialog = $('dialog', 'road-dialog');
  private readonly toast = $('div', 'toast');
  private readonly panels = new Map<string, HTMLElement>();
  private readonly carButtons = new Map<string, HTMLButtonElement>();
  private readonly crewSelects: HTMLSelectElement[] = [];
  private readonly crewDetails: HTMLElement[] = [];
  private readonly serviceButtons = new Map<ServiceAction, HTMLButtonElement>();
  private readonly serviceTimes = new Map<ServiceAction, HTMLElement>();
  private readonly continueButtons: HTMLButtonElement[] = [];
  private readonly settingsControls = new Map<keyof ViewSettings, HTMLSelectElement | HTMLInputElement>();
  private readonly stageReadout = $('span', 'stage-readout');
  private readonly testBanner = $('div', 'test-scenario-banner');
  private readonly stopPrompt = $('span', 'service-context');
  private readonly stopName = $('span', 'stop-name');
  private readonly stopButton: HTMLButtonElement;
  private readonly viewButton: HTMLButtonElement;
  private readonly mapButton: HTMLButtonElement;
  private readonly serviceTitle = $('h2');
  private readonly serviceSubtitle = $('p', 'dialog-intro');
  private readonly serviceStats = $('div', 'service-stats');
  private readonly serviceStatValues: HTMLElement[] = [];
  private readonly saveNotice = $('p', 'muted service-save-note');
  private readonly saveButton: HTMLButtonElement;
  private readonly resultTitle = $('h2');
  private readonly resultIntro = $('p', 'dialog-intro');
  private readonly resultStats = $('div', 'result-stats');
  private readonly resultValues: HTMLElement[] = [];
  private readonly journeyViews: { totals: HTMLElement; teams:HTMLElement; list: HTMLOListElement; signature: string }[] = [];
  private state: RunState | null = null;
  private settings: ViewSettings = { view: 'arcade', resolution: '640x360', map: false, units: 'kmh', sound: true, speech: false };
  private vehicleId = 'steinbach';
  private crewIds: [string, string] = ['jack', 'rose'];
  private lastStatus: RunState['status'] | null = null;
  private visiblePanel = '';
  private overridePanel: 'settings' | 'help' | null = null;
  private toastTimer = 0;
  private savedAvailable = false;
  private testScenarioLabel:string|null=null;

  constructor(root: HTMLElement, actions: UiActions) {
    this.root = root;
    this.actions = actions;
    this.vehicleId = VEHICLES.find(vehicle => vehicle.id === 'steinbach')?.id ?? VEHICLES.find(vehicle => vehicle.prototype)!.id;
    this.crewIds = [CREW.find(crew => crew.id === 'jack')?.id ?? CREW[0].id, CREW.find(crew => crew.id === 'rose')?.id ?? CREW[1].id];
    root.className = 'app-shell';
    const header = $('header', 'masthead');
    const brand = $('div', 'brand');
    append(brand, $('span', 'brand-mark', 'C'), append($('div', 'brand-type'), $('span', 'brand-name', 'CANNONBALL'), $('span', 'brand-subtitle', 'COAST TO COAST')));
    const headerRight = $('div', 'masthead-right');
    append(headerRight, $('span', 'edition-mark', 'ROADBOOK / 70ER-ÄRA'), $('span', 'prototype-badge', 'MUSTERETAPPE'), button('Spielhilfe', 'text-button header-help', () => this.openExtra('help')));
    append(header, brand, headerRight);
    this.buildHome();

    const gameHead = $('div', 'game-head');
    const heading = $('div', 'game-heading');
    append(heading, label('ETAPPE 03 / PENNSYLVANIA'), this.stageReadout);
    const toolbar = $('nav', 'game-toolbar'); toolbar.setAttribute('aria-label', 'Spielansicht');
    this.viewButton = button('Cockpit', 'tool-button', () => this.actions.settings({ view: this.settings.view === 'arcade' ? 'cockpit' : 'arcade' }));
    this.viewButton.title = 'Ansicht wechseln (C)';
    this.mapButton = button('Karte', 'tool-button', () => this.actions.settings({ map: !this.settings.map })); this.mapButton.title = 'Routenkarte einblenden (M)';
    append(toolbar, this.viewButton, this.mapButton, button('Einstellungen', 'tool-button', () => this.openExtra('settings')), button('Pause II', 'tool-button pause-button', () => this.actions.pause()));
    append(gameHead, heading, toolbar);
    const frame = $('div', 'canvas-frame');
    this.canvas = $('canvas', 'game-canvas'); this.canvas.width = 640; this.canvas.height = 360;
    this.canvas.setAttribute('aria-label', 'Cannonball – Pennsylvania. Fahransicht. Steuerung über Tastatur oder Gamepad.');
    this.canvas.tabIndex = 0;
    append(frame, this.canvas, $('span', 'frame-corner corner-tl'), $('span', 'frame-corner corner-br'));
    const gameFoot = $('div', 'game-foot');
    this.stopButton = button('Service · E', 'text-button service-fallback', () => this.actions.enterService());
    this.stopButton.title = 'Optional: Service im markierten Parkfeld öffnen';
    append(this.stopPrompt, this.stopName, this.stopButton); this.stopPrompt.hidden = true;
    append(gameFoot, $('span', 'keyboard-hint', 'W ↑ Gas · S ↓ Bremse · ← → Lenken · Q / R Schalten'), this.stopPrompt, button('Alle Tasten ↗', 'text-button', () => this.openExtra('help')));
    this.testBanner.hidden=true;
    append(this.play, this.testBanner, gameHead, frame, gameFoot);
    this.play.hidden = true;

    this.buildPause(); this.buildSettings(); this.buildHelp();
    const servicePanel = this.panel('service', 'RAST & SERVICE');
    append(servicePanel, this.serviceTitle, this.serviceSubtitle, this.serviceStats);
    for (const title of ['Tank', 'Zustand', 'Reifen', 'Fahrer', 'Beifahrer']) {
      const value = $('strong'); this.serviceStatValues.push(value);
      append(this.serviceStats, append($('div', 'service-stat'), $('span', '', title), value));
    }
    const services = $('div', 'service-actions');
    const actionDefinitions: [ServiceAction, string, string, string][] = [
      ['refuel', 'Volltanken', '07 MIN', 'Tank vollständig auffüllen.'],
      ['repair', 'Werkstatt', '18 MIN', 'Mechanik und Reifen instand setzen.'],
      ['rest', 'Diner-Pause', '35 MIN', 'Beide Fahrer erholen sich.'],
      ['full', 'Alles erledigen', '45 MIN', 'Tanken, reparieren und ausruhen.'],
      ['swap', 'Fahrer wechseln', 'INKLUSIVE', 'Die beiden Plätze tauschen. Keine Erholung.'],
    ];
    for (const [action, title, time, description] of actionDefinitions) {
      const actionButton = button('', 'service-action', () => this.actions.service(action));
      const timeLabel = $('span', 'time-ticket', time); this.serviceTimes.set(action, timeLabel);
      append(actionButton, append($('span', 'service-action-line'), $('strong', '', title), timeLabel), $('span', 'service-description', description));
      this.serviceButtons.set(action, actionButton); services.append(actionButton);
    }
    append(servicePanel, services, $('p', 'virtual-time-note', 'Du stehst im markierten Servicefeld. Die Fahrt steht still. Service kostet die angezeigte virtuelle Rennzeit – unabhängig davon, wie lange du hier bleibst.'));
    const serviceFooter = $('div', 'dialog-actions');
    this.saveButton = button('Sicher speichern', 'button secondary', () => this.actions.save());
    append(serviceFooter, this.saveButton, button('Weiterfahren →', 'button primary', () => this.actions.service('leave')));
    append(servicePanel, this.saveNotice, serviceFooter);

    const resultPanel = this.panel('result', 'ETAPPENBUCH');
    append(resultPanel, this.resultTitle, this.resultIntro, this.resultStats);
    for (const title of ['Strecke', 'Rennzeit', 'Verstöße']) {
      const value = $('strong'); this.resultValues.push(value);
      append(this.resultStats, append($('div'), $('span', 'eyebrow', title), value));
    }
    append(resultPanel, append($('div', 'campaign-note'), label('DIE REISE GEHT SPÄTER WEITER'), $('p', '', 'Dies ist die spielbare Pennsylvania-Musteretappe. Die übrigen Staaten und Familienfreischaltungen gehören zur geplanten Coast-to-Coast-Kampagne. Ein Etappenziel schaltet sie noch nicht frei.')));
    const resultActions = $('div', 'dialog-actions');
    append(resultActions, this.continueButton('Gespeicherten Halt laden', 'button secondary'), button('Musteretappe neu starten →', 'button primary', () => this.startSelected())); resultPanel.append(resultActions);
    this.buildJourneyRecord(resultPanel);
    this.toast.setAttribute('role', 'status'); this.toast.setAttribute('aria-live', 'polite'); this.toast.hidden = true;
    this.dialog.addEventListener('cancel', event => {
      event.preventDefault();
      if (this.overridePanel) this.closeExtra();
      else if (this.state?.status === 'paused') this.actions.resume();
    });
    this.dialog.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.code === 'Escape') {
        event.preventDefault();
        if (this.overridePanel) this.closeExtra();
        else if (this.state?.status === 'paused') this.actions.resume();
      }
    });
    const footer = $('footer', 'site-footer');
    append(footer, $('span', '', 'EINE LANGE STRASSE. DEINE ENTSCHEIDUNGEN.'), $('span', '', 'PROTOTYP 0.3 · PENNSYLVANIA'));
    append(root, header, this.home, this.play, footer, this.dialog, this.toast);
  }

  private buildHome(): void {
    const hero = $('section', 'home-hero');
    const intro = $('div', 'hero-copy');
    append(intro, append($('div', 'hero-kicker'), $('span', 'kicker-line'), label('DAS RENNEN KENNT KEINE ABKÜRZUNG')),
      append($('h1'), 'Zwei Fahrer.', $('br'), 'Ein weiter ', $('em', '', 'Weg.')),
      $('p', 'hero-description', 'Durch die Countys von Pennsylvania, den Fuß am Gas und die Küste im Kopf. Kümmere dich um deinen Wagen, halte die Crew wach – und behalte den Rückspiegel im Blick.'));
    const ticket = $('aside', 'stage-ticket');
    const ticketTop = $('div', 'ticket-top'); append(ticketTop, $('span', 'ticket-number', '03'), append($('div'), label('DEIN ROADBOOK'), $('strong', '', 'PENNSYLVANIA')));
    const ticketRoad = $('div', 'ticket-road'); append(ticketRoad, $('span', 'road-end', 'PA'), $('span', 'road-dash'), $('span', 'road-dot'), $('span', 'road-dash'), $('span', 'road-end', 'OH'));
    append(ticket, ticketTop, ticketRoad, append($('div', 'ticket-facts'), append($('div'), $('strong', '', '360'), $('span', '', 'KM STRECKE')), append($('div'), $('strong', '', '06'), $('span', '', 'COUNTYS')), append($('div'), $('strong', '', '10–15'), $('span', '', 'MIN FAHRT'))), $('p', 'ticket-note', 'Eine spielbare Musteretappe. Ein Vorgeschmack auf Coast to Coast.'));
    append(hero, intro, ticket);
    const route = $('section', 'route-book');
    const routeHeading = $('div', 'section-heading');
    append(routeHeading, append($('div'), label('DAS GROSSE ZIEL'), $('h2', '', 'Von Küste zu Küste.')), $('span', 'section-meta', '13 STAATEN / 1 MUSTERETAPPE'));
    const routeLine = $('ol', 'state-route');
    for (const state of ROUTE_STATES) {
      const item = $('li', state.available ? 'state-stop available' : 'state-stop');
      const marker = $('span', 'state-marker', state.short);
      marker.title = state.available ? `${state.name} – spielbare Musteretappe` : `${state.name} – geplant`;
      append(item, marker, $('span', 'state-name', state.name), $('span', 'state-status', state.available ? 'SPIELBAR' : 'GEPLANT')); routeLine.append(item);
    }
    append(route, routeHeading, routeLine);
    const setup = $('section', 'setup-grid');
    const garage = $('div', 'garage-section');
    append(garage, this.sectionHeading('01', 'Dein Wagen', 'ZWEI FAHRBARE PROTOTYPEN'));
    const cars = $('div', 'playable-cars');
    for (const vehicle of VEHICLES.filter(vehicle => vehicle.prototype).sort((a, b) => Number(b.id === 'steinbach') - Number(a.id === 'steinbach'))) {
      const card = button('', 'vehicle-choice', () => { this.vehicleId = vehicle.id; this.updateCarSelection(); });
      card.setAttribute('aria-pressed', String(vehicle.id === this.vehicleId));
      const illustration = $('div', `car-illustration ${vehicle.body}`); illustration.style.setProperty('--car-color', vehicle.color);
      append(illustration, $('span', 'car-shadow'), $('span', 'car-body'), $('span', 'car-cabin'), $('span', 'car-wheel wheel-front'), $('span', 'car-wheel wheel-back'), $('span', 'car-headlight'));
      append(card, append($('div', 'vehicle-topline'), $('span', 'vehicle-family', vehicle.family), $('span', 'choice-indicator', '✓')), illustration,
        $('strong', 'vehicle-name', vehicle.name), $('span', 'vehicle-reference', vehicle.id === 'steinbach' ? 'Heckmotor-Turbo · Viergang' : 'V8-Reiselimousine · Automatik'),
        append($('div', 'vehicle-specs'), $('span', '', `${vehicle.maxSpeed} km/h`), $('span', '', vehicle.transmission === 'manual' ? `${vehicle.gears} Gänge · manuell` : 'Automatik')));
      this.carButtons.set(vehicle.id, card); cars.append(card);
    }
    append(garage, cars, $('p', 'garage-note', 'Der Sportwagen verlangt saubere Gangwechsel. Die Limousine schaltet automatisch und fährt gelassener.'));
    const crew = $('div', 'crew-section'); append(crew, this.sectionHeading('02', 'Deine Crew', 'ZWÖLF KÖPFE. ZWEI PLÄTZE.'));
    for (let index = 0; index < 2; index++) {
      const person = $('div', 'crew-slot');
      const personLabel = $('label', 'crew-label', index === 0 ? 'Am Steuer' : 'Auf dem Beifahrersitz');
      const select = $('select', 'crew-select'); select.id = `crew-${index}`; personLabel.htmlFor = select.id;
      for (const character of CREW) { const option = $('option', '', `${character.name} · ${character.title}`); option.value = character.id; select.append(option); }
      select.value = this.crewIds[index];
      select.addEventListener('change', () => {
        const other = index === 0 ? 1 : 0;
        const previous = this.crewIds[index]; this.crewIds[index] = select.value;
        if (this.crewIds[other] === select.value) this.crewIds[other] = previous;
        this.updateCrewSelection();
      });
      const detail = $('div', 'crew-detail');
      this.crewSelects.push(select); this.crewDetails.push(detail); append(person, personLabel, select, detail); crew.append(person);
    }
    append(crew, $('p', 'crew-note', 'Beide bringen ihre Eigenheiten mit. Rollen zählen – an einem Halt könnt ihr die Plätze tauschen.'));
    append(setup, garage, crew);
    const departure = $('section', 'departure-bar');
    append(departure, append($('div', 'departure-copy'), label('ALLES BEREIT?'), $('strong', '', 'Pennsylvania wartet.'), $('span', '', 'Neue Fahrt · eigenes Roadbook · lokaler Spielstand')),
      append($('div', 'departure-actions'), this.continueButton('Fahrt fortsetzen', 'button secondary'), button('Motor starten →', 'button primary start-button start-drive', () => this.startSelected())));
    const tests=$('details','family-archive test-launcher');
    append(tests,append($('summary'),$('span','','Gezielte Testfahrten'),$('span','','VORGEGEBENE STARTPOSITIONEN'),$('span','archive-arrow','+')));
    const testBody=$('div','archive-body');
    append(testBody,$('p','archive-intro','Diese Testfahrten beginnen in einer vorbereiteten Situation. Wagen und Crew entsprechen deiner Auswahl. Sie werden nicht gespeichert; dein bestehender Spielstand bleibt erhalten.'));
    const testButtons=$('div','test-scenario-buttons');
    for(const scenario of TEST_SCENARIOS){
      const launch=button(scenario.name,'tool-button',()=>this.startTestSelected(scenario.id));
      launch.title=scenario.description;launch.setAttribute('data-test-scenario',scenario.id);launch.disabled=!this.actions.startTest;
      testButtons.append(launch);
    }
    append(testBody,testButtons);tests.append(testBody);
    const archive = $('details', 'family-archive');
    const summary = $('summary'); append(summary, $('span', '', 'Das Familienarchiv'), $('span', '', '5 FAMILIEN · 10 WAGEN · KAMPAGNE IN PLANUNG'), $('span', 'archive-arrow', '+')); archive.append(summary);
    const archiveBody = $('div', 'archive-body');
    append(archiveBody, $('p', 'archive-intro', 'Zwei Wagen sind in der Musteretappe fahrbar. Die anderen Familien sind ein Ausblick auf die vollständige Reise. Familien werden erst durch eine abgeschlossene Coast-to-Coast-Kampagne freigeschaltet.'));
    const catalog = $('div', 'family-catalog');
    for (const vehicle of VEHICLES) {
      const item = $('div', vehicle.prototype ? 'catalog-entry catalog-playable' : 'catalog-entry');
      const swatch = $('span', 'catalog-swatch'); swatch.style.backgroundColor = vehicle.color;
      append(item, swatch, append($('div'), $('strong', '', vehicle.id === 'roadnest' ? 'Roadnest' : vehicle.name), $('span', '', vehicle.family)), $('span', 'catalog-state', vehicle.prototype ? 'MUSTERETAPPE' : 'GEPLANT')); catalog.append(item);
    }
    append(archiveBody, catalog, $('p', 'muted archive-footnote', 'Eigenständige Fahrzeuge und Figuren. Vergrößerte Tanks sind Spielbalancing. Historischer Treibstoff-Van und Reisemobil bleiben unterschiedliche Fahrzeugtypen.')); archive.append(archiveBody);
    append(this.home, hero, route, setup, departure, tests, archive);
    this.updateCarSelection(); this.updateCrewSelection();
  }

  private sectionHeading(number: string, title: string, note: string): HTMLElement {
    return append($('div', 'setup-heading'), $('span', 'section-number', number), append($('div'), $('h2', '', title), $('span', 'eyebrow', note)));
  }

  private updateCarSelection(): void {
    for (const [id, card] of this.carButtons) { card.classList.toggle('selected', id === this.vehicleId); card.setAttribute('aria-pressed', String(id === this.vehicleId)); }
  }

  private updateCrewSelection(): void {
    for (let index = 0; index < 2; index++) {
      const crew = getCrew(this.crewIds[index]); this.crewSelects[index].value = crew.id;
      const detail = this.crewDetails[index]; detail.replaceChildren();
      const monogram = $('span', 'crew-monogram', crew.name.split(' ').map(part => part[0]).slice(0, 2).join('')); monogram.style.setProperty('--crew-color', crew.color);
      append(detail, monogram, append($('div'), $('p', 'crew-description', crew.description), $('p', 'crew-strength', `+ ${crew.strength}`), $('p', 'crew-weakness', `− ${crew.weakness}`)));
    }
  }

  private continueButton(text: string, className: string): HTMLButtonElement {
    const result = button(text, className, () => this.actions.load()); result.disabled = !this.savedAvailable; this.continueButtons.push(result); return result;
  }

  private startSelected(): void { this.overridePanel = null; this.closeDialog(); this.actions.start(this.vehicleId, [...this.crewIds]); window.scrollTo(0, 0); this.canvas.focus({ preventScroll: true }); }
  private startTestSelected(id:TestScenarioId):void { if(!this.actions.startTest)return;this.overridePanel=null;this.closeDialog();this.actions.startTest(id,this.vehicleId,[...this.crewIds]);window.scrollTo(0,0);this.canvas.focus({preventScroll:true}); }

  private panel(name: string, kicker: string): HTMLElement {
    const panel = $('section', `dialog-panel panel-${name}`); panel.hidden = true; panel.setAttribute('aria-label', kicker);
    panel.append(label(kicker)); this.panels.set(name, panel); this.dialog.append(panel); return panel;
  }

  private buildPause(): void {
    const pane = this.panel('paused', 'KURZ RECHTS RAN');
    append(pane, $('h2', '', 'Die Straße kann warten.'), $('p', 'dialog-intro', 'Deine Rennzeit steht still. Hol Luft, prüfe das Roadbook – dann geht es weiter.'));
    append(pane, append($('div', 'pause-options'), button('Weiterfahren →', 'button primary', () => this.actions.resume()), button('Ansicht & Einstellungen', 'button secondary', () => this.openExtra('settings')), button('Steuerung ansehen', 'button secondary', () => this.openExtra('help')), this.continueButton('Gespeicherten Halt laden', 'button quiet')));
    this.buildJourneyRecord(pane);
    pane.append($('p', 'muted', 'Speichern ist nur an einem sicheren Servicehalt möglich. Eine Pause repariert den Wagen und erholt die Crew nicht.'));
  }

  private buildJourneyRecord(parent: HTMLElement): void {
    const record = $('section', 'journey-record'); const body = $('div', 'journey-record-body');
    body.id = `journey-record-${this.journeyViews.length}`; body.hidden = true;
    const toggle = button('Roadbook ansehen +', 'journey-record-toggle', () => {
      body.hidden = !body.hidden; toggle.setAttribute('aria-expanded', String(!body.hidden));
      setText(toggle, body.hidden ? 'Roadbook ansehen +' : 'Roadbook schließen −');
    });
    toggle.setAttribute('aria-controls', body.id); toggle.setAttribute('aria-expanded', 'false');
    const totals = $('p', 'journey-totals'),teams=$('p','rival-strategies'); const list = $('ol', 'journey-list');
    append(body, totals, teams, list); append(record, toggle, body); parent.append(record);
    this.journeyViews.push({ totals, teams, list, signature: '' });
  }

  private updateJourneyRecord(state: RunState): void {
    const recent = state.log.slice(-6);
    const escapes = state.escapes ?? 0;
    const signature = `${state.seed}:${state.violations}:${escapes}:${state.rivals.map(r=>r.violations??0).join(',')}:${recent.map(entry => `${entry.time}:${entry.text}`).join('|')}`;
    for (const view of this.journeyViews) {
      if (view.signature === signature) continue;
      view.signature = signature;
      setText(view.totals, `Bestätigte Verstöße: ${state.violations} · Der Polizei entkommen: ${escapes} Mal`);
      const styles:Record<string,string>={bold:'risikofreudig',balanced:'ausgewogen',cautious:'vorsichtig',efficient:'sparsam'};
      setText(view.teams,state.rivals.map(rival=>`${rival.name}: ${styles[rivalPolicy(rival.id).style]} · ${(rival.violations??0)>=3?'ausgeschieden':`${rival.violations??0} Knöllchen`}`).join(' / '));
      view.list.replaceChildren();
      for (const entry of recent) append(view.list, append($('li'), $('time', '', formatTime(entry.time)), $('span', '', entry.text)));
      if (!recent.length) view.list.append($('li', 'journey-empty', 'Noch keine Einträge auf dieser Fahrt.'));
    }
  }

  private buildSettings(): void {
    const pane = this.panel('settings', 'DEIN PLATZ AM STEUER');
    append(pane, $('h2', '', 'Ansicht & Einstellungen'), $('p', 'dialog-intro', 'Wechsle die Perspektive oder vergleiche die Auflösungen. Die Fahrphysik bleibt dieselbe.'));
    const grid = $('div', 'settings-grid');
    this.settingSelect(grid, 'view', 'Perspektive', [['arcade', 'Arcade · Blick auf den Wagen'], ['cockpit', 'Cockpit · hinter dem Lenkrad']]);
    this.settingSelect(grid, 'resolution', 'Native Auflösung', [['640x360', '640 × 360 · Classic'], ['1280x720', '1280 × 720 · Hoch']]);
    this.settingSelect(grid, 'units', 'Tacho', [['kmh', 'Kilometer pro Stunde'], ['mph', 'Meilen pro Stunde']]);
    this.settingToggle(grid, 'map', 'Papierkarte einblenden', 'Die gesamte Etappe im Blick.');
    this.settingToggle(grid, 'sound', 'Motor & Straßengeräusche', 'Spielton an oder aus.');
    this.settingToggle(grid, 'speech', 'Crew-Kommentare vorlesen', 'Optionale Browserstimme; abhängig vom Gerät.');
    append(pane, grid, append($('div', 'dialog-actions'), button('Zurück zum Roadbook', 'button primary', () => this.closeExtra())));
  }

  private settingSelect(parent: HTMLElement, key: keyof ViewSettings, title: string, options: string[][]): void {
    const row = $('div', 'setting-row'); const caption = $('label', '', title); const select = $('select'); select.id = `setting-${key}`; caption.htmlFor = select.id;
    for (const [value, text] of options) { const option = $('option', '', text); option.value = value; select.append(option); }
    select.addEventListener('change', () => this.actions.settings({ [key]: select.value })); this.settingsControls.set(key, select); append(row, caption, select); parent.append(row);
  }

  private settingToggle(parent: HTMLElement, key: keyof ViewSettings, title: string, description: string): void {
    const row = $('label', 'setting-toggle'); const input = $('input'); input.type = 'checkbox'; input.id = `setting-${key}`;
    input.addEventListener('change', () => this.actions.settings({ [key]: input.checked })); this.settingsControls.set(key, input);
    append(row, append($('span'), $('strong', '', title), $('small', '', description)), input); parent.append(row);
  }

  private buildHelp(): void {
    const pane = this.panel('help', 'VOR DER ERSTEN MEILE'); append(pane, $('h2', '', 'Das kleine Fahrerhandbuch'));
    const list = $('div', 'control-list');
    for (const [keys, text] of [['W / ↑', 'Gas geben'], ['S / ↓', 'Bremsen'], ['← / →', 'Lenken · auch A / D'], ['Q / R', 'Runter- / hochschalten'], ['E', 'Service im Parkfeld öffnen (optional)'], ['C / M', 'Ansicht / Papierkarte wechseln'], ['P / Esc', 'Pause']]) {
      append(list, append($('div'), $('kbd', '', keys), $('span', '', text)));
    }
    append(pane, list, append($('div', 'help-callout'), label('GAMEPAD'), $('p', '', 'Linker Stick lenkt. RT gibt Gas, LT bremst. LB / RB schalten. A bestätigt Menüs und kann den Service im Parkfeld öffnen. Start öffnet die Pause.')),
      $('p', 'dialog-intro help-tip', 'Mit Handschaltung schaltest du selbst. Die dezente Drehzahllampe zeigt, wann du hochschalten solltest. Tank, Reifen, Mechanik und beide Fahrer brauchen Aufmerksamkeit.'),
      $('p', 'dialog-intro help-tip', 'Fahre zum Service auf den Vorplatz und halte im markierten Feld an. Das Servicemenü öffnet automatisch. Den Umweg nimmst du, indem du an der sichtbaren Gabelung nach rechts lenkst. Gebäude sind feste Hindernisse.'),
      $('p', 'dialog-intro help-tip', 'Drei bestätigte Verstöße beenden die Fahrt. Die Grenze nach Ohio beendet eine Verfolgung. Die letzten Ereignisse findest du im Roadbook der Pause.'),
      $('p', 'dialog-intro help-tip', 'Auf der Startseite findest du fünf gezielte Testfahrten mit vorgegebenen Startpositionen. Der Testhinweis bleibt sichtbar; diese Fahrten überschreiben keinen Spielstand.'),
      append($('div', 'dialog-actions'), button('Verstanden →', 'button primary', () => this.closeExtra())));
  }

  private openExtra(panel: 'settings' | 'help'): void {
    this.overridePanel = panel;
    if (this.state?.status === 'driving') this.actions.pause();
    this.showPanel(panel);
  }

  private closeExtra(): void {
    this.overridePanel = null;
    if (!this.state) this.closeDialog();
    else this.showPanel(this.state.status === 'finished' || this.state.status === 'failed' ? 'result' : this.state.status);
  }

  private showPanel(name: string): void {
    if (!this.panels.has(name)) { this.closeDialog(); return; }
    const changed = this.visiblePanel !== name;
    if (this.visiblePanel !== name) {
      for (const [panelName, panel] of this.panels) panel.hidden = panelName !== name;
      this.visiblePanel = name;
      this.dialog.setAttribute('aria-label', this.panels.get(name)!.getAttribute('aria-label') ?? 'Roadbook');
    }
    if (!this.dialog.open) this.dialog.showModal();
    else if (changed) this.panels.get(name)!.querySelector<HTMLElement>('button:not(:disabled),select,input')?.focus({ preventScroll: true });
  }

  private closeDialog(): void { if (this.dialog.open) this.dialog.close(); this.visiblePanel = ''; }

  showHome(): void {
    this.state = null; this.lastStatus = null; this.home.hidden = false; this.play.hidden = true; this.root.classList.remove('in-game'); this.overridePanel = null; this.closeDialog();
  }

  setSavedAvailable(value: boolean): void {
    this.savedAvailable = value;
    for (const button of this.continueButtons) { button.disabled = !value; button.title = value ? 'Am letzten sicheren Servicehalt fortsetzen' : 'Noch kein sicherer Spielstand vorhanden'; }
  }

  setTestScenarioLabel(value:string|null):void {
    this.testScenarioLabel=value;this.testBanner.hidden=value===null;
    setText(this.testBanner,value===null?'':`TESTFAHRT · ${value} · kein Spielstand`);
    if(this.state?.status==='service')this.updateService(this.state);
  }

  notify(message: string): void {
    window.clearTimeout(this.toastTimer); setText(this.toast, message); this.toast.hidden = false;
    this.toastTimer = window.setTimeout(() => { this.toast.hidden = true; }, 5000);
  }

  update(state: RunState | null, settings: ViewSettings, _stats: RenderStats): void {
    this.settings = settings;
    for (const [key, control] of this.settingsControls) {
      if (control instanceof HTMLInputElement) { const value = Boolean(settings[key]); if (control.checked !== value) control.checked = value; }
      else { const value = String(settings[key]); if (control.value !== value) control.value = value; }
    }
    setText(this.viewButton, settings.view === 'arcade' ? 'Cockpit · C' : 'Arcade · C');
    this.mapButton.classList.toggle('active', settings.map); this.mapButton.setAttribute('aria-pressed', String(settings.map));
    if (!state) return;
    this.state = state; this.vehicleId = state.vehicleId; this.crewIds = [...state.crew];
    this.home.hidden = true; this.play.hidden = false; this.root.classList.add('in-game');
    const county = state.counties[state.countyIndex];
    setText(this.stageReadout, `${county?.name ?? 'Pennsylvania'} · ${Math.min(STAGE_LENGTH / 1000, Math.floor(state.distance / 1000))} / ${STAGE_LENGTH / 1000} km`);
    const onApron = isServiceApron(state.distance, state.x, state.route);
    const nearby = onApron ? serviceOnApproach(state.distance, state.route) : null;
    const parked = onApron ? serviceAtParking(state.distance, state.x, state.route) : null;
    const showServiceHelp = state.status === 'driving' && nearby !== null && state.police.mode !== 'pursuit' && state.serviceExitBlock !== nearby.id;
    this.stopPrompt.hidden = !showServiceHelp;
    if (showServiceHelp) {
      setText(this.stopName, 'Auf dem markierten Feld anhalten');
      this.stopPrompt.title = nearby.name;
      this.stopButton.hidden = parked === null || state.speed > 3;
    }
    if (this.lastStatus !== state.status) {
      this.lastStatus = state.status;
      if (!this.overridePanel) this.showPanel(state.status === 'finished' || state.status === 'failed' ? 'result' : state.status);
      if (state.status === 'driving') this.canvas.focus({ preventScroll: true });
    }
    if (state.status === 'service') this.updateService(state);
    if (state.status === 'paused' || state.status === 'finished' || state.status === 'failed') this.updateJourneyRecord(state);
    if (state.status === 'finished' || state.status === 'failed') this.updateResult(state);
  }

  private updateService(state: RunState): void {
    const service = SERVICES.find(item => item.id === state.serviceId); const vehicle = getVehicle(state.vehicleId);
    setText(this.serviceTitle, service?.name ?? 'Servicehalt');
    setText(this.serviceSubtitle, `${service ? serviceNames[service.kind] : 'Rast & Service'} · Rennzeit ${formatTime(state.elapsed)}. ${service?.description ?? 'Ein sicherer Halt am Wegesrand.'}`);
    const active = state.activeDriver; const other = active === 0 ? 1 : 0;
    const values = [`${state.fuel.toFixed(0)} / ${vehicle.tank} l`, `${Math.round(state.condition)} %`, `${Math.round(state.tires)} %`, `${getCrew(state.crew[active]).name} · ${Math.round(state.fatigue[active])} % müde`, `${getCrew(state.crew[other]).name} · ${Math.round(state.fatigue[other])} % müde`];
    this.serviceStatValues.forEach((element, index) => setText(element, values[index]));
    const kind = service?.kind; const available: Record<ServiceAction, boolean> = { refuel: kind === 'fuel' || kind === 'garage' || kind === 'truckstop', repair: kind === 'garage' || kind === 'truckstop', rest: kind === 'diner' || kind === 'truckstop', full: kind === 'truckstop', swap: true, leave: true };
    const repairFactor = Math.max(0.65, Math.min(1.1, ...state.crew.map(id => getCrew(id).repair)));
    for (const [action, button] of this.serviceButtons) {
      const done = action !== 'swap' && (state.serviced.includes(`${service?.id}:${action}`) || state.serviced.includes(`${service?.id}:full`) || (action === 'full' && state.serviced.some(key => key.startsWith(`${service?.id}:`))));
      button.disabled = !available[action] || done; button.hidden = !available[action];
      const time = this.serviceTimes.get(action)!;
      if (done) setText(time, 'ERLEDIGT');
      else if (action === 'repair' || action === 'full') {
        const minutes = (action === 'repair' ? 18 : 45) * repairFactor;
        setText(time, `${Number.isInteger(minutes) ? '' : '≈ '}${Math.round(minutes).toString().padStart(2, '0')} MIN`);
        time.title = `${Math.floor(minutes)} Minuten ${Math.round((minutes % 1) * 60)} Sekunden virtuelle Rennzeit. Crew-Vorteile sind berücksichtigt.`;
      }
    }
    const safe = state.police.mode !== 'pursuit'; this.saveButton.disabled = !safe||this.testScenarioLabel!==null;
    setText(this.saveNotice, this.testScenarioLabel!==null?'Testfahrt: Speichern ist deaktiviert. Dein bestehender Spielstand bleibt erhalten.':safe ? 'Sicherer Halt: Speichern erhält diesen Zustand. Es füllt keinen Tank und erholt keine Fahrer.' : 'Bei laufender Verfolgung ist kein sicherer Spielstand möglich.');
  }

  private updateResult(state: RunState): void {
    const finished = state.status === 'finished';
    setText(this.resultTitle, finished ? 'Ohio. Für heute am Ziel.' : 'Diese Fahrt endet hier.');
    setText(this.resultIntro, finished ? 'Pennsylvania liegt hinter euch. Wagen und Crew haben die Musteretappe geschafft.' : state.failureReason ?? 'Wagen oder Crew konnten die Etappe nicht beenden. Lade deinen letzten sicheren Halt oder versuche es noch einmal.');
    const values = [`${Math.floor(Math.min(state.distance, STAGE_LENGTH) / 1000)} km`, formatTime(state.elapsed), String(state.violations)];
    this.resultValues.forEach((element, index) => setText(element, values[index]));
  }
}
