# Changelog
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
