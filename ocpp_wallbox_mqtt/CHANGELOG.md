# Changelog
## [1.8.15] - 2026-10-03
- CHG anche nelle righe per wallbox l'unita' sta un passo indietro rispetto al
  numero, come sul valore grande: piu' piccola e smorzata. Col loro colore
  pero', non col grigio, che su una riga gia' smorzata sparirebbe
- CHG nel tooltip la stessa idea sull'etichetta: "Costo:", "In energia:",
  "Netto:" dicono di che numero si tratta, non sono il numero, e ora si
  leggono piu' piccole, lasciando il corpo grande alla cifra
## [1.8.14] - 2026-10-03
- FIX nelle righe per wallbox l'unita' andava a capo sotto al nome invece di
  stare in coda al valore: ogni riga e' una colonna, e il pezzo aggiunto ci
  finiva dentro come se fosse un'altra riga. Ora quelle righe sono orizzontali
  e lo spazio prima dell'unita' lo fa un margine, che in un contenitore flex
  uno spazio nel testo si perderebbe
## [1.8.13] - 2026-10-03
- FIX su schermo largo l'unita' mancava sotto le caselle con due wallbox:
  "Giardino 5,00" invece di "Giardino 5,00 kWh". Ora la porta anche la
  scomposizione, comprese le righe che compaiono dopo
## [1.8.12] - 2026-10-03
- CHG su schermo largo l'unita' di misura sta accanto al valore ("25,00 kWh")
  invece che accanto all'icona: attaccata al numero si legge in un colpo solo,
  e in quella riga il posto c'e'. Su mobile resta dov'era, che li' lo spazio
  non c'e'. In denaro non cambia niente, perche' il simbolo di valuta e' gia'
  attaccato al valore
## [1.8.11] - 2026-10-03
- FIX il viola della seconda wallbox era schiarito troppo e a piena potenza
  sbiadiva: ora sta a meta' strada (#c084fc), leggibile sul nero senza
  perdere corpo
- CHG i limiti di rete nel log passano da viola ad arancione in grassetto: il
  viola ora vuol dire "seconda wallbox", e due cose senza rapporto fra loro
  avevano lo stesso colore. L'arancione li tiene nella famiglia dei limiti,
  con l'ambra di SetChargingProfile, e il grassetto li fa trovare
## [1.8.10] - 2026-10-03
- FIX nel log il viola della seconda wallbox era illeggibile sul nero: i
  colori per wallbox passano a tinte piu' chiare, della stessa famiglia di
  quelle del grafico - che sta su blu scuro e le regge - cosi' la wallbox
  viola resta viola in tutte e due i posti. Le righe sotto i 2500 W si
  smorzano meno (.72 -> .8), se no sul nero si perdeva quanto guadagnato
## [1.8.9] - 2026-10-03
- FIX su mobile le sei caselle della barra andavano a capo per pochi pixel.
  Si stringono lo spazio fra loro (6px -> 4px) e i margini della barra
  (4px -> 2px), non il corpo del testo: i numeri devono restare leggibili,
  lo spazio vuoto no
## [1.8.8] - 2026-10-03
- CHG nel log le righe di ricarica di un impianto con piu' wallbox prendono
  il colore della loro wallbox, gli stessi delle barre del grafico, e la
  potenza passa nell'intensita' (smorzata sotto i 2500 W). Prima il colore
  diceva solo la potenza: due wallbox davano due verdi quasi uguali, che si
  leggevano come una differenza fra loro invece che fra i watt. Con una
  wallbox sola non cambia niente
- CHG in barra le etichette si accorciano: "EV from Grid" ed "EV from Solar"
  diventano "EV Grid" ed "EV Solar", e "PV Produced" torna "PV Total". Le tre
  voci EV condividono il prefisso e la riga sta in meno spazio
## [1.8.7] - 2026-10-03
- CHG nella spiegazione la riga in denaro dice che soldi sono invece di "In
  denaro": "Costo" su EV from Grid e Import, "Guadagno" su Export,
  "Risparmio" su EV from Solar. Il colore non bastava: il solare finito nelle
  auto e' verde come l'export, ma e' una spesa evitata, non un incasso
## [1.8.6] - 2026-10-03
- CHG nel tooltip i valori passano a corpo 16: sono il motivo per cui lo si
  apre, e in corpo 11 come la frase si leggevano come testo fra il testo. La
  spiegazione resta piccola e grigia, in fondo
- CHG la riga del totale caricato dice solo "Caricato in totale: 25,00 kWh":
  quanto ne venga dalla rete e' il numero gia' in barra, ripeterlo non
  aggiungeva niente. In denaro, dove in barra c'e' il costo, i kWh della
  casella tornano sulla loro riga
- CHG su mobile la riga del netto porta il solo importo e il perche' passa in
  coda alla spiegazione: una frase intera in corpo 16 sarebbe stata un blocco
## [1.8.5] - 2026-10-03
- CHG la riga "Caricato in totale ... di cui ... dalla rete" e' celeste anche
  in modalita' kWh: sono kWh in tutte e due le viste, e restava l'unico punto
  dove gli stessi numeri cambiavano colore con la modalita'. Ora la regola non
  ha eccezioni - celeste i kWh, ambra e verde i soldi, bianco il resto
## [1.8.4] - 2026-10-03
- CHG nella spiegazione vengono prima i valori e poi la frase, che resta in
  fondo e smorzata: chi la apre cerca un numero, la descrizione serve dopo
- CHG in kWh i valori delle sei caselle di energia prendono il celeste del
  logo. In barra non e' una tinta per fare colore: accanto ci sono un
  conteggio, una percentuale e due potenze, e il celeste dice quali caselle
  sono energia, cioe' quali si sommano fra loro
## [1.8.3] - 2026-10-03
- ADD la spiegazione delle quattro caselle che esistono in tutte e due le
  modalita' porta anche il valore dell'altra: in kWh quanto fa in denaro, in
  denaro da quanta energia viene. Il numero c'e' gia', e averlo li' evita di
  premere il tasto solo per guardarlo
- CHG i soldi nella spiegazione tengono il colore del loro verso, ambra o
  verde come in barra; l'energia prende il celeste del logo, che in barra non
  si usa: cosi' si vede a colpo d'occhio di che unita' si parla
## [1.8.2] - 2026-10-03
- ADD sotto Sessions compaiono le ricariche di ciascuna wallbox, come per le
  altre caselle EV. Le sessioni dei file piu' vecchi, che non portano l'id
  della wallbox, restano fuori dalla scomposizione invece di finire sotto un
  nome inventato
- CHG i giorni gia' in memoria si ricalcolano: quelli salvati prima non hanno
  il conteggio per wallbox
## [1.8.1] - 2026-10-03
- ADD casella "EV from Grid" in testa alla barra: l'energia comprata per
  caricare, cioe' il caricato meno la quota solare. In denaro diventa "EV
  Cost", il numero che si paga davvero, e per questo sta per prima
- CHG "EV Total" si chiama "EV Charged" e in denaro sparisce: e' energia
  pagata a due prezzi diversi - una parte dalla rete, una gratis - e un
  importo solo non direbbe quale
- CHG "PV Charged" diventa "EV from Solar", e in denaro "Solar Saved";
  "PV Total" diventa "PV Produced" e "PV %" diventa "Solar %"
- ADD casella "Solar Net" in denaro, su schermo largo: la spesa evitata meno
  il mancato incasso dell'export. Su mobile resta nella spiegazione di Solar
  Saved, insieme alla quota solare, perche' li' quelle caselle non ci sono
- CHG ordine della barra: EV from Grid, Import, EV from Solar, Export, poi
  EV Charged e PV Produced in kWh o Buy e Sell in denaro. Le spese e gli
  incassi si alternano a coppie, e la prima casella e' quella che si paga
- CHG la spiegazione della prima casella dice sempre quanto si e' caricato in
  tutto e quanto di quello veniva dalla rete: la casella mostra solo la
  seconda meta', che da sola non dice quanto sia grossa
- CHG le due tendine su desktop si allargano (wallbox 104px, bars/lines 88px):
  le scritte non ci stavano. Su mobile restano come sono
## [1.8.0] - 2026-10-02
Riassunto della serie 1.7.x: qui restano le cose che si vedono, senza i
ritocchi intermedi (misure dei menu, colori provati e rifatti, passaggi poi
tornati indietro).

### Valori in denaro
- ADD un pulsante in GRAPH passa tutta la pagina dai kWh al denaro: barra
  delle statistiche, grafico di settimana/mese/anno e tooltip. EV Total
  diventa quanto e' costato caricare (il caricato meno la quota solare, al
  prezzo d'acquisto), PV Charged diventa PV Saved - quanto avresti pagato per
  l'energia solare finita nelle auto - Grid Import la spesa e Grid Export
  l'incasso. Le scomposizioni per wallbox seguono
- ADD opzioni price_import e price_export come listini: righe {from, price}
  con la data di inizio validita', piu' currency. Ogni kWh vale il prezzo in
  vigore il giorno in cui e' stato misurato, quindi un periodo a cavallo di un
  cambio tariffa resta giusto in tutte le viste e in tutti i conti
- ADD colonne Buy e Sell col prezzo medio del periodo, pesato sui kWh
  prelevati o immessi; le singole tariffe, con la loro data, nella spiegazione
- ADD nella spiegazione di PV Saved anche il risparmio netto, cioe' meno il
  mancato incasso dell'export, con la scomposizione per wallbox
- CHG nel grafico in denaro la serie Solar diventa PV Saved: la produzione non
  ha un prezzo solo, perche' una parte e' autoconsumata e una venduta, e dai
  file non si sa come si divide
- CHG il grafico del giorno resta sempre in kW: quelle sono potenze
  istantanee, in denaro diventerebbero euro all'ora
- CHG colori per verso: ambra quello che esce (EV Total, Grid Import), verde
  quello che entra o non esce (PV Saved, Grid Export). I prezzi restano
  neutri, perche' dicono quanto vale un kWh, non quanto e' uscito
- CHG i numeri seguono la lingua del browser: in italiano i decimali hanno la
  virgola e le migliaia il punto (3,30€, 12.345,68)

### Statistiche e grafici
- ADD vista YEAR: dodici barre, una per mese, con le stesse statistiche e le
  stesse scomposizioni delle altre viste
- ADD scomposizione per wallbox su EV Total, PV Charged e PV %, in tutte le
  viste. La percentuale di ciascuna e' sul proprio caricato
- ADD filtro wallbox (BOTH di default, compare solo con piu' di una):
  scegliendone una, grafico e statistiche mostrano solo quella
- ADD una spiegazione su ogni casella della barra, col mouse e al tap; i testi
  cambiano con la modalita'
- ADD i totali dei giorni chiusi finiscono in cache nel browser: un anno
  sarebbero oltre mille richieste a ogni apertura. Oggi non viene mai messo in
  cache, e la chiave tiene conto di listino e fattori di calibrazione
- ADD opzioni grid_import_factor e grid_export_factor (default 1.0): calibrano
  i kWh di Grid Import ed Export sul contatore del distributore (tipicamente
  0.97 e 0.93). Si applicano all'origine, quindi valgono per kWh, denaro,
  grafici e totali di periodo, e non toccano EV e FV, che vengono da altri
  sensori

### Correzioni che cambiano i numeri
- FIX i totali di sessione leggevano l'ultimo campione dei contatori, ma ai
  confini il file porta la riga di apertura della sessione dopo (kWh gia' a
  zero) e quelle di chiusura (kWh azzerato, FV no). Sul 26/09 usciva EV Total
  0.54 kWh con PV Charged 14.70 e PV% 2703%: ora 14.98 kWh e 98%
- FIX la scomposizione del FV spariva per un intero periodo appena un giorno
  non ce l'aveva: un giorno senza ricariche veniva preso per "dato mancante",
  e i file di formato vecchio non registrano il solare per singola ricarica.
  Ora quei giorni si dividono in proporzione ai kWh caricati, e un anno - che
  ne contiene sempre uno - tiene la sua scomposizione
- FIX nel grafico giornaliero le linee per-wallbox finivano sotto la curva
  verde del totale: il tooltip dava il colore giusto ma a schermo si vedeva
  solo il verde

### Log e aggiornamenti
- ADD indicatore di versione del server in cima: ambra con la freccia quando
  ci sono commit nuovi, cliccato apre dettagli e aggiornamento. Mostra la
  versione remota, il repo e il ref, cosi' si vede cosa si installerebbe. Il
  confronto e' su git, non sul numero di versione, quindi vale anche per un
  fork
- CHG auto_update aggiorna anche al controllo orario, non solo all'avvio
- CHG /log legge solo la coda di ocpp.log invece dell'intero file a ogni
  refresh: con un log da 10 MB erano 10 MB letti anche per poche righe. Il
  tetto delle righe sale a 30000, il default a 2000
- ADD scorrere all'indietro nel log o iniziare una selezione mette Refresh su
  OFF, che torna da solo al valore di prima quando si e' di nuovo in fondo e
  non c'e' piu' niente selezionato. Un OFF scelto a mano resta OFF
- FIX il pannello di aggiornamento poteva restare aperto in attesa, o
  cancellarsi sotto gli occhi al controllo periodico; ora riconosce la fine
  anche dall'esito scritto da run.sh e si chiude da solo

### Add-on
- CHG mappatura "config" (deprecata) sostituita da "homeassistant_config", che
  monta la stessa cartella su /homeassistant: run.sh ricava i percorsi dal
  mount che trova, quindi i file restano dove sono e l'add-on gira anche su
  Supervisor piu' vecchi
- DEL architetture deprecate armv7 e i386: restano aarch64 e amd64
- FIX le wallbox si distinguono per il path (WALLBOX_PATH), non per la porta:
  stanno entrambe sulla 9000. LISTEN1=0 spegne il secondo socket
- FIX ocpp_verbose si fermava a 15 nello schema, ma il server arriva a 22
## [1.0.6.8] - 2026-09-05
- ADD indicatore di versione in cima: ambra con la freccia quando ci sono commit
  nuovi, cliccato apre dettagli e aggiornamento. Il confronto e' su git, non sul
  numero di versione, cosi' vale anche per un fork
- CHG auto_update aggiorna anche al controllo orario, non solo all'avvio
- CHG un aggiornamento chiesto dalla UI si allinea a origin/<ref> se il
  fast-forward non passa, e ne mostra l'esito
- CHG il controllo parte pochi secondi dopo l'avvio anche con auto_update off
- DEL opzione single_update_now: la sostituisce l'indicatore
- DEL pulsante "Update" accanto a Filter (il filtro si applica con Invio)
- CHG code_repo di default: il fork skaccox
## [1.0.6.7] - 2026-09-03
- FIX WALLBOX1_SHARE e PRIORITY_WALLBOX restavano commentate dopo il merge col
  template, e ogni riavvio le perdeva
- FIX DOCS.md dava per WALLBOX1_SHARE quote simboliche che il server rifiuta
## [1.0.6.6] - 2026-09-02
- CHG il tetto delle righe del log live passa da 5000 a 10000
- FIX il campo "Righe:" accettava valori oltre il tetto senza dirlo
## [1.0.6.5] - 2026-08-26
- FIX la riga di riepilogo delle sessioni non stava nello spazio disponibile
## [1.0.6.4] - 2026-08-25
- FIX la mappa nomi wallbox perdeva le sezioni con un commento in coda
  ("[wallbox02] ; garage")
## [1.0.6.3] - 2026-08-25
- FIX i grafici non dicevano quale wallbox aveva caricato quando nel periodo ne
  compariva una sola
## [1.0.6.2] - 2026-08-25
- FIX il merge di ocpp.ini col template copiava le chiavi senza i commenti che
  le descrivono
## [1.0.6.1] - 2026-08-25
- ADD supporto a 2 wallbox
## [1.0.4.14] - 2026-04-20
- ADD build.yaml per compatibilità Docker/BuildKit recenti
