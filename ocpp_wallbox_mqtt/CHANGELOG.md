# Changelog
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
