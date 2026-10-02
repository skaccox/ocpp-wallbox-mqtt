# Changelog
## [1.7.48] - 2026-10-02
- CHG il tasto valuta passa in testa alla riga, prima di DAY, e ha un colore
  suo in tutti e due gli stati: spento e' il contorno ambra, acceso e' pieno.
  Non sceglie una vista come i pulsanti accanto, cambia che cosa dicono tutti i
  numeri della pagina - barra, grafico e tooltip - e in grigio come gli altri
  non si capiva prima di premerlo
## [1.7.47] - 2026-10-02
- CHG nella barra Grid Import viene prima di Grid Export: si chiede prima
  quanto si e' preso e poi quanto si e' restituito, ed era l'unico punto
  invertito rispetto a Buy e Sell
- CHG in denaro le caselle cambiano ordine: EV Total, Grid Import, PV Saved,
  Grid Export, Buy, Sell. Prima quello che esce, poi quello che non e' uscito
  o e' entrato, infine le tariffe, che sono ingressi del calcolo e non
  risultati. Cosi' i due valori verdi stanno insieme invece di alternarsi coi
  bianchi, e EV Total sta accanto a Grid Import di cui e' una parte. In kWh
  l'ordine resta quello di prima: li' le voci stanno in gruppi per argomento
## [1.7.46] - 2026-10-02
- CHG via dalla spiegazione di PV Charged la frase sulla divisione stimata dei
  giorni piu' vecchi: allungava il testo di tutti per un caso che riguarda
  solo i file di un vecchio formato. Col testo se ne va anche il flag che lo
  alimentava, che nessun altro leggeva
## [1.7.45] - 2026-10-02
- CHG in kWh le due voci di rete si chiamano "Import" ed "Export": sono le
  uniche che parlano di rete e l'icona lo dice gia'. In denaro restano "Grid
  Import" e "Grid Export", se no accanto a Buy e Sell quattro parole corte si
  confonderebbero fra loro
## [1.7.44] - 2026-10-02
- ADD col tasto valuta anche il grafico di settimana, mese e anno passa agli
  euro: EV Charged diventa il costo (scomposto per wallbox come prima), Grid
  Import la spesa, Grid Export l'incasso. Ogni giorno col listino di quel
  giorno, come gia' fa la barra delle statistiche
- CHG in denaro la serie Solar diventa PV Saved: la produzione non ha un
  prezzo solo, perche' una parte e' autoconsumata e una venduta, e dai file
  non si sa come si divide. PV Saved un prezzo ce l'ha
- CHG asse e tooltip del grafico seguono la modalita', e in denaro le righe
  "Max" spariscono: una potenza non ha un prezzo
- CHG il grafico del giorno resta in kW: quelle sono potenze istantanee, in
  euro diventerebbero euro all'ora. In quella vista il tasto valuta continua a
  ridisegnare solo le statistiche
## [1.7.43] - 2026-10-02
- FIX su mobile il campo della data si stringe a 104px: era largo di suo molto
  piu' del suo contenuto ("02/10/2026" e l'icona) e mandava a capo la riga
  delle frecce
## [1.7.42] - 2026-10-02
- CHG le due colonne dei prezzi si chiamano "Buy" e "Sell": in barra "Price"
  davanti non aggiungeva niente e rubava spazio
- FIX nella spiegazione di Buy e Sell l'elenco delle tariffe non e' piu' verde:
  il verde vuol dire soldi che entrano, e un prezzo d'acquisto non lo e'
- CHG la tendina bars/lines si stringe ancora (66px, 56px su mobile)
## [1.7.41] - 2026-10-02
- FIX nella vista anno EV Total e PV Saved tornano divisi per wallbox. I file
  piu' vecchi non registrano il solare per singola ricarica, e un solo giorno
  cosi' cancellava la scomposizione dell'intero periodo che lo conteneva: un
  anno ne contiene sempre uno. Ora il solare di quei giorni si divide in
  proporzione ai kWh caricati da ciascuna wallbox - quel totale e' gia' una
  stima per integrazione, dividerlo non aggiunge precisione finta - e la
  spiegazione di PV Charged avvisa quando nel periodo c'e' una stima
- CHG le colonne Price Buy e Price Sell mostrano un valore solo: la media del
  periodo, pesata sui kWh prelevati o immessi, cosi' una tariffa durata due
  giorni non pesa come una durata sei mesi. Le singole tariffe, ciascuna con la
  data da cui vale, si leggono nella spiegazione
- CHG i giorni gia' in memoria si ricalcolano: quelli salvati prima non hanno
  la scomposizione del solare
## [1.7.40] - 2026-10-02
- FIX il tasto valuta non ricarica piu' la vista: il grafico e' in kWh in
  entrambe le modalita', e rileggere i dati per ridisegnare lo stesso disegno
  faceva lampeggiare tutto. Ora cambiano solo le caselle della barra
- CHG il netto sotto PV Saved va a capo e in verde, staccato dalla
  spiegazione: e' un valore, in coda al discorso si leggeva come parte del
  testo. La spiegazione dice cosa toglie, la riga sotto mostra quanto
- CHG "Price Import" e "Price Export" diventano "Price Buy" e "Price Sell":
  in barra i nomi lunghi rubavano spazio al valore
- CHG la tendina bars/lines si stringe ancora (76px, 64px su mobile) e i due
  menu prendono l'altezza della riga, quindi restano alti come i pulsanti
  accanto anche col testo piu' piccolo
## [1.7.39] - 2026-10-02
- CHG via la colonna "PV Net": il netto passa nella spiegazione di PV Saved,
  con la scomposizione per wallbox. E' un numero che si guarda ogni tanto e in
  barra rubava spazio a quelli che si guardano sempre
- FIX nelle colonne dei prezzi la prima tariffa era in grassetto e sembrava
  piu' importante delle altre: ora tutte le righe hanno lo stesso corpo e lo
  stesso peso, anche su mobile
## [1.7.38] - 2026-10-02
- CHG il menu delle wallbox torna accanto al pulsante valuta: nella riga della
  data, con le frecce e bars/lines, su mobile mandava tutto su tre righe
- CHG le spiegazioni delle caselle cambiano con la modalita': in euro parlano
  di soldi, in kWh di energia. Prima erano testi misti "kWh: ... €: ..." e
  meta' non serviva mai
- CHG la tendina bars/lines si stringe (92px, 76px su mobile)
## [1.7.37] - 2026-10-02
- ADD casella "PV Net" accanto a PV Saved, solo in denaro: il risparmio reale
  (spesa evitata meno il mancato incasso dell'export) con la sua scomposizione
  per wallbox. Al posto della riga "net", che sotto al lordo si leggeva come un
  dettaglio mentre e' il numero che conta
- CHG in denaro i valori di PV Saved, PV Net e Grid Export sono verdi: sono
  soldi che entrano o che non escono. EV Total e Grid Import restano com'erano,
  e in kWh non cambia niente
- ADD ogni casella della barra ha la sua spiegazione: col mouse il tooltip del
  browser, al tap un riquadro - su mobile il title nativo non esiste
## [1.7.36] - 2026-10-02
- FIX nell'elenco delle tariffe la prima riga era bianca e le altre smorzate:
  stanno nel contenitore delle wallbox, che fa da dettaglio. Ora sono tutte
  bianche, perche' hanno lo stesso rango
- CHG le colonne dei prezzi portano il simbolo sul valore (0,213€) e, quando
  nel periodo la tariffa e' cambiata, elencano le righe una sotto l'altra con
  la data di decorrenza: "01/05/2026 0,213€"
## [1.7.35] - 2026-10-02
- CHG i numeri seguono la lingua del browser: in italiano i decimali hanno la
  virgola e le migliaia il punto (3,30€, 0,213, 12.345,68). Vale per tutte le
  cifre a schermo - statistiche, tooltip, sessioni - non solo per gli euro
- CHG in denaro la barra mostra solo le voci che sono soldi: Sessions, EV Max,
  PV %, PV Max e PV Total spariscono, e al loro posto compaiono Price Import e
  Price Export con le tariffe applicate nel periodo (piu' di una se e' cambiata)
- ADD price_import e price_export diventano listini: righe {from, price} con
  la data di inizio validita', gestibili dalla pagina di configurazione. Ogni
  kWh vale il prezzo in vigore il giorno in cui e' stato misurato, in tutte le
  viste e in tutti i conti (EV Total, PV Saved, netto, Grid Import/Export)
- CHG i soldi si calcolano dentro il totale del giorno e i periodi li sommano:
  prima si moltiplicava il totale per un prezzo solo, che a cavallo di un
  cambio tariffa dava un numero sbagliato
- CHG il listino entra nella chiave della cache dei giorni, come i fattori
- FIX la riga del netto finiva a volte sopra e a volte sotto la scomposizione
  per wallbox, a seconda dei periodi attraversati: decideva l'ordine di
  creazione. Ora viene riposizionata a ogni ridisegno e resta sempre la prima
  sotto al valore
## [1.7.34] - 2026-10-02
- CHG la riga del netto e' bianca piena: smorzata si confondeva con le righe
  per wallbox, che le stanno sotto alla stessa misura
- ADD opzioni grid_import_factor e grid_export_factor (default 1.0): calibrano
  i kWh di Grid Import ed Export sul contatore del distributore (tipicamente
  0.97 e 0.93). Si applicano all'origine, quindi valgono per kWh, euro,
  grafici, totali di periodo e qualunque conto derivato
- CHG i fattori fanno parte della chiave della cache dei giorni: cambiandoli i
  giorni gia' visti vengono ricalcolati invece di restare ai numeri vecchi
## [1.7.33] - 2026-10-02
- CHG in GRAPH la prima riga resta alle sole viste (DAY/WEEK/MONTH/YEAR e
  valuta): i menu wallbox e bars/lines scendono nella riga della data, col
  wallbox per primo, cosi' su mobile e' li' che la riga va a capo
- CHG il menu delle wallbox si stringe (84px, 70px su mobile): com'era non ci
  stava
- CHG la riga del netto passa da 10px a 12px: era piu' piccola delle wallbox
## [1.7.32] - 2026-10-02
- ADD in denaro "PV Charged" si chiama "PV Saved" e sotto al valore compare il
  risparmio netto (meno il mancato incasso dell'export), col tooltip che
  spiega la differenza fra lordo e netto
- CHG in denaro il simbolo di valuta lascia l'icona e si attacca ai valori
  ("46.71€"), scomposizioni per wallbox comprese
- CHG price_import di default passa da 0.25 a 0.22
## [1.7.31] - 2026-10-02
- ADD opzioni price_import, price_export e currency: il prezzo dell'energia
  comprata e di quella immessa. Servono solo alla UI, non vanno in ocpp.ini
- ADD pulsante valuta in GRAPH: la barra statistiche passa dai kWh ai soldi.
  EV Total diventa quanto e' costato caricare (il caricato meno la quota
  solare, al prezzo di acquisto), PV Charged il risparmio, Grid Import la
  spesa e Grid Export l'incasso. Le scomposizioni per wallbox seguono
- FIX in settimana e mese la scomposizione per wallbox del FV spariva appena
  un giorno del periodo non aveva ricariche: veniva trattato come "dato
  mancante" invece che come giorno a zero. Bastava una sosta per perderla
- ADD vista YEAR: dodici barre, una per mese, con le stesse statistiche e le
  stesse scomposizioni per wallbox delle altre viste
- ADD i totali dei giorni passati finiscono in cache nel browser: un anno
  sarebbero oltre mille richieste a ogni apertura, e un giorno chiuso non
  cambia piu'. Oggi non viene mai messo in cache
## [1.7.30] - 2026-10-01
- CHG le label della barra statistiche non hanno piu' i due punti
- CHG "PV %" torna col simbolo sui valori ("98%", "Giardino 98%") e l'unita'
  nella label: lo spazio recuperato lo consente
- CHG mappatura "config" (deprecata) sostituita da "homeassistant_config", che
  monta la stessa cartella su /homeassistant: run.sh ora ricava i percorsi dal
  mount che trova, quindi i file restano dove sono e l'add-on gira anche su
  Supervisor piu' vecchi
- DEL architetture deprecate armv7 e i386: restano aarch64 e amd64
## [1.7.29] - 2026-10-01
- CHG anche il simbolo "%" sale accanto all'icona: valore e righe per wallbox
  restano nudi ("98", "Giardino 98") e il titolo si accorcia a "PV"
- CHG su mobile la barra statistiche stringe: padding orizzontale 6px -> 4px,
  spazio fra le voci 8px -> 6px, unita' accanto all'icona a 8.5px
## [1.7.28] - 2026-10-01
- CHG le righe per wallbox su mobile passano da 8.5px a 9.5px
## [1.7.27] - 2026-10-01
- FIX su mobile le righe per wallbox restavano a 12px: la regola stava prima di
  quella base e a parita' di specificita' perdeva. Spostata dopo, con selettore
  piu' forte, e portata a 8.5px
## [1.7.26] - 2026-10-01
- FIX l'unita' di misura era finita nel titolo ("EV Max (kW)"), allungandolo:
  ora sta accanto all'icona, sulla riga sopra, che era vuota
## [1.7.25] - 2026-10-01
- CHG l'unita' di misura sta nell'etichetta accanto all'icona ("EV Max (kW)",
  "PV Charged (kWh)"): i valori e le righe per wallbox restano nudi, e in
  colonna ci stanno molto meglio. "PV %" resta col simbolo sul valore
## [1.7.24] - 2026-10-01
- CHG le voci per wallbox portano l'unita' di misura ("Giardino 14.98 kWh"),
  come il valore sopra
- CHG su mobile quelle righe scendono a 9.5px: con l'unita' si allungano e in
  cima lo spazio e' poco
## [1.7.23] - 2026-10-01
- FIX i totali di sessione leggevano l'ultimo campione dei contatori col 10/11,
  ma ai confini il file porta la riga di apertura della sessione dopo (kWh gia'
  a zero) e quelle di chiusura (kWh azzerato, FV no). Sul 26/09 usciva
  EV Total 0.54 kWh con PV Charged 14.70 e PV% 2703%: ora 14.98 kWh e 98%.
  Si scarta quanto precede la ripartenza da zero e si prende il massimo
- ADD scomposizione per wallbox anche su "PV Charged" (kWh) e "PV %", dove la
  percentuale di ciascuna e' sul proprio caricato. Compare solo se il dato
  viene dalle sessioni (col 11): con la stima per integrazione la rete e' una
  sola e dividerla sarebbe inventato
- CHG via il puntino fra le due wallbox: sono incolonnate e il separatore non
  serve piu'
- CHG su desktop le righe per wallbox passano a 12px (erano ~10px)
- FIX passando a un giorno senza dati restavano a schermo le righe per wallbox
  del giorno prima, sotto a un "—"
## [1.7.22] - 2026-10-01
- CHG nel tooltip del grafico giornaliero resta la sola riga EV, con i valori
  delle due wallbox fra parentesi: tre voci per lo stesso istante erano rumore
- CHG con una sola wallbox nei dati la curva si chiama col suo nome ("Garage
  Power") invece di "EV Power", che sarebbe il totale di una cosa sola
- ADD filtro wallbox in GRAPH (BOTH di default, compare solo con due wallbox):
  scegliendone una, grafico e barre mostrano solo quella
- CHG la scomposizione di "EV Total" non e' piu' fra parentesi e su mobile le
  due wallbox vanno una sotto l'altra
- CHG il nome della wallbox e' sempre con l'iniziale maiuscola, ovunque compaia
## [1.7.21] - 2026-09-25
- FIX nel grafico giornaliero le linee per-wallbox finivano sotto la curva
  verde del totale: il tooltip mostrava il colore giusto (garage viola) ma a
  schermo si vedeva solo il verde. Ora sono disegnate sopra
## [1.7.20] - 2026-09-21
- CHG le righe del log partono da 2000 invece che da 800 (campo, ripiego del
  client e default di /log, che erano tre numeri diversi)
## [1.7.19] - 2026-09-15
- ADD il Refresh messo su OFF dallo scroll o da una selezione torna da solo al
  valore di prima quando si e' di nuovo in fondo al log e non c'e' piu' niente
  selezionato. Un OFF scelto a mano resta OFF
## [1.7.18] - 2026-09-15
- CHG /log legge solo la coda di ocpp.log invece dell'intero file a ogni
  refresh: con un log da 10 MB erano 10 MB letti anche per 800 righe
- CHG il tetto delle righe del log passa da 10000 a 30000 (input, client e
  server: sono tre limiti separati)
- ADD scorrere all'indietro nel log o iniziare una selezione mette Refresh su
  OFF: durante un copia-incolla l'auto-refresh riscriveva il box e la selezione
  saltava. Si riaccende dal menu a tendina
## [1.7.17] - 2026-09-07
- FIX premendo "Check now" e subito dopo UPDATE NOW, il ridisegno differito del
  messaggio verde rimetteva a schermo il pannello con "Update now" mentre
  l'aggiornamento era in corso
## [1.7.16] - 2026-09-07
- FIX il pannello poteva restare aperto in attesa: la fine si riconosceva solo
  dal commit cambiato, ora vale anche l'esito scritto da run.sh, quindi si
  chiude anche quando il commit resta lo stesso
- CHG finito l'aggiornamento il pannello si chiude da solo dopo un paio di
  secondi, invece di aspettare un click
- CHG l'attesa massima scende da 4 minuti a 90 secondi e il messaggio dice cosa
  fare invece di dare l'add-on per morto
- FIX il controllo periodico ridisegnava il pannello anche quando mostrava
  l'esito di un aggiornamento, cancellandolo sotto gli occhi
## [1.7.15] - 2026-09-07
- ADD "Check now" conferma di aver controllato con una riga verde per qualche
  secondo: senza aggiornamenti il pannello restava identico e sembrava inerte
## [1.7.14] - 2026-09-07
- FIX durante l'aggiornamento nel box del log compariva l'HTML della pagina di
  errore dell'ingress: ora la risposta viene verificata (stato e tipo) e le
  ultime righe buone restano a schermo con la nota "aggiornamento in corso"
- CHG a riavvio finito il log viene riletto subito, anche con Refresh su OFF
## [1.7.13] - 2026-09-07
- FIX cambiare "Righe:" non ricaricava il log: con Refresh su OFF non succedeva
  proprio niente
## [1.7.12] - 2026-09-05
- DEL via l'orologio dall'header: su mobile finiva sopra la versione. Quello
  spazio ora serve solo a dire che il log non si aggiorna piu'
- FIX su mobile il pannello sforava a destra e faceva comparire lo scroll
  orizzontale: ora e' centrato sotto l'header
## [1.7.11] - 2026-09-05
- CHG "Increasing to" celeste invece dell'azzurro
## [1.7.10] - 2026-09-05
- CHG nel pannello l'azione sta a sinistra e Close sempre a destra
- CHG il pannello non parla piu' di riavvio: dice solo di premere UPDATE NOW
## [1.7.8] - 2026-09-05
- CHG colori del log: "Increasing to" azzurro (era il verde delle CHG), ERROR
  viola, "grid safe limit exceeded" in grassetto
- CHG "Check now" verde in outline: l'ambra resta a "Update now"
- FIX tolto l'avviso "il riavvio interrompe la ricarica": non e' vero
## [1.7.7] - 2026-09-05
- FIX le wallbox si distinguono per il path (WALLBOX_PATH), non per la porta:
  stanno entrambe sulla 9000
- DOC LISTEN1=0 spegne il secondo socket
## [1.7.6] - 2026-09-05
- FIX l'oggetto del commit usciva dal pannello invece di andare a capo (nowrap
  ereditato da .topline)
## [1.7.5] - 2026-09-05
- CHG l'aggiornamento non ricarica piu' la pagina: gli asset stanno
  nell'immagine dell'add-on e non cambiano
- DEL via il ripristino della vista di 1.7.3: senza reload non serve
## [1.7.4] - 2026-09-05
- FIX ocpp_verbose si fermava a 15 nello schema, ma il server arriva a 22
## [1.7.3] - 2026-09-05
- FIX dopo l'aggiornamento si tornava a default_view invece che alla vista aperta
## [1.7.2] - 2026-09-05
- CHG versione prima dell'ora: in GRAPH l'ora sparisce e la versione saltava
## [1.7.1] - 2026-09-05
- FIX in GRAPH il pannello finiva dietro al grafico (z-index dell'header)
## [1.7.0] - 2026-09-05
- ADD in cima il numero di versione del server invece dello sha del commit
- FIX e' il massimo di $VERSION{MAIN|INI|FUNC|MQTT|WS} confrontati come
  stringhe, lo stesso numero pubblicato su ocpp/heartbeat (usciva il solo MAIN)
- ADD nel pannello la versione remota, il repo e il ref: si vede cosa si
  installerebbe, e da dove
- CHG su mobile l'etichetta si tronca invece di sparire
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
