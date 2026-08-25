# Changelog
## [1.0.6.0] - 2026-08-25
- CHANGE i nomi delle wallbox nei grafici arrivano da WALLBOX_MQTT_NAME in ocpp.ini. Il server
  espone la mappa sezione->nome (iniettata come window.OCPP_WALLBOX_NAMES e in /config), e la
  colonna 9 dei .dat e' proprio l'id di sezione. Una sezione conta come wallbox se contiene un
  parametro WALLBOX*, come fa il server: i nomi di sezione sono liberi, [wallbox01] e' solo
  convenzione. Ripiego su EV1/EV2 per le sezioni wallboxNN, altrimenti sull'id
- REFACTOR rimossa trendOrigIdx: i tooltip del grafico a periodo identificavano la metrica per
  posizione del dataset. Ora ogni dataset porta `metric`, quindi aggiungerne o toglierne non
  sposta piu' niente. Correggeva anche uno scambio latente import/export in quella mappa
- ADD nel grafico settimanale/mensile la barra EV si divide in una barra per wallbox, impilate
  nello stesso stack: l'altezza del gruppo resta il totale del giorno e le altre metriche
  restano gruppi affiancati. Con una sola wallbox il grafico e' identico a prima
- CHANGE con le barre per wallbox la scomposizione non viene piu' ripetuta nel tooltip (sarebbe
  ridondante) e i "Max" del giorno si mostrano una volta sola invece di una per barra
## [1.0.5.5] - 2026-08-25
- CHANGE rimossi ports: e ports_description: da config.yaml. Con host_network: true non
  facevano alcun mapping, quindi lasciavano intendere che le porte si configurassero
  nell'add-on. La configurazione delle due wallbox sta solo in ocpp.ini: le porte hanno il
  default nel server (9000/9001) e si spostano con LISTEN0/LISTEN1
## [1.0.5.4] - 2026-08-25
- FIX DOCS: la sezione multi-wallbox affermava che le porte 9000/9001 sono configurate
  dall'add-on. Non e' vero: le binda il server (default in ocpp.pl, sovrascrivibili con
  LISTEN0/LISTEN1 in ocpp.ini) e con host_network: true non c'e' nessun mapping.
  Il blocco ports: in config.yaml documenta le porte, non le apre
## [1.0.5.3] - 2026-08-25
- CHANGE i parametri di tuning multiwallbox non sono piu' opzioni dell'add-on: WALLBOX1_SHARE,
  PRIORITY_WALLBOX, WAIT_SUSPEND, WAIT_RESUME e WAIT_PRIORITY si impostano in ocpp.ini.
  Il merge col template li aggiunge gia' commentati col loro default, quindi basta
  decommentarli; senza opzione l'add-on non li sovrascrive piu' a ogni riavvio
- CHANGE DOCS: la sezione multi-wallbox documenta le chiavi dell'ini invece delle opzioni
## [1.0.5.2] - 2026-08-25
- ADD totale caricato per wallbox nel riepilogo: "EV Total: 7.00 kWh (EV1 2.00 - EV2 5.00)",
  sia nel giorno singolo sia su settimana/mese. Con una sola wallbox il riquadro non cambia
- ADD scomposizione per wallbox nel tooltip della barra "EV Charged" del grafico settimanale
  (senza aggiungere dataset: la mappa trendOrigIdx aggancia le linee di trend alle barre
  per indice, inserirne altri la romperebbe)
- ADD la sessione nel tooltip del grafico giornaliero indica la wallbox e i kWh da FV:
  "Sessione #2 (EV2) - 14:00 -> 17:00 - 3h 00min - 5.00 kWh - FV 1.50 kWh"
- FIX `sumSessionPv` sommava solo le sessioni con session_pv_kwh: nel giorno del passaggio di
  formato le sessioni scritte prima del riavvio contavano 0 al FV pur restando nel totale kWh,
  falsando la percentuale. Ora se anche una sola sessione del giorno non ha il dato si usa la
  stima per tutto il giorno: un metodo solo, coerente
## [1.0.5.1] - 2026-08-25
- CHANGE default `code_repo` di nuovo su `gitlab.com/lucabon/ocpp-mqtt-perl-server` (branch `main`)
- ADD supporto al formato `_charge.dat` multiwallbox: colonna 9 wallbox, 10 session_kwh,
  11 session_pv_kwh, context spostato a 12. Il formato legacy (context a 9) resta supportato,
  discriminato sul numero di colonne
- FIX `parseChargeSessions` teneva un solo stato di apertura per tutto il file: due wallbox in
  carica insieme collassavano in una sessione e la seconda spariva dal conteggio.
  Ora lo stato e' per-wallbox
- FIX `parseChargeDat` accumulava le righe delle due wallbox nello stesso array: la curva
  "EV Power" saltellava tra i due valori. Ora le serie sono per-wallbox e il totale e' la somma
- FIX i kWh di sessione venivano dal delta del registro assoluto, che con due wallbox salta tra
  due contatori cumulativi indipendenti (e un `Math.abs` mascherava il risultato). Ora arrivano
  da `session_kwh`; il delta resta solo come fallback legacy, per-wallbox
- CHANGE "PV Charged" usa `session_pv_kwh` quando disponibile, invece della stima per
  integrazione di `min(ev, ev-grid)`
- CHANGE i parser di `_charge.dat` usano `split("\t")`: `/\s+/` collassa i tab adiacenti di un
  campo vuoto e sfasa tutti gli indici successivi
- CHANGE il match di Transaction.Begin/End e' ancorato al campo context invece che a tutta la riga
- ADD nel grafico giornaliero una serie tratteggiata per wallbox (EV1/EV2) oltre all'area del
  totale, solo quando le wallbox sono piu' di una
## [1.0.5.0] - 2026-08-25
- ADD `code_repo` / `code_ref`: repository e ref del server OCPP configurabili dalle opzioni
- CHANGE default sul fork multi-wallbox `gitlab.com/skaccox/ocpp-mqtt-perl-server` (branch `main`)
- FIX il remote non veniva aggiornato sulle installazioni esistenti: ora `origin` viene
  riallineato con `git remote set-url` e il cambio di ref esegue un checkout, non solo un pull.
  Entrambi si applicano anche con `auto_update` disattivo
- FIX `set_kv` ora aggiunge le chiavi assenti (nella sezione globale, prima della prima
  sezione `[..]`) invece di limitarsi a aggiornare o decommentare
- ADD merge una-tantum di `ocpp.ini` con il template `ocpp-default.ini`: le chiavi nuove
  vengono aggiunte commentate col loro default (stamp sull'hash del template)
- ADD opzioni multi-wallbox: `wallbox1_share`, `priority_wallbox`, `wait_suspend`,
  `wait_resume`, `wait_priority`
- ADD porta 9001 (secondo wallbox) oltre alla 9000 in config.yaml
## [1.0.4.14] - 2026-04-20
- ADD build.yaml per compatibilità Docker/BuildKit recenti

