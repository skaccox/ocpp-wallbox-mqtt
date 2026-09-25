# Changelog
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
