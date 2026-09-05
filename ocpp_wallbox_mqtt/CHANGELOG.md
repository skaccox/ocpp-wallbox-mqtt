# Changelog
## [1.0.6.8] - 2026-09-05
- ADD il commit del server perl in uso e' sempre in cima, dopo l'ora: diventa
  ambra con una freccia in su quando il ref configurato e' avanti, e cliccato
  apre il pannello con i dettagli, "Check now" e l'aggiornamento. Il confronto
  e' su git (HEAD vs punta di code_ref su origin), non su un numero di
  versione, cosi' funziona anche su un fork o su un branch proprio
- DEL pulsante "Update" accanto a Filter: rileggeva il log, ma con lo stesso
  nome del nuovo aggiornamento si prestava all'equivoco. Con Refresh su OFF il
  log si rilegge confermando il filtro (Invio)
- CHG il controllo versione parte pochi secondi dopo l'avvio - e ritenta ogni
  2 minuti se la rete non e' ancora pronta - cosi' la freccia compare subito
  anche con auto_update disattivo
- DEL opzione `single_update_now`: la sostituisce l'indicatore di versione,
  che scrive un flag e fa riavviare l'add-on (il pull lo fa comunque run.sh
  alla ripartenza)
- CHG un aggiornamento chiesto dalla UI, se il fast-forward non passa, si
  allinea comunque a origin/<ref>; l'esito viene mostrato nella UI invece di
  restare solo nel log dell'add-on
- CHG auto_update non aggiorna piu' solo all'avvio: ora applica l'update anche
  al controllo orario, cosi' un add-on che non viene mai riavviato non resta
  indietro per sempre. Aspetta la fine di una ricarica in corso (un riavvio
  farebbe cadere la connessione della wallbox), non forza mai l'allineamento e
  non ritenta lo stesso commit gia' fallito, per non riavviare in ciclo
- CHG code_repo di default: il fork skaccox (multi-wallbox), come gia' scritto
  in DOCS.md
## [1.0.6.7] - 2026-09-03
- FIX WALLBOX1_SHARE e PRIORITY_WALLBOX venivano aggiunte commentate dal
  merge col template, ma per il server sono lo store of record di quota e
  priorita': commentate equivalgono ad assenti e ogni riavvio le perdeva.
  Ora vengono riattivate (solo il "#", il valore non si tocca)
- FIX DOCS.md documentava per WALLBOX1_SHARE le quote simboliche
  (EQUAL_POWER, EQUAL_PROGRESS...) che il server rifiuta leggendole come 50,
  e dava la direzione ini/MQTT invertita
## [1.0.6.6] - 2026-09-02
- CHG il tetto delle righe del log live passa da 5000 a 10000 (input, client
  e server: erano tre limiti separati, cambiarne uno non bastava)
- FIX il campo "Righe:" accettava valori oltre il tetto senza dirlo: ora viene
  riscritto col valore realmente richiesto
## [1.0.6.5] - 2026-08-26
- FIX la riga di riepilogo delle sessioni nei grafici non stava nello spazio
  disponibile: rimossa la parola "Sessione" davanti al numero e ridotto di un
  punto il font della barra statistiche
## [1.0.6.4] - 2026-08-25
- FIX la mappa nomi wallbox perdeva una sezione con un commento in coda
  all'header ("[wallbox02] ; garage"): non veniva aperta e le sue chiavi
  finivano attribuite alla sezione precedente
## [1.0.6.3] - 2026-08-25
- FIX i grafici dicevano quale wallbox aveva caricato solo se ne comparivano due
  nel periodo caricato: con una wallbox al giorno (giardino oggi, garage domani)
  ogni giorno ne aveva una sola e i due giorni si disegnavano identici, senza
  dire quale. Ora il gate guarda le wallbox configurate, non quelle nei dati
## [1.0.6.2] - 2026-08-25
- FIX il merge di ocpp.ini col template copiava le chiavi nuove senza i commenti
  che le descrivono: restava un elenco di nomi senza spiegazione
## [1.0.6.1] - 2026-08-25
- ADD supporto a 2 wallbox
## [1.0.4.14] - 2026-04-20
- ADD build.yaml per compatibilità Docker/BuildKit recenti
