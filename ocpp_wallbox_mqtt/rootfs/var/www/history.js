let historyChart = null;
let currentDate = new Date();
let viewMode = "day";

// "both" oppure l'id di sezione di una wallbox: con il filtro attivo il
// grafico mostra solo quella. Le statistiche restano quelle del periodo.
let wbFilter = "both";

// Statistiche in denaro invece che in energia. I prezzi arrivano dalle opzioni
// dell'add-on, iniettati nella pagina come window.OCPP_PRICES.
let moneyMode = false;

// Ultimi soldi calcolati: la spiegazione di PV Saved mostra anche il netto, e
// viene riscritta sia quando cambiano i dati sia quando si cambia modalita'.
let lastMoney = null;

// Come ridisegnare le sole caselle della barra con i dati gia' in mano. Il
// grafico e' in kWh in entrambe le modalita': rileggere tutto per cambiare
// valuta faceva lampeggiare un disegno identico a quello di prima.
let lastStats = null;

// Vero quando nel periodo c'e' almeno un giorno con la scomposizione del FV
// stimata invece che letta: la spiegazione di PV Charged lo dice.
let lastPvEst = false;

// Come ridisegnare il grafico a periodo quando cambia la valuta. Resta null
// nella vista giorno: li' le curve sono potenze istantanee in kW, e una
// potenza in euro diventerebbe EUR/h, che non vuol dire niente.
let lastChart = null;

// Calibrazione dei kWh di rete sul contatore del distributore. Vale solo per
// Grid Import e Grid Export: EV e FV arrivano da altri sensori e non si
// toccano. Si applica all'origine, dove l'energia viene integrata, cosi' ogni
// conto a valle - statistiche, euro, barre, totali di periodo - la eredita.
function gridFactors(){
  const f = (typeof window !== "undefined" && window.OCPP_GRID_FACTORS) || {};
  return {
    imp: Number(f.import) > 0 ? Number(f.import) : 1,
    exp: Number(f.export) > 0 ? Number(f.export) : 1
  };
}

// Listini: righe {from, price} ordinate per data, con "from" in forma
// compatta (20260501) come le chiavi dei file giornalieri.
function priceTables(){
  const p = (typeof window !== "undefined" && window.OCPP_PRICES) || {};
  return {
    imp: Array.isArray(p.import) ? p.import : [],
    exp: Array.isArray(p.export) ? p.export : [],
    cur: p.currency || "€"
  };
}

// Prezzo valido in un giorno: l'ultima riga con decorrenza <= quel giorno.
// Prima della prima riga vale la prima, altrimenti un listino che parte a
// maggio lascerebbe aprile a zero.
function priceRowAt(rows, ymd){
  if (!rows || !rows.length) return null;

  let row = rows[0];
  for (const r of rows) {
    if (r.from <= ymd) row = r; else break;
  }
  return row;
}

function priceAt(rows, ymd){
  const r = priceRowAt(rows, ymd);
  return r ? r.price : 0;
}

// I soldi di UN giorno, col listino di quel giorno. Vanno calcolati qui e non
// a valle: i totali di settimana, mese e anno sommano giorni che possono
// cadere su tariffe diverse, e moltiplicare il totale per un prezzo solo
// darebbe un numero sbagliato a ogni cambio di listino.
function dayMoney(ymd, t){
  const p = priceTables();
  const ri = priceRowAt(p.imp, ymd);
  const re = priceRowAt(p.exp, ymd);
  const pi = ri ? ri.price : 0;
  const pe = re ? re.price : 0;

  const ev = t.chargeKwh || 0;
  const pv = t.pvChargedKwh || 0;

  const out = {
    // le RIGHE di listino usate, non solo il numero: senza la data di
    // decorrenza un elenco di prezzi non dice quale ha agito quando
    pricesImport: ri ? [ri] : [],
    pricesExport: re ? [re] : [],

    costEv:        Math.max(0, ev - pv) * pi,
    savingPv:      pv * pi,
    netPv:         pv * Math.max(0, pi - pe),
    costImport:    (t.importKwh || 0) * pi,
    revenueExport: (t.exportKwh || 0) * pe,
    costByWb:   null,
    savingByWb: null,
    netByWb:    null
  };

  // il costo per wallbox ha bisogno della quota solare di ciascuna
  if (t.pvChargedByWb) {
    out.costByWb = {};
    out.savingByWb = {};
    out.netByWb = {};
    for (const wb of Object.keys(t.chargeByWb || {})) {
      out.costByWb[wb] = Math.max(0, (t.chargeByWb[wb] || 0) - (t.pvChargedByWb[wb] || 0)) * pi;
    }
    for (const wb of Object.keys(t.pvChargedByWb)) {
      out.savingByWb[wb] = (t.pvChargedByWb[wb] || 0) * pi;
      out.netByWb[wb]    = (t.pvChargedByWb[wb] || 0) * Math.max(0, pi - pe);
    }
  }

  return out;
}

// Somma i soldi di piu' giorni. La scomposizione per wallbox sopravvive solo
// se ce l'hanno tutti, come per i kWh.
function mergeMoney(list){
  const ok = (list || []).filter(Boolean);
  if (!ok.length) return null;

  const sum = k => ok.reduce((a, m) => a + (m[k] || 0), 0);
  const splitOk = ok.every(m => m.costByWb);

  // righe distinte nell'ordine in cui sono comparse, cioe' cronologico
  const listino = (k) => {
    const out = [];
    for (const m of ok) {
      for (const r of (m[k] || [])) {
        if (!out.some(x => x.from === r.from && x.price === r.price)) out.push(r);
      }
    }
    return out;
  };

  return {
    pricesImport: listino("pricesImport"),
    pricesExport: listino("pricesExport"),
    costEv:        sum("costEv"),
    savingPv:      sum("savingPv"),
    netPv:         sum("netPv"),
    costImport:    sum("costImport"),
    revenueExport: sum("revenueExport"),
    costByWb:   splitOk ? mergeKwhByWallbox(ok.map(m => m.costByWb))   : null,
    savingByWb: splitOk ? mergeKwhByWallbox(ok.map(m => m.savingByWb)) : null,
    netByWb:    splitOk ? mergeKwhByWallbox(ok.map(m => m.netByWb))    : null
  };
}

// Energia o denaro, secondo la modalita'. Il prezzo e' quello della voce:
// acquisto per quel che si preleva, vendita per quel che si immette.
// kWh o soldi gia' calcolati: in denaro il valore arriva dal totale del
// giorno, non da una moltiplicazione fatta qui.
function fmtEnergy(kwh, money){
  return moneyMode ? fmtMoney(money) : fmtNum(kwh, 2);
}

// Le quattro voci convertibili cambiano insieme al contenuto. In denaro
// l'unita' accanto all'icona sparisce: il simbolo sta attaccato ai valori
// ("46.71€"), che e' come si legge una cifra.
function applyUnits(){
  const cur = priceTables().cur;

  for (const id of ["uCharged", "uPvCharged", "uGridExport", "uGridImport"]) {
    const el = document.getElementById(id);
    if (el) el.textContent = moneyMode ? "" : "kWh";
  }

  // in denaro non e' piu' "quanto solare e' entrato" ma "quanto ha fatto
  // risparmiare", e il nome deve dirlo
  const lbl = document.getElementById("lblPvCharged");
  if (lbl) lbl.textContent = moneyMode ? "PV Saved" : "PV Charged";

  // In kWh "Grid" non serve: sono le uniche due voci che parlano di rete e
  // l'icona lo dice gia'. In denaro resta, se no accanto a Buy e Sell quattro
  // parole corte - Import, Export, Buy, Sell - si confonderebbero fra loro.
  for (const voce of ["Import", "Export"]) {
    const el = document.getElementById(`lblGrid${voce}`);
    if (el) el.textContent = moneyMode ? `Grid ${voce}` : voce;
  }

  for (const id of ["uPriceImport", "uPriceExport"]) {
    const el = document.getElementById(id);
    if (el) el.textContent = "/kWh";
  }

  // In denaro restano solo le voci che SONO soldi: un conteggio di sessioni o
  // una potenza di picco non hanno un prezzo, e in mezzo agli euro
  // confondono. Al loro posto compaiono le tariffe applicate.
  for (const id of ["statSessions", "statEv", "statPvChargedPct",
                    "statPvMax", "statSolar"]) {
    const host = document.getElementById(id)?.parentElement;
    if (host) host.style.display = moneyMode ? "none" : "";
  }
  for (const id of ["statPriceImport", "statPriceExport"]) {
    const host = document.getElementById(id)?.parentElement;
    if (host) host.style.display = moneyMode ? "" : "none";
  }

  // verde su quello che entra o non esce; il costo resta del colore normale
  for (const id of ["statPvCharged", "statGridExport"]) {
    const host = document.getElementById(id)?.parentElement;
    if (host) host.classList.toggle("gain", moneyMode);
  }

  applyStatTips();

  const btn = document.getElementById("btnMoney");
  if (btn) {
    btn.textContent = cur;
    btn.classList.toggle("active", moneyMode);
  }
}

// "01/05/2026" dalla forma compatta, nel formato della lingua del browser
function fmtYmd(ymd){
  const s = String(ymd || "");
  if (s.length !== 8) return "";

  const d = new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
  return isNaN(d) ? "" : d.toLocaleDateString(undefined, {
    day: "2-digit", month: "2-digit", year: "numeric"
  });
}

function fmtPrice(v){
  return fmtNum(v, 3) + priceTables().cur;
}

// Prezzo medio davvero pagato (o incassato) nel periodo: soldi diviso kWh.
// Con piu' tariffe la media semplice direbbe un'altra cosa, perche' una
// tariffa durata due giorni non pesa come una durata sei mesi.
//
// Senza energia nel periodo non c'e' niente da pesare: vale la tariffa in
// vigore alla fine, che e' quella che si applicherebbe adesso.
function prezzoMedio(rows, soldi, kwh){
  const list = rows || [];
  if (kwh > 0 && soldi > 0) return soldi / kwh;
  return list.length ? list[list.length - 1].price : null;
}

function setPriceStat(id, media){
  if (!document.getElementById(id)) return;
  setStatWithSplit(id, media == null ? "—" : fmtPrice(media), []);
}

// Una spiegazione per modalita': in euro la casella misura un'altra cosa, e
// un testo unico costringerebbe a leggere anche la meta' che non serve.
const STAT_TIPS = {
  statSessions: {
    kwh: "Numero di ricariche nel periodo."
  },
  statEv: {
    kwh: "Potenza massima di ricarica raggiunta."
  },
  statCharged: {
    kwh: "Energia totale caricata nelle auto.",
    eur: "Costo della ricarica: la sola parte presa dalla rete, al prezzo d'acquisto. Il solare non si paga."
  },
  statPvCharged: {
    kwh: "Energia solare caricata nelle auto.",
    eur: "Spesa evitata: quanto avresti pagato comprando dalla rete l'energia solare finita nelle auto. Il netto toglie il mancato incasso dell'export."
  },
  statPvChargedPct: {
    kwh: "Quota della ricarica coperta dal solare."
  },
  statPvMax: {
    kwh: "Potenza massima prodotta dal fotovoltaico."
  },
  statSolar: {
    kwh: "Energia totale prodotta dal fotovoltaico."
  },
  statGridExport: {
    kwh: "Energia immessa in rete.",
    eur: "Incasso stimato per l'energia immessa, al prezzo di vendita."
  },
  statGridImport: {
    kwh: "Energia prelevata dalla rete.",
    eur: "Costo dell'energia prelevata, al prezzo d'acquisto (energia, oneri, accise e IVA; escluse quota fissa e potenza)."
  },
  statPriceImport: {
    eur: "Prezzo d'acquisto medio del periodo, pesato sui kWh prelevati."
  },
  statPriceExport: {
    eur: "Prezzo di vendita medio del periodo, pesato sui kWh immessi."
  }
};

function applyStatTips(){
  for (const [id, testi] of Object.entries(STAT_TIPS)) {
    const host = document.getElementById(id)?.parentElement;
    if (!host) continue;

    let testo = (moneyMode ? testi.eur : testi.kwh) || testi.kwh || testi.eur || "";

    // Una scomposizione stimata non si distingue a vederla: va detto.
    if ((id === "statPvCharged" || id === "statPvChargedPct") && lastPvEst) {
      testo += " Per i giorni piu' vecchi la divisione fra wallbox e' stimata:"
             + " quei file non registrano il solare di ogni singola ricarica.";
    }

    // Il risparmio netto sta qui invece che in una casella sua: e' un numero
    // che si guarda una volta ogni tanto, e in barra rubava spazio a quelli
    // che si guardano sempre. Sta su una riga sua perche' e' un valore, e in
    // coda alla spiegazione si leggeva come parte del discorso.
    let guadagno = "";
    if (id === "statPvCharged" && moneyMode && lastMoney && lastMoney.netPv > 0) {
      const perWb = wbBreakdownParts(lastMoney.netByWb || null, priceTables().cur);
      guadagno = `Netto ${fmtMoney(lastMoney.netPv)}`;
      if (perWb.length) guadagno += ` (${perWb.join(" · ")})`;
    }

    // In barra il prezzo e' uno solo, la media del periodo: le tariffe che
    // l'hanno composta stanno qui, ciascuna con la data da cui vale. Una
    // tariffa sola non si elenca, il valore in barra e' gia' quella.
    const elenco = id === "statPriceImport" ? lastMoney?.pricesImport
                 : id === "statPriceExport" ? lastMoney?.pricesExport
                 : null;
    const tariffe = (moneyMode && elenco && elenco.length > 1)
      ? elenco.map(r => `${fmtYmd(r.from)} ${fmtPrice(r.price)}`).join("\n")
      : "";

    host.dataset.tipMain = testo;
    host.dataset.tipNet = guadagno;
    host.dataset.tipList = tariffe;

    const coda = guadagno || tariffe;
    host.title = coda ? testo + "\n" + coda : testo;
  }
}

// Il title nativo si vede solo col mouse: su mobile serve un riquadro vero.
// Resta uno solo, riusato da tutte le caselle.
function setupStatTips(){
  const bar = document.getElementById("historyStats");
  if (!bar || bar.dataset.tips) return;
  bar.dataset.tips = "1";

  const tip = document.createElement("div");
  tip.className = "statTip";
  tip.style.display = "none";
  document.body.appendChild(tip);

  let timer = null;
  const chiudi = () => { tip.style.display = "none"; clearTimeout(timer); };

  bar.addEventListener("click", (ev) => {
    const box = ev.target.closest("span[title]");
    if (!box || !box.title) { chiudi(); return; }

    ev.stopPropagation();

    tip.textContent = "";
    const main = document.createElement("div");
    main.textContent = box.dataset.tipMain || box.title;
    tip.appendChild(main);

    if (box.dataset.tipNet) {
      const net = document.createElement("div");
      net.className = "tipNet";
      net.textContent = box.dataset.tipNet;
      tip.appendChild(net);
    }

    if (box.dataset.tipList) {
      const righe = document.createElement("div");
      righe.className = "tipList";
      righe.textContent = box.dataset.tipList;
      tip.appendChild(righe);
    }

    tip.style.display = "block";

    // sotto la casella, ma dentro lo schermo
    const r = box.getBoundingClientRect();
    const w = tip.offsetWidth;
    const left = Math.max(10, Math.min(r.left + r.width / 2 - w / 2,
                                       window.innerWidth - w - 10));
    tip.style.left = `${left}px`;
    tip.style.top = `${r.bottom + 8}px`;

    clearTimeout(timer);
    timer = setTimeout(chiudi, 6000);
  });

  document.addEventListener("click", chiudi);
}

setupStatTips();

function setPriceStats(money, energie){
  const m = money || {};
  const e = energie || {};

  setPriceStat("statPriceImport",
               prezzoMedio(m.pricesImport, m.costImport, e.imp));
  setPriceStat("statPriceExport",
               prezzoMedio(m.pricesExport, m.revenueExport, e.exp));

  // le singole tariffe, con la loro data, stanno nella spiegazione
  lastMoney = money || lastMoney;
  applyStatTips();
}

// Valore in denaro: simbolo attaccato, senza spazio.
// Numeri nella lingua del browser: in italiano i decimali vogliono la virgola
// e le migliaia il punto, mentre toFixed dà sempre il punto. Vale per tutte le
// cifre a schermo, non solo per gli euro: averne due convenzioni nella stessa
// riga sarebbe peggio che averne una sbagliata.
function fmtNum(v, dec){
  const n = Number(v) || 0;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec
  });
}

function fmtMoney(v){
  return fmtNum(v, 2) + priceTables().cur;
}
let chartTypeMode = "bars";
const chartTypeDefaults = { day: "bars", week: "bars", month: "lines", year: "bars" };

function updateChartTypeActive() {
  const sel = document.getElementById("chartType");
  if (!sel) return;
  sel.classList.toggle("active", sel.value !== (chartTypeDefaults[viewMode] || "bars"));
}

document.addEventListener("DOMContentLoaded", () => {

  const btnLive = document.getElementById("btnLive");
  const btnHistory = document.getElementById("btnHistory");
  const logDiv = document.getElementById("log");
  const chartWrap = document.getElementById("chartWrap");


  const datePicker = document.getElementById("datePicker");
  datePicker.valueAsDate = currentDate;

  const today = new Date();
  datePicker.max = today.toISOString().split("T")[0];

  // Filtro wallbox: esiste solo se l'impianto ne ha piu' di una, altrimenti
  // non c'e' niente da scegliere. Di default sono mostrate entrambe.
  (function setupWbFilter(){
    const sel = document.getElementById("wbFilter");
    if (!sel) return;

    const keys = Object.keys(window.OCPP_WALLBOX_NAMES || {}).sort();
    if (keys.length < 2) { sel.style.display = "none"; return; }

    sel.innerHTML = "";
    const both = document.createElement("option");
    both.value = "both";
    both.textContent = "BOTH";
    sel.appendChild(both);

    for (const wb of keys) {
      const o = document.createElement("option");
      o.value = wb;
      o.textContent = wbShort(wb).toUpperCase();
      sel.appendChild(o);
    }

    sel.value = wbFilter;
    sel.style.display = "";
    sel.addEventListener("change", () => {
      wbFilter = sel.value;
      sel.classList.toggle("active", wbFilter !== "both");
      loadCurrentView();
    });
  })();


function loadCurrentView() {
  if (viewMode === "day")   loadHistoryForDate(currentDate);
  else if (viewMode === "week")  loadHistoryForWeek(currentDate);
  else if (viewMode === "month") loadHistoryForMonth(currentDate);
  else if (viewMode === "year")  loadHistoryForYear(currentDate);
}

function setViewMode(mode) {
  viewMode = mode;
  document.getElementById("btnDay").classList.toggle("active",   mode === "day");
  document.getElementById("btnWeek").classList.toggle("active",  mode === "week");
  document.getElementById("btnMonth").classList.toggle("active", mode === "month");
  document.getElementById("btnYear").classList.toggle("active",  mode === "year");
  // giorno e settimana si scelgono dal calendario, mese e anno dalle frecce
  document.getElementById("datePicker").style.display =
    (mode === "month" || mode === "year") ? "none" : "";
  chartTypeMode = chartTypeDefaults[mode] || "bars";
  const sel = document.getElementById("chartType");
  if (sel) {
    sel.value = chartTypeMode;
    sel.style.display = mode === "day" ? "none" : "";
    updateChartTypeActive();
  }
  loadCurrentView();
}

document.getElementById("btnDay").onclick   = () => setViewMode("day");
document.getElementById("btnWeek").onclick  = () => setViewMode("week");
document.getElementById("btnMonth").onclick = () => setViewMode("month");
document.getElementById("btnYear").onclick  = () => setViewMode("year");

document.getElementById("btnMoney").onclick = () => {
  moneyMode = !moneyMode;
  applyUnits();

  if (lastStats) lastStats();
  else loadCurrentView();

  if (lastChart) lastChart();
};

applyUnits();   // simbolo di valuta sul pulsante fin da subito

document.getElementById("todayBtn").onclick = () => {
  currentDate = new Date();
  datePicker.valueAsDate = currentDate;
  loadCurrentView();
  updateTodayHighlight();
};

document.getElementById("chartType").onchange = (e) => {
  chartTypeMode = e.target.value;
  updateChartTypeActive();
  applyChartTypeMode();
};

  function switchToGraph() {
    if (window.stopLive) window.stopLive();
    document.body.classList.add("history-mode");

    document.getElementById("powerChart").style.display = "none";
    document.getElementById("historyWrap").style.display = "block";
    document.getElementById("historyHeader").style.display = "block";
    document.getElementById("historyControls").style.display = "flex";

    document.querySelector(".line2").style.display = "none";
    document.querySelector(".wide").style.display = "none";
    document.querySelector(".metrics").style.display = "none";

    window.currentMode = "history";
    btnHistory.classList.add("active");
    btnLive.classList.remove("active");

    logDiv.style.display = "none";
    chartWrap.classList.add("fullscreen");

    loadHistoryForDate(currentDate);
  }

  function switchToLive() {
    if (window.startLive) window.startLive();
    document.body.classList.remove("history-mode");

    document.getElementById("powerChart").style.display = "block";
    document.getElementById("historyWrap").style.display = "none";
    document.getElementById("historyHeader").style.display = "none";
    document.getElementById("historyControls").style.display = "none";

    document.querySelector(".line2").style.display = "";
    document.querySelector(".wide").style.display = "";
    document.querySelector(".metrics").style.display = "";

    window.currentMode = "live";
    btnLive.classList.add("active");
    btnHistory.classList.remove("active");

    chartWrap.classList.remove("fullscreen");
    logDiv.style.display = "block";

    if (window.resizeBigChart) window.resizeBigChart();
    if (historyChart) historyChart.destroy();
    load();
  }

  btnHistory.onclick = switchToGraph;
  btnLive.onclick = switchToLive;

  if (window.OCPP_DEFAULT_VIEW === "graph") switchToGraph();

  document.getElementById("prevDay").onclick = () => {
    if (viewMode === "week")       currentDate.setDate(currentDate.getDate() - 7);
    else if (viewMode === "month") currentDate.setMonth(currentDate.getMonth() - 1);
    else if (viewMode === "year")  currentDate.setFullYear(currentDate.getFullYear() - 1);
    else                           currentDate.setDate(currentDate.getDate() - 1);
    datePicker.valueAsDate = currentDate;
    loadCurrentView();
    updateTodayHighlight();
  };

  document.getElementById("nextDay").onclick = () => {
    const today = new Date();
    const next = new Date(currentDate);
    if (viewMode === "week")       next.setDate(next.getDate() + 7);
    else if (viewMode === "month") next.setMonth(next.getMonth() + 1);
    else if (viewMode === "year")  next.setFullYear(next.getFullYear() + 1);
    else                           next.setDate(next.getDate() + 1);

    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const nextOnly  = new Date(next.getFullYear(), next.getMonth(), next.getDate());
    if (nextOnly > todayOnly) return;

    currentDate = next;
    datePicker.valueAsDate = currentDate;
    loadCurrentView();
    updateTodayHighlight();
  };

  datePicker.onchange = () => {
    const selected = datePicker.valueAsDate;
    const today = new Date();
    const selectedOnly = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate());
    const todayOnly    = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (selectedOnly > todayOnly) {
      datePicker.valueAsDate = todayOnly;
      currentDate = todayOnly;
    } else {
      currentDate = selectedOnly;
    }
    loadCurrentView();
    updateTodayHighlight();
  };


  
});


window.zeroLinePlugin = {
  id: "zeroLine",
  afterDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    const y = scales.yPower;
    const x = scales.x;

    if (!y || !x) return;

    const yZero = y.getPixelForValue(0);

    if (yZero < chartArea.top || yZero > chartArea.bottom) return;

    ctx.save();
    ctx.setLineDash([6,4]);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(chartArea.left, yZero);
    ctx.lineTo(chartArea.right, yZero);
    ctx.stroke();
    ctx.setLineDash([]);

    // su mobile non c'è spazio per le etichette orarie
    if (chart.width < 520) {
      ctx.restore();
      return;
    }

    // etichette orarie sulla linea dello 0
    const ticks = x.ticks;
    if (ticks && ticks.length) {
      ctx.font = "11px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";

      for (const tick of ticks) {
        const xPx = x.getPixelForValue(tick.value);
        if (xPx < chartArea.left || xPx > chartArea.right) continue;

        const label = new Date(tick.value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        // piccolo tick mark
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xPx, yZero - 3);
        ctx.lineTo(xPx, yZero + 3);
        ctx.stroke();

        // testo sopra la linea
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillText(label, xPx, yZero - 5);
      }
    }

    ctx.restore();
  }
};



// ===== WEEKLY / MONTHLY VIEW =====

// Un giorno passato non cambia piu', ma ricalcolarlo costa tre fetch e il
// parse dei relativi file. La vista anno ne vorrebbe oltre mille, quindi i
// giorni chiusi si tengono da parte. Oggi no: e' ancora in corso.
// I fattori fanno parte della chiave: cambiandoli i giorni gia' in cache
// sarebbero rimasti ai numeri vecchi.
const DAY_CACHE = "ocppDayTotals2:";

// Impronta del listino: cambiando un prezzo i giorni in cache tornerebbero
// coi soldi vecchi, visto che ora li contengono.
function priceFingerprint(){
  const p = priceTables();
  const s = JSON.stringify([p.imp, p.exp, p.cur]);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function dayCacheKey(ymd){
  const f = gridFactors();
  return `${DAY_CACHE}${f.imp}:${f.exp}:${priceFingerprint()}:${ymd}`;
}

function todayYmd(){
  return ymdParts(new Date()).ymd;
}

function cachedTotals(ymd){
  if (ymd >= todayYmd()) return null;
  try {
    const raw = localStorage.getItem(dayCacheKey(ymd));
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function storeTotals(ymd, t){
  if (ymd >= todayYmd() || !t) return;
  try { localStorage.setItem(dayCacheKey(ymd), JSON.stringify(t)); } catch (e) {}
}

// Somma di piu' giorni in un totale solo: i massimi restano massimi, le
// scomposizioni si fondono, e il FV per wallbox sparisce se anche un solo
// giorno non ce l'ha (stessa regola di updatePeriodStats).
function mergeTotals(list){
  const ok = (list || []).filter(t => t?.hasData);
  if (!ok.length) {
    return { chargeKwh: 0, solarKwh: 0, importKwh: 0, exportKwh: 0,
             pvChargedKwh: 0, evMaxKw: 0, pvMaxKw: 0, sessionCount: 0,
             hasData: false };
  }

  const sum = k => ok.reduce((a, t) => a + (t[k] || 0), 0);
  const max = k => ok.reduce((a, t) => Math.max(a, t[k] || 0), 0);

  return {
    chargeKwh: sum("chargeKwh"),
    solarKwh:  sum("solarKwh"),
    importKwh: sum("importKwh"),
    exportKwh: sum("exportKwh"),
    pvChargedKwh: sum("pvChargedKwh"),
    evMaxKw: max("evMaxKw"),
    pvMaxKw: max("pvMaxKw"),
    sessionCount: sum("sessionCount"),
    chargeByWb: mergeKwhByWallbox(ok.map(t => t.chargeByWb)),
    pvChargedByWb: ok.every(t => t.pvChargedByWb)
      ? mergeKwhByWallbox(ok.map(t => t.pvChargedByWb))
      : null,
    pvSplitEst: ok.some(t => t.pvSplitEst),
    money: mergeMoney(ok.map(t => t.money)),
    hasData: true
  };
}

async function computeDailyTotals(d) {
  const { y, ymd } = ymdParts(d);

  const cached = cachedTotals(ymd);
  if (cached) return cached;

  const bust = `?_=${Date.now()}`;
  try {
    const [chargeResp, meterResp, solarResp] = await Promise.all([
      fetch(`data/${y}/${ymd}_charge.dat${bust}`, { cache: "no-store" }),
      fetch(`data/${y}/${ymd}_meter.dat${bust}`,  { cache: "no-store" }),
      fetch(`data/${y}/${ymd}_solar.dat${bust}`,  { cache: "no-store" })
    ]);
    if (!meterResp.ok) return { chargeKwh: 0, solarKwh: 0, importKwh: 0, exportKwh: 0, hasData: false };

    const chargeTxt = chargeResp.ok ? await chargeResp.text() : "";
    const meterTxt  = await meterResp.text();
    const solarTxt  = solarResp?.ok ? await solarResp.text() : "";

    const charge = parseChargeDat(chargeTxt);
    const meter  = parseMeterDat(meterTxt);
    const solar  = parseSolarDat(solarTxt);

    charge.evEnergy    = normalizeSeries(charge.evEnergy);
    const sessions     = parseChargeSessions(chargeTxt);   // conserva s.wb
    const sessionsMeta = buildSessionsMeta(sessions, charge);
    const chargeKwh    = sessionsMeta.reduce((acc, s) => acc + (s.kwh || 0), 0);

    const solarArr = normalizeSeries(solar.solarKw);
    let solarKwh = 0;
    for (let i = 1; i < solarArr.length; i++) {
      const dtH = (solarArr[i].x - solarArr[i-1].x) / 3600000;
      solarKwh += (solarArr[i].y + solarArr[i-1].y) / 2 * dtH;
    }

    const gridArr = normalizeSeries(meter.gridKw);
    let importKwh = 0, exportKwh = 0;
    for (let i = 1; i < gridArr.length; i++) {
      const dtH = (gridArr[i].x - gridArr[i-1].x) / 3600000;
      const avg = (gridArr[i].y + gridArr[i-1].y) / 2;
      if (avg > 0) importKwh += avg * dtH;
      else exportKwh += Math.abs(avg) * dtH;
    }

    // PV Charged: quanta energia EV viene dal solare.
    // Se il file ha session_pv_kwh (col 11) usiamo il valore vero calcolato dal
    // server; altrimenti restiamo sulla stima per integrazione min(ev, ev-grid).
    const evArr = normalizeSeries(charge.evPower);
    const pvFromFile = sumSessionPv(sessionsMeta);
    let pvChargedKwh = 0;

    if (pvFromFile != null) {
      pvChargedKwh = pvFromFile;
    } else {
      const r = commonRange([evArr, gridArr]);
      if (r && evArr.length && gridArr.length) {
        const STEP = 30000;
        const evR = resampleHold(evArr, r.t0, r.t1, STEP);
        const grR = resampleHold(gridArr, r.t0, r.t1, STEP);
        for (let i = 1; i < evR.length; i++) {
          const ev0 = evR[i-1].y || 0, ev1 = evR[i].y || 0;
          const gr0 = grR[i-1] ? (grR[i-1].y || 0) : 0;
          const gr1 = grR[i] ? (grR[i].y || 0) : 0;
          const pv0 = Math.max(0, Math.min(ev0, ev0 - gr0));
          const pv1 = Math.max(0, Math.min(ev1, ev1 - gr1));
          const dtH = (evR[i].x - evR[i-1].x) / 3600000;
          pvChargedKwh += (pv0 + pv1) / 2 * dtH;
        }
      }
      if (chargeKwh > 0 && pvChargedKwh > chargeKwh) pvChargedKwh = chargeKwh;
    }

    // calibrazione prima di uscire dalla funzione: da qui in poi questi due
    // numeri finiscono in statistiche, euro, barre e aggregati di periodo
    importKwh *= gridFactors().imp;
    exportKwh *= gridFactors().exp;

    const evMaxKw = minMax(evArr)?.max ?? 0;
    const pvMaxKw = minMax(normalizeSeries(solar.solarKw))?.max ?? 0;

    const chargeByWb = kwhByWallbox(sessionsMeta);
    const pvReale = sessionsMeta.length === 0
      ? {}
      : (pvFromFile != null ? pvKwhByWallbox(sessionsMeta) : null);

    // Senza il dato vero si stima, invece di lasciare un buco: un buco non
    // restava circoscritto al giorno, cancellava la scomposizione dell'intero
    // periodo che lo conteneva - e un anno contiene sempre un giorno vecchio.
    const pvByWb = pvReale || splitProporzionale(chargeByWb, pvChargedKwh);

    const out = { chargeKwh, solarKwh, importKwh, exportKwh, pvChargedKwh, evMaxKw, pvMaxKw,
                  sessionCount: sessionsMeta.length,
                  chargeByWb,
                  // Un giorno senza ricariche non e' un giorno "senza dato":
                  // la sua scomposizione e' vuota e vale zero. Mettendo null
                  // bastava un giorno di sosta per far sparire la
                  // scomposizione del FV dell'intera settimana o del mese.
                  pvChargedByWb: pvByWb,
                  // la barra lo dice nella spiegazione: non e' un dato letto
                  pvSplitEst: !pvReale,
                  // col listino di QUESTO giorno: i periodi li sommano
                  money: dayMoney(ymd, { chargeKwh, pvChargedKwh, importKwh, exportKwh,
                                         chargeByWb, pvChargedByWb: pvByWb }),
                  hasData: true };
    storeTotals(ymd, out);
    return out;
  } catch {
    return { chargeKwh: 0, solarKwh: 0, importKwh: 0, exportKwh: 0, pvChargedKwh: 0, evMaxKw: 0, pvMaxKw: 0, hasData: false };
  }
}

async function loadHistoryForWeek(date) {
  const monday = new Date(date);
  const dow = monday.getDay();
  monday.setDate(monday.getDate() - (dow === 0 ? 6 : dow - 1));

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const totals = await Promise.all(days.map(d => computeDailyTotals(d)));
  const labels = days.map(d => d.toLocaleDateString([], { weekday: "short", day: "numeric" }));
  const title  = `Week ${monday.toLocaleDateString([], { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}`;

  drawBarChart(labels, totals, title);
  updatePeriodStats(totals);
}

async function loadHistoryForMonth(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
  const totals = await Promise.all(days.map(d => computeDailyTotals(d)));
  const labels = days.map(d => d.getDate().toString());
  const title  = date.toLocaleDateString([], { month: "long", year: "numeric" });

  drawBarChart(labels, totals, title);
  updatePeriodStats(totals);
}

// Un mese per barra. I giorni si caricano un mese alla volta: tutti insieme
// sarebbero oltre mille richieste in parallelo, e col caching dei giorni
// chiusi la prima apertura e' l'unica lenta.
async function loadHistoryForYear(date) {
  const year = date.getFullYear();
  const oggi = new Date();
  const ultimoMese = (year === oggi.getFullYear()) ? oggi.getMonth() : 11;

  const mesi = [];
  for (let m = 0; m <= ultimoMese; m++) {
    const giorni = Array.from(
      { length: new Date(year, m + 1, 0).getDate() },
      (_, i) => new Date(year, m, i + 1)
    );
    mesi.push(mergeTotals(await Promise.all(giorni.map(g => computeDailyTotals(g)))));
  }

  const labels = mesi.map((_, m) =>
    new Date(year, m, 1).toLocaleDateString([], { month: "short" }));

  drawBarChart(labels, mesi, String(year));
  updatePeriodStats(mesi);
}

function applyChartTypeMode() {
  if (!historyChart) return;
  const isBarChart = historyChart.data.datasets.some(ds => ds.label?.startsWith("_trend_"));
  if (!isBarChart) return;
  historyChart.data.datasets.forEach(ds => {
    const isTrend = ds.label?.startsWith("_trend_");
    if (chartTypeMode === "bars")       ds.hidden = isTrend;
    else if (chartTypeMode === "lines") ds.hidden = !isTrend;
    else                                ds.hidden = false;
  });
  historyChart.update();
}

// Valore di una serie del grafico a periodo nella modalita' corrente.
//
// In denaro non si moltiplica niente qui: i soldi di ogni giorno sono gia'
// calcolati col listino di QUEL giorno, cosi' un periodo a cavallo di un
// cambio tariffa resta giusto anche nelle barre.
//
// "solar" fa eccezione: la produzione non ha un prezzo solo, perche' una parte
// e' autoconsumata e una parte venduta, e dai file non sappiamo come si divide.
// In denaro quella serie diventa PV Saved, che un prezzo ce l'ha.
function barValue(t, metric, wb){
  if (!t?.hasData) return null;

  const m = moneyMode ? (t.money || {}) : null;
  let v;

  if (metric === "ev") {
    v = wb
      ? ((m ? m.costByWb : t.chargeByWb) || {})[wb] || 0
      : (m ? m.costEv : t.chargeKwh) || 0;
  } else if (metric === "solar") {
    v = (m ? m.savingPv : t.solarKwh) || 0;
  } else if (metric === "export") {
    v = (m ? m.revenueExport : t.exportKwh) || 0;
  } else if (metric === "import") {
    v = (m ? m.costImport : t.importKwh) || 0;
  } else {
    return null;
  }

  return +v.toFixed(2);
}

// "(kWh)" o "(EUR)" in coda al nome della serie, secondo la modalita'
function serieUnit(){
  return moneyMode ? `(${priceTables().cur})` : "(kWh)";
}

function serieLabel(nome){
  return `${nome} ${serieUnit()}`;
}

// In denaro il nome cambia, non solo l'unita': non e' piu' quanto il sole ha
// prodotto ma quanto ha fatto risparmiare.
function solarLabel(){
  return serieLabel(moneyMode ? "PV Saved" : "Solar");
}

// Energia o soldi, per i tooltip del grafico.
function fmtSerie(v){
  if (v === null || v === undefined) return "—";
  return moneyMode ? fmtMoney(v) : `${fmtNum(v, 2)} kWh`;
}

// Elenco delle wallbox presenti nel periodo, in ordine stabile.
function wallboxesInTotals(totals){
  const set = new Set();
  for (const t of (totals || [])){
    for (const wb of Object.keys(t?.chargeByWb || {})) set.add(wb);
  }
  return [...set].sort();
}

// Barre EV del grafico a periodo: una sola col totale su un impianto a una
// wallbox, altrimenti una per wallbox nello stesso stack (anche se nel periodo
// ne ha caricata una sola: e' proprio il caso in cui serve sapere quale).
function evBarDatasets(totals){
  const wbs = wallboxesInTotals(totals)
    .filter(wb => wbFilter === "both" || wb === wbFilter);

  if (!wbs.length || !wbIdentifyNeeded(wbs.length)) {
    return [{
      label: serieLabel("EV Charged"),
      metric: "ev",
      stack: "ev",
      primary: true,
      data: totals.map(t => barValue(t, "ev")),
      backgroundColor: "rgba(34,197,94,0.75)",
      borderColor: "#22c55e", borderWidth: 1
    }];
  }

  return wbs.map((wb, i) => ({
    label: `${wbShort(wb)} ${serieUnit()}`,
    metric: "ev",
    stack: "ev",
    wbKey: wb,
    primary: i === 0,
    data: totals.map(t => barValue(t, "ev", wb)),
    backgroundColor: WB_BAR_FILL[i % WB_BAR_FILL.length],
    borderColor: WB_COLORS[i % WB_COLORS.length],
    borderWidth: 1
  }));
}

function drawBarChart(labels, totals, title) {
  // Il tasto valuta ridisegna da qui, con gli stessi totali gia' in mano:
  // nessuna richiesta di rete, nessun ricalcolo.
  lastChart = () => drawBarChart(labels, totals, title);

  const canvas = document.getElementById("historyChart");
  const ctx = canvas.getContext("2d");
  if (historyChart) historyChart.destroy();

  const win = labels.length <= 7 ? 3 : 5;

  historyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        // Barre EV: una sola col totale, oppure una per wallbox impilate nello
        // stesso gruppo "ev" (l'altezza del gruppo resta il totale del giorno).
        ...evBarDatasets(totals),
        {
          label: solarLabel(),
          metric: "solar",
          stack: "solar",
          data: totals.map(t => barValue(t, "solar")),
          backgroundColor: "rgba(56,189,248,0.75)",
          borderColor: "#38bdf8", borderWidth: 1
        },
        {
          label: serieLabel("Grid Export"),
          metric: "export",
          stack: "export",
          data: totals.map(t => barValue(t, "export")),
          backgroundColor: "rgba(139,92,246,0.75)",
          borderColor: "#8b5cf6", borderWidth: 1
        },
        {
          label: serieLabel("Grid Import"),
          metric: "import",
          stack: "import",
          data: totals.map(t => barValue(t, "import")),
          backgroundColor: "rgba(244,63,94,0.75)",
          borderColor: "#f43f5e", borderWidth: 1
        },
        // Linee di trend: stessi dati delle barre, mostrate in modalita' "lines".
        // Ognuna ha il suo stack: su un asse stacked i dataset dello stesso
        // gruppo si sommerebbero, e le linee devono restare indipendenti.
        { type:"line", label:"_trend_ev",     metric:"ev",     displayLabel:serieLabel("EV Charged"),  stack:"trend_ev",     data: totals.map(t => barValue(t, "ev")), borderColor:"#22c55e", borderWidth:2, pointRadius:3, pointHoverRadius:7, fill:false, tension:0.2, order:0 },
        { type:"line", label:"_trend_solar",  metric:"solar",  displayLabel:solarLabel(),       stack:"trend_solar",  data: totals.map(t => barValue(t, "solar")), borderColor:"#38bdf8", borderWidth:2, pointRadius:3, pointHoverRadius:7, fill:false, tension:0.2, order:0 },
        { type:"line", label:"_trend_export", metric:"export", displayLabel:serieLabel("Grid Export"), stack:"trend_export", data: totals.map(t => barValue(t, "export")), borderColor:"#8b5cf6", borderWidth:2, pointRadius:3, pointHoverRadius:7, fill:false, tension:0.2, order:0 },
        { type:"line", label:"_trend_import", metric:"import", displayLabel:serieLabel("Grid Import"), stack:"trend_import", data: totals.map(t => barValue(t, "import")), borderColor:"#f43f5e", borderWidth:2, pointRadius:3, pointHoverRadius:7, fill:false, tension:0.2, order:0 }

      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      layout: { padding: { bottom: 24 } },
      plugins: {
        title: { display: true, text: title, color: "#e5e7eb", font: { size: 14 } },
        legend: {
          labels: {
            color: "#9ca3af",
            boxWidth: 12,
            filter: (item) => !item.text.startsWith("_trend_"),
            generateLabels(chart) {
              const labels = Chart.defaults.plugins.legend.labels.generateLabels(chart);
              labels.forEach(label => { label.hidden = false; });
              return labels;
            }
          }
        },
        zoom: {
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "x" },
          pan: { enabled: true, mode: "x" }
        },
        tooltip: {
          callbacks: {
            label(context) {
              const ds = context.dataset;
              if (ds.label?.startsWith("_trend_")) {
                if (chartTypeMode !== "lines") return null;
                return ds.displayLabel || ds.label;
              }
              return ds.label || "";
            },
            afterLabel(context) {
              const ds = context.dataset;
              if (ds.label?.startsWith("_trend_") && chartTypeMode !== "lines") return null;

              const t = totals[context.dataIndex];
              if (!t) return "";

              // La metrica e' una proprieta' del dataset, non la sua posizione:
              // aggiungere o togliere dataset non sposta piu' niente.
              const metric = ds.metric;
              const lines = [`Total: ${fmtSerie(context.parsed.y)}`];

              // i "Max" sono valori del giorno, non del singolo dataset: con le
              // barre per wallbox li mostriamo una volta sola, sulla prima.
              // In denaro non si mostrano: una potenza non ha un prezzo, come
              // nella barra delle statistiche.
              if (!moneyMode) {
                if (metric === "ev"    && ds.primary && t.evMaxKw) lines.push(`Max: ${fmtNum(t.evMaxKw, 2)} kW`);
                if (metric === "solar" && t.pvMaxKw)               lines.push(`Max: ${fmtNum(t.pvMaxKw, 2)} kW`);
              }

              // Scomposizione per wallbox: serve solo quando la barra EV e'
              // aggregata. Se le barre sono gia' per wallbox sarebbe ridondante.
              if (metric === "ev" && !ds.wbKey) {
                const perWb = (moneyMode ? t.money?.costByWb : t.chargeByWb) || {};
                const keys = Object.keys(perWb).sort();
                if (keys.length > 1) {
                  for (const wb of keys) lines.push(`${wbShort(wb)}: ${fmtSerie(perWb[wb])}`);
                }
              }
              return lines;
            }
          }
        }
      },
      // stacked: i dataset si sommano solo dentro lo stesso `stack`, quindi le
      // barre EV per wallbox si impilano fra loro mentre solar/import/export
      // restano gruppi affiancati, uno per metrica, come prima.
      scales: {
        x: { stacked: true, ticks: { color: "#9ca3af" }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            color: "#9ca3af",
            // in denaro la scala e' in euro: senza simbolo si leggerebbe kWh
            callback: (v) => moneyMode ? fmtMoney(v) : v
          },
          grid: { color: "rgba(255,255,255,0.05)" }
        }
      }
    }
  });

  applyChartTypeMode();
  setTimeout(() => historyChart.resize(), 50);
}

// Scrive il totale caricato e, con piu' di una wallbox, la scomposizione
// accanto al numero: "7.00 kWh (EV1 2.00 · EV2 5.00)".
// Con una sola wallbox il riquadro resta identico a prima.
// Valore della statistica e, sotto, una riga per wallbox. Gli elementi sono
// fratelli dentro lo stesso contenitore: un blocco romperebbe il layout
// flex/nowrap di .historyStats.
function setStatWithSplit(id, text, parts){
  const el = document.getElementById(id);
  if (!el) return;

  el.textContent = text;

  const host = el.parentElement;
  if (!host) return;

  let sub = host.querySelector(".wbSplit");

  if (!parts || !parts.length) {
    if (sub) sub.remove();
    return;
  }
  if (!sub) {
    sub = document.createElement("span");
    sub.className = "wbSplit";
    el.insertAdjacentElement("afterend", sub);
  }

  sub.textContent = "";
  for (const p of parts) {
    const one = document.createElement("span");
    one.className = "wbPart";
    one.textContent = p;
    sub.appendChild(one);
  }
}

// In denaro il totale caricato diventa quanto e' costato: serve quindi anche
// la quota solare, che non si paga. Senza la scomposizione del FV per wallbox
// il costo per wallbox non e' calcolabile e le righe spariscono: meglio
// nessun dettaglio che un dettaglio inventato.
function setChargedStat(totKwh, byWb, money){
  const pieno = (totKwh > 0 || Object.keys(byWb || {}).length);

  if (!moneyMode) {
    setStatWithSplit("statCharged", pieno ? fmtNum(totKwh, 2) : "—",
                     wbBreakdownParts(byWb, ""));
    return;
  }

  const m = money || {};
  setStatWithSplit("statCharged", pieno ? fmtMoney(m.costEv) : "—",
                   m.costByWb ? wbBreakdownParts(m.costByWb, priceTables().cur) : []);
}

// "Giardino 62% · Garage 40%": ciascuna sul PROPRIO caricato, non sul totale,
// altrimenti due percentuali che non si sommano a quella grande confondono.
function wbPvPctParts(pvByWb, chargeByWb){
  const keys = Object.keys(pvByWb || {}).sort();
  if (!keys.length || !wbIdentifyNeeded(keys.length)) return [];

  const out = [];
  for (const wb of keys){
    const tot = (chargeByWb || {})[wb] || 0;
    if (!(tot > 0)) continue;
    out.push(`${wbShort(wb)} ${Math.min(100, (pvByWb[wb] || 0) / tot * 100).toFixed(0)}%`);
  }
  return out;
}

// pvByWb null = il dato per-wallbox non c'e' (file senza col 11, o giorni misti
// nel periodo): si mostra solo il totale, senza inventare una scomposizione.
function setPvStats(totPv, totCharge, pvByWb, chargeByWb, money, splitStimato){
  const pct = (totCharge > 0 && totPv > 0) ? Math.min(100, totPv / totCharge * 100) : 0;
  const m = money || {};
  const cur = priceTables().cur;

  // in denaro il FV caricato diventa il risparmio: energia non comprata
  const valore = moneyMode ? (m.savingPv || 0) : totPv;
  const parti  = moneyMode ? m.savingByWb : pvByWb;

  setStatWithSplit("statPvCharged",
                   totPv > 0 ? (moneyMode ? fmtMoney(valore) : fmtNum(valore, 2)) : "—",
                   wbBreakdownParts(parti || null, moneyMode ? cur : ""));

  // il netto finisce nella spiegazione di questa casella
  lastMoney = money || null;
  lastPvEst = !!splitStimato;
  applyStatTips();
  setStatWithSplit("statPvChargedPct", pct > 0 ? pct.toFixed(0) + "%" : "—",
                   wbPvPctParts(pvByWb, chargeByWb));
}

function updatePeriodStats(totals) {
  document.getElementById("historyError").style.display = "none";
  const sum = key => totals.reduce((acc, t) => acc + (t[key] || 0), 0);
  const maxVal = key => {
    const vals = totals.filter(t => t.hasData && t[key]).map(t => t[key]);
    return vals.length ? Math.max(...vals) : null;
  };

  const evMax = maxVal("evMaxKw");
  const pvMax = maxVal("pvMaxKw");
  const sessions = sum("sessionCount");

  document.getElementById("statEv").textContent       = evMax ? fmtNum(evMax, 2) : "—";
  const totCharge = sum("chargeKwh");
  const byWb      = mergeKwhByWallbox(totals.map(t => t.chargeByWb));
  const totPvCharged = sum("pvChargedKwh");

  // Basta un giorno del periodo senza il dato per wallbox e la scomposizione
  // salta: sommare solo i giorni che ce l'hanno darebbe percentuali false.
  const pvSplitOk = totals.every(t => !t.hasData || t.pvChargedByWb);
  const pvByWb = pvSplitOk ? mergeKwhByWallbox(totals.map(t => t.pvChargedByWb)) : null;
  const pvSplitEst = totals.some(t => t.hasData && t.pvSplitEst);
  const money = mergeMoney(totals.map(t => t.money));

  lastStats = () => updatePeriodStats(totals);

  setChargedStat(totCharge, byWb, money);
  setPvStats(totPvCharged, totCharge, pvByWb, byWb, money, pvSplitEst);
  setPriceStats(money, { imp: sum("importKwh"), exp: sum("exportKwh") });
  document.getElementById("statSessions").textContent = sessions || "—";
  document.getElementById("statPvMax").textContent    = pvMax ? fmtNum(pvMax, 2) : "—";
  document.getElementById("statSolar").textContent    = fmtNum(sum("solarKwh"), 2);
  document.getElementById("statGridImport").textContent =
    fmtEnergy(sum("importKwh"), money?.costImport);
  document.getElementById("statGridExport").textContent =
    fmtEnergy(sum("exportKwh"), money?.revenueExport);
}

function updateTodayHighlight() {
  const today = new Date();
  const isToday =
    currentDate.getFullYear() === today.getFullYear() &&
    currentDate.getMonth() === today.getMonth() &&
    currentDate.getDate() === today.getDate();

  document.getElementById("todayBtn").classList.toggle("active", isToday);
}

// === Helper: energia al timestamp (nearest previous) ===
function energyAt(evEnergy, tsMs) {
  if (!evEnergy?.length) return null;
  // evEnergy: [{x: ms, y: kWh}] ordinato per x
  let last = null;
  for (let i = 0; i < evEnergy.length; i++) {
    if (evEnergy[i].x > tsMs) break;
    last = evEnergy[i].y;
  }
  return (typeof last === "number" && isFinite(last)) ? last : null;
}

// === Precalcola meta sessioni: #, durata, kWh ===
// `charge` e' il risultato di parseChargeDat: serve byWb, perche' i kWh vanno
// letti sulla wallbox della sessione e non sulla serie mescolata.
function buildSessionsMeta(sessions, charge) {
  const fallbackReg = Array.isArray(charge) ? charge : (charge?.evEnergy || []);
  const byWb        = Array.isArray(charge) ? null : charge?.byWb;

  return sessions.map((s, idx) => {
    const w = byWb?.get?.(s.wb);
    let kwh = null, pvKwh = null;

    // Formato nuovo: session_kwh (col 10) e session_pv_kwh (col 11) sono
    // contatori running. Non si legge l'ultimo campione: vedi sessionTotal.
    if (w?.sessionKwh?.length) {
      kwh   = sessionTotal(w.sessionKwh,   s.start, s.end);
      pvKwh = sessionTotal(w.sessionPvKwh, s.start, s.end);
    }

    // Legacy: delta del registro assoluto, ma della SOLA wallbox di questa
    // sessione. Sulla serie mescolata il delta salterebbe tra due contatori
    // cumulativi indipendenti.
    if (kwh == null) {
      const reg = w?.energyReg?.length ? w.energyReg : fallbackReg;

      let e0 = energyAt(reg, s.start);
      let e1 = energyAt(reg, s.end);

      // fallback: se e0 manca (Begin prima del primo MeterValue), prendo il primo valore nella sessione
      if (e0 == null) {
        for (let i = 0; i < reg.length; i++) {
          if (reg[i].x >= s.start && reg[i].x <= s.end) { e0 = reg[i].y; break; }
        }
      }
      // fallback: se e1 manca (sessione in corso), prendo l'ultimo valore nella sessione
      if (e1 == null) {
        for (let i = reg.length - 1; i >= 0; i--) {
          if (reg[i].x >= s.start && reg[i].x <= s.end) { e1 = reg[i].y; break; }
        }
      }

      if (e0 != null && e1 != null) {
        kwh = e1 - e0;
        // se per qualche motivo resetta, fallback a abs
        if (!isFinite(kwh)) kwh = null;
        else if (kwh < 0) kwh = Math.abs(kwh);
      }
    }

    const durMs = Math.max(0, s.end - s.start);
    const durMin = Math.round(durMs / 60000);

    return {
      n: idx + 1,
      start: s.start,
      end: s.end,
      durMin,
      kwh,
      pvKwh,
      wb: s.wb
    };
  });
}


// === Trova sessione in cui cade un timestamp ===
window.findSessionMetaAt = function findSessionMetaAt(sessionsMeta, tsMs) {
  if (!sessionsMeta?.length) return null;
  for (const s of sessionsMeta) {
    if (tsMs >= s.start && tsMs <= s.end) return s;
  }
  return null;
};



function normalizeSeries(arr){
  const out = (arr || [])
    .map(p => ({ x: p.x, y: Number(p.y) }))
    .filter(p => isFinite(p.x) && isFinite(p.y))
    .sort((a,b) => a.x - b.x);

  // dedup stesso timestamp: tieni ultimo
  const dedup = [];
  for (const p of out){
    const last = dedup[dedup.length - 1];
    if (last && last.x === p.x) dedup[dedup.length - 1] = p;
    else dedup.push(p);
  }
  return dedup;
}

// HOLD (step): valore ultimo noto <= t
function valueHold(series, t){
  if (!series.length) return null;
  // avanzamento lineare con indice esterno sarebbe più veloce, qui ok per pochi punti
  let v = null;
  for (let i = 0; i < series.length; i++){
    if (series[i].x > t) break;
    v = series[i].y;
  }
  return v;
}

function movingAverage(data, win) {
  return data.map((_, i) => {
    const half = Math.floor(win / 2);
    const slice = data.slice(Math.max(0, i - half), Math.min(data.length, i + half + 1))
                      .filter(v => v !== null);
    return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null;
  });
}

function minMax(series){
  const vals = (series || []).map(p => p.y).filter(v => Number.isFinite(v));
  if (!vals.length) return null;
  return { min: Math.min(...vals), max: Math.max(...vals) };
}


// crea griglia temporale comune e resample con hold
function resampleHold(series, t0, t1, stepMs){
  const out = [];
  if (!series?.length) return out;
  series = normalizeSeries(series);

  // indice per scorrere veloce
  let j = 0;
  let last = null;

  for (let t = t0; t <= t1; t += stepMs){
    while (j < series.length && series[j].x <= t){
      last = series[j].y;
      j++;
    }
    if (last != null) out.push({ x: t, y: last });
    else out.push({ x: t, y: null }); // niente prima
  }
  return out;
}

function showNoDataMessage(){
  document.getElementById("historyError").style.display = "block";

  // le righe per wallbox sono elementi a parte: senza questo resterebbero
  // quelle del giorno precedente sotto a un "—"
  for (const s of document.querySelectorAll("#historyStats .wbSplit")) s.remove();

  document.getElementById("statEv").textContent = "—";
  document.getElementById("statCharged").textContent = "—";
  document.getElementById("statPvCharged").textContent = "—";
  document.getElementById("statPvChargedPct").textContent = "—";
  document.getElementById("statPvMax").textContent = "—";
  document.getElementById("statSolar").textContent = "—";
  document.getElementById("statGridExport").textContent = "—";
  document.getElementById("statGridImport").textContent = "—";
  document.getElementById("statSessions").textContent = "—";


  if (historyChart) {
    historyChart.destroy();
    historyChart = null;
  }
}

// calcola range comune (min..max) tra più serie
function commonRange(seriesList){
  const mins = [];
  const maxs = [];
  for (const s of seriesList){
    const ss = normalizeSeries(s);
    if (!ss.length) continue;
    mins.push(ss[0].x);
    maxs.push(ss[ss.length - 1].x);
  }
  if (!mins.length) return null;
  return { t0: Math.min(...mins), t1: Math.max(...maxs) };
}


function ymdParts(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return { y, ymd: `${y}${m}${day}` };
}

async function loadHistoryForDate(d){

  const { y, ymd } = ymdParts(d);
  const bust = `?_=${Date.now()}`;

  const chargePath = `data/${y}/${ymd}_charge.dat`;
  const meterPath  = `data/${y}/${ymd}_meter.dat`;
  const solarPath  = `data/${y}/${ymd}_solar.dat`;

let chargeResp, meterResp, solarResp;

try {
  [chargeResp, meterResp, solarResp] = await Promise.all([
    fetch(chargePath + bust, { cache: "no-store" }),
    fetch(meterPath  + bust, { cache: "no-store" }),
    fetch(solarPath  + bust, { cache: "no-store" })
  ]);
} catch (err) {
  showNoDataMessage();
  return;
}

if (!meterResp.ok) {
  showNoDataMessage();
  return;
}

document.getElementById("historyError").style.display = "none";

const chargeTxt = chargeResp.ok ? await chargeResp.text() : "";
const meterTxt  = await meterResp.text();
const solarTxt  = (solarResp && solarResp.ok) ? await solarResp.text() : "";


  const charge = parseChargeDat(chargeTxt);
  const meter  = parseMeterDat(meterTxt);
  const solar  = parseSolarDat(solarTxt);

  // === NORMALIZZA DATI ===
  charge.evPower  = normalizeSeries(charge.evPower);
  charge.evEnergy = normalizeSeries(charge.evEnergy);
  meter.gridKw    = normalizeSeries(meter.gridKw);
  solar.solarKw   = normalizeSeries(solar.solarKw);

  // salva le serie raw (prima del resampling) per il calcolo kWh sessioni.
  // byWb non viene mai ricampionato, quindi basta tenere il riferimento.
  const chargeRaw = {
    evEnergy:  charge.evEnergy,
    byWb:      charge.byWb,
    wallboxes: charge.wallboxes
  };

  const r = commonRange([charge.evPower, charge.evEnergy, meter.gridKw]);
  if (!r) return;

  const STEP_MS = 30 * 1000;

  charge.evPower  = resampleHold(charge.evPower,  r.t0, r.t1, STEP_MS);
  meter.gridKw    = resampleHold(meter.gridKw,    r.t0, r.t1, STEP_MS);
  charge.evEnergy = resampleHold(charge.evEnergy, r.t0, r.t1, STEP_MS);
  if (solar.solarKw.length) {
    solar.solarKw = resampleHold(solar.solarKw, r.t0, r.t1, STEP_MS);
  }

  // serie per-wallbox sulla stessa griglia del totale, solo per il grafico
  charge.wbPlot = (charge.wallboxes || []).map(wb => ({
    wb,
    power: resampleHold(charge.byWb.get(wb).power, r.t0, r.t1, STEP_MS)
  }));


  const evMM   = minMax(charge.evPower);
  const gridMM = minMax(meter.gridKw);
  const pvMM   = minMax(solar.solarKw);


  // === SESSIONI (UNA SOLA VOLTA) ===
  const sessions = parseChargeSessions(chargeTxt);   // conserva s.wb

  // usa le serie raw (timestamp esatti) per evitare problemi di allineamento griglia
  const sessionsMeta = buildSessionsMeta(sessions, chargeRaw);


/*document.getElementById("statEv").textContent =
  evMM ? `${evMM.min.toFixed(2)} / ${evMM.max.toFixed(2)} kW` : "—";*/
document.getElementById("statEv").textContent =
  evMM ? fmtNum(evMM.max, 2) : "—";

const totalKwh = sessionsMeta.reduce((acc,s)=>acc+(s.kwh||0),0);

// PV Charged: quanta energia caricata nell'EV è venuta dal solare.
// Con session_pv_kwh (col 11) è un valore vero del server; senza, si stima
// come pvForEv = max(0, min(evPower, evPower - gridKw)).
let pvChargedKwh = 0;
const pvFromFile = sumSessionPv(sessionsMeta);
if (pvFromFile != null) {
  pvChargedKwh = pvFromFile;
} else {
  const evP = charge.evPower;
  const grP = meter.gridKw;
  if (evP.length && grP.length) {
    for (let i = 1; i < evP.length; i++) {
      const ev0 = evP[i-1].y || 0, ev1 = evP[i].y || 0;
      const gr0 = grP[i-1] ? (grP[i-1].y || 0) : 0;
      const gr1 = grP[i] ? (grP[i].y || 0) : 0;
      const pv0 = Math.max(0, Math.min(ev0, ev0 - gr0));
      const pv1 = Math.max(0, Math.min(ev1, ev1 - gr1));
      const dtH = (evP[i].x - evP[i-1].x) / 3600000;
      pvChargedKwh += (pv0 + pv1) / 2 * dtH;
    }
  }
  if (totalKwh > 0 && pvChargedKwh > totalKwh) pvChargedKwh = totalKwh;
}
// Il FV per wallbox arriva dalle sessioni (col 11). Quando non c'e' si
// ripartisce il totale del giorno in proporzione ai kWh di ciascuna: quel
// totale e' gia' una stima per integrazione, e dividerlo non peggiora il dato.
const chargeByWbDay = kwhByWallbox(sessionsMeta);
const pvRealeDay = sessionsMeta.length === 0
  ? {}                                   // niente ricariche: scomposizione vuota, non stimata
  : (pvFromFile != null ? pvKwhByWallbox(sessionsMeta) : null);
const pvByWbDay = pvRealeDay || splitProporzionale(chargeByWbDay, pvChargedKwh);
const pvSplitEstDay = !pvRealeDay;

document.getElementById("statPvMax").textContent =
  pvMM ? fmtNum(pvMM.max, 2) : "—";

// energia solare totale: integrazione trapezoidale (dati resampled a 30s)
let solarKwh = 0;
for (let i = 1; i < solar.solarKw.length; i++) {
  const dtH = (solar.solarKw[i].x - solar.solarKw[i-1].x) / 3600000;
  solarKwh += (solar.solarKw[i].y + solar.solarKw[i-1].y) / 2 * dtH;
}
document.getElementById("statSolar").textContent =
  solarKwh > 0 ? fmtNum(solarKwh, 2) : "—";

// grid export giornaliero: integra solo i valori negativi (negativo = immissione)
let gridExportKwh = 0;
let gridImportKwh = 0;
for (let i = 1; i < meter.gridKw.length; i++) {
  const dtH = (meter.gridKw[i].x - meter.gridKw[i-1].x) / 3600000;
  const avg = (meter.gridKw[i].y + meter.gridKw[i-1].y) / 2;
  if (avg < 0) gridExportKwh += Math.abs(avg) * dtH;
  else gridImportKwh += avg * dtH;
}
gridExportKwh *= gridFactors().exp;
gridImportKwh *= gridFactors().imp;

// Tutti i soldi del giorno in un colpo solo, col listino di questa data: le
// statistiche qui sotto li leggono gia' fatti, come fanno i periodi.
const moneyDay = dayMoney(ymd, {
  chargeKwh: totalKwh,
  pvChargedKwh,
  importKwh: gridImportKwh,
  exportKwh: gridExportKwh,
  chargeByWb: chargeByWbDay,
  pvChargedByWb: pvByWbDay
});

lastStats = () => {
  setChargedStat(totalKwh, chargeByWbDay, moneyDay);
  setPvStats(pvChargedKwh, totalKwh, pvByWbDay, chargeByWbDay, moneyDay, pvSplitEstDay);
  setPriceStats(moneyDay, { imp: gridImportKwh, exp: gridExportKwh });

  document.getElementById("statGridExport").textContent =
    gridExportKwh > 0 ? fmtEnergy(gridExportKwh, moneyDay.revenueExport) : "—";
  document.getElementById("statGridImport").textContent =
    gridImportKwh > 0 ? fmtEnergy(gridImportKwh, moneyDay.costImport) : "—";
};
lastStats();

document.getElementById("statSessions").textContent =
  sessionsMeta.length;


  drawHistoryChart(charge, meter, solar, sessions, sessionsMeta);
}

// kWh per wallbox a partire dalle sessioni: {wallbox01: 2.0, wallbox02: 5.0}
// Ripartisce un totale di giornata fra le wallbox in proporzione ai kWh che
// ciascuna ha caricato. Serve ai giorni scritti prima della col 11, dove il
// solare per singola wallbox non e' registrato: il totale di quei giorni e'
// gia' una stima per integrazione, quindi dividerlo in proporzione resta la
// stessa stima e non aggiunge precisione finta.
function splitProporzionale(byWb, tot){
  const out = {};
  const keys = Object.keys(byWb || {});
  const somma = keys.reduce((a, k) => a + (byWb[k] || 0), 0);

  for (const k of keys) {
    out[k] = (somma > 0 && tot > 0) ? tot * (byWb[k] || 0) / somma : 0;
  }
  return out;
}

function kwhByWallbox(sessionsMeta){
  const out = {};
  for (const s of (sessionsMeta || [])){
    if (!s.wb) continue;
    out[s.wb] = (out[s.wb] || 0) + (s.kwh || 0);
  }
  return out;
}

// Somma piu' mappe wb->kWh (per i riepiloghi su piu' giorni)
function mergeKwhByWallbox(list){
  const out = {};
  for (const m of (list || [])){
    for (const [wb, v] of Object.entries(m || {})) out[wb] = (out[wb] || 0) + (v || 0);
  }
  return out;
}

// "EV1 2.00 · EV2 5.00" - vuota su un impianto a una wallbox: il totale
// basta. Su un impianto multiplo la mostra anche con una sola wallbox nei dati:
// e' l'unico posto che dice quale ha caricato quel giorno.
function wbBreakdownParts(byWb, unit = " kWh"){
  const keys = Object.keys(byWb || {}).sort();
  if (!keys.length || !wbIdentifyNeeded(keys.length)) return [];
  return keys.map(wb => `${wbShort(wb)} ${fmtNum(byWb[wb], 2)}${unit}`);
}

function wbBreakdownText(byWb, unit = " kWh"){
  return wbBreakdownParts(byWb, unit).join(" · ");
}

// Nome leggibile di una wallbox. Priorita':
//  1. WALLBOX_MQTT_NAME dalla sua sezione di ocpp.ini, iniettato dal server
//     in window.OCPP_WALLBOX_NAMES (la colonna 9 dei .dat E' l'id di sezione)
//  2. "EV<n>" se l'id segue la convenzione wallboxNN
//  3. l'id cosi' com'e' (le sezioni possono avere nomi arbitrari)
function wbShort(wb){
  const named = (typeof window !== "undefined" && window.OCPP_WALLBOX_NAMES) || {};
  const n = named[wb];
  if (typeof n === "string" && n.trim()) return ucfirst(n);

  const m = /^wallbox0*(\d+)$/i.exec(wb || "");
  return m ? `EV${m[1]}` : ucfirst(wb);
}

// I nomi arrivano da ocpp.ini scritto a mano: "giardino" e "Giardino" devono
// comparire allo stesso modo in legenda, tooltip e statistiche.
function ucfirst(s){
  const t = String(s == null ? "" : s).trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}

// Quante wallbox ha l'IMPIANTO, non quante compaiono nei dati caricati.
// La mappa iniettata dal server elenca le sezioni di ocpp.ini che sono wallbox.
function wbConfiguredCount(){
  const named = (typeof window !== "undefined" && window.OCPP_WALLBOX_NAMES) || {};
  return Object.keys(named).length;
}

// Vero quando ha senso dire QUALE wallbox ha caricato.
//
// Non basta contare le wallbox presenti nei dati: se un giorno carico in
// giardino e il giorno dopo in garage, ogni singolo giorno ne ha una sola e i
// due giorni si disegnerebbero identici, senza dire quale. Decide la
// configurazione; il conteggio dei dati resta come ripiego per quando la mappa
// manca (server vecchio, sezioni senza parametri WALLBOX*).
function wbIdentifyNeeded(dataCount){
  return wbConfiguredCount() > 1 || (dataCount || 0) > 1;
}

// Somma dei kWh da FV di sessione (col 11). Ritorna null se ANCHE UNA sola
// sessione del giorno non ce l'ha, cosi' il chiamante ricade sulla stima per
// tutto il giorno.
//
// Serve per il giorno del passaggio di formato: le sessioni scritte prima del
// riavvio non hanno la col 11, e sommare solo quelle che ce l'hanno farebbe
// contare 0 il FV della mattina lasciandone i kWh nel totale -> percentuale
// falsata. Meglio un metodo solo, coerente, per l'intero giorno.
function sumSessionPv(sessionsMeta){
  if (!sessionsMeta?.length) return null;
  let tot = 0;
  for (const s of sessionsMeta){
    if (typeof s.pvKwh !== "number" || !isFinite(s.pvKwh)) return null;
    tot += s.pvKwh;
  }
  return tot;
}

// Stessa regola di sumSessionPv: o tutte le sessioni hanno la col 11, o niente
// scomposizione. Una somma parziale darebbe percentuali false.
function pvKwhByWallbox(sessionsMeta){
  if (!sessionsMeta?.length) return null;
  const out = {};
  for (const s of sessionsMeta){
    if (typeof s.pvKwh !== "number" || !isFinite(s.pvKwh)) return null;
    if (!s.wb) continue;
    out[s.wb] = (out[s.wb] || 0) + s.pvKwh;
  }
  return out;
}

function totalKwhFromSessions(sessionsMeta){
  let tot = 0;
  for (const s of sessionsMeta){
    if (Number.isFinite(s.kwh)) tot += s.kwh;
  }
  return tot;
}

function parseChargeSessions(txt) {
  const rows = [];
  for (const line of txt.split("\n").filter(Boolean)) {
    const r = chgRow(line);
    if (r) rows.push(r);
  }
  if (!rows.length) return [];

  // primo/ultimo timestamp per wallbox (sessioni cross-day e ancora aperte)
  const firstTs = new Map(), lastTs = new Map();
  for (const r of rows) {
    if (!firstTs.has(r.wb)) firstTs.set(r.wb, r.ts);
    lastTs.set(r.wb, r.ts);
  }

  // Stato di apertura PER WALLBOX. Prima era uno solo per tutto il file, quindi
  // due auto in carica insieme collassavano in una sessione sola e la seconda
  // spariva dal conteggio.
  const open         = new Map();   // wb -> epoch di apertura
  const crossDayUsed = new Map();   // wb -> bool, evita la doppia cross-day (Transaction.End + StopTransaction)
  const sessions     = [];

  for (const r of rows) {
    const wb = r.wb;

    if (chgIsBegin(r)) {
      // se la sessione è già aperta su questa wallbox, ignora i re-trigger (es. dopo riavvio HA)
      if (!open.has(wb)) {
        open.set(wb, r.ts);
        crossDayUsed.set(wb, false);
      }
      continue;
    }

    if (chgIsEnd(r)) {
      if (open.has(wb)) {
        // sessione normale (Begin e End nello stesso file)
        const start = open.get(wb) * 1000;
        const end   = r.ts * 1000;
        if (end > start) sessions.push({ start, end, wb });
        open.delete(wb);
        crossDayUsed.set(wb, true); // evita che il paired StopTransaction crei una phantom cross-day
      } else if (!crossDayUsed.get(wb) && firstTs.has(wb)) {
        // sessione cross-day: Begin era nel file del giorno precedente
        const start = firstTs.get(wb) * 1000;
        const end   = r.ts * 1000;
        if (end > start) sessions.push({ start, end, wb });
        crossDayUsed.set(wb, true);
      }
    }
  }

  // se restano aperte (sessioni ancora in corso) le chiudiamo "a fine file",
  // all'ultimo timestamp della rispettiva wallbox
  for (const [wb, startEpoch] of open) {
    const last = lastTs.get(wb);
    if (Number.isFinite(last) && last > startEpoch) {
      sessions.push({ start: startEpoch * 1000, end: last * 1000, wb });
    }
  }

  sessions.sort((a, b) => a.start - b.start);
  return sessions;
}


// === Formato _charge.dat ===
// Colonne fisse (formato multiwallbox):
//   0 epoch   1 hhmmss   2 .usec   3 volt   4 current   5 offered   6 power   7 wh
//   8 tid     9 wallbox  10 session_kwh   11 session_pv_kwh   12 [context]
//  13..21  solo su Transaction.End: start secs kwh pv_kwh grid_kwh pv% avg_kw avg_A_off avg_A_mis
// Formato legacy (una sola wallbox): si ferma a 8, con il context all'indice 9.
//
// NB: split("\t") e NON /\s+/. Un campo vuoto produce due tab adiacenti e
// /\s+/ li collasserebbe in un separatore solo, slittando tutti gli indici
// successivi. Con il tab un campo vuoto resta "".
const CHG_NEW_MIN_COLS = 12;
const CHG_LEGACY_WB    = "wallbox01";

function chgRow(line){
  const parts = line.split("\t");
  if (parts.length < 9) return null;

  const ts = parseInt(parts[0], 10);
  if (!Number.isFinite(ts)) return null;

  const isNew = parts.length >= CHG_NEW_MIN_COLS;

  return {
    ts,
    isNew,
    wb:           isNew ? (parts[9]  || CHG_LEGACY_WB) : CHG_LEGACY_WB,
    ctx:          isNew ? (parts[12] || "") : (parts[9] || ""),
    powerRaw:     parts[6],
    energyRegRaw: parts[7],
    sessionKwh:   isNew ? parseFloat(parts[10]) : NaN,
    sessionPvKwh: isNew ? parseFloat(parts[11]) : NaN
  };
}

// Match ancorato al campo context, non a tutta la riga: la colonna 9 contiene
// l'id wallbox su OGNI riga, quindi un match globale sarebbe falsabile.
function chgIsBegin(r){ return r.ctx.includes("Transaction.Begin"); }
function chgIsEnd(r){   return r.ctx.includes("Transaction.End") || r.ctx.includes("StopTransaction"); }

// Somma più serie a gradini sull'unione dei loro timestamp. Prima del primo
// punto una serie non contribuisce; dopo l'ultimo mantiene il valore, cosa
// sicura perché la fine sessione inserisce uno 0 esplicito.
function sumSeriesHold(list){
  const series = (list || []).filter(s => s && s.length);
  if (!series.length) return [];
  if (series.length === 1) return series[0].slice();

  const xs = [...new Set(series.flatMap(s => s.map(p => p.x)))].sort((a, b) => a - b);
  const idx     = series.map(() => 0);
  const cur     = series.map(() => 0);
  const started = series.map(() => false);
  const out = [];

  for (const x of xs){
    for (let i = 0; i < series.length; i++){
      const s = series[i];
      while (idx[i] < s.length && s[idx[i]].x <= x){
        cur[i] = s[idx[i]].y;
        started[i] = true;
        idx[i]++;
      }
    }
    let sum = 0;
    for (let i = 0; i < series.length; i++) if (started[i]) sum += cur[i] || 0;
    out.push({ x, y: sum });
  }
  return out;
}

// Ultimo valore di una serie dentro [t0,t1]: serve per session_kwh, che è
// running, quindi l'ultimo campione della sessione È il totale di sessione.
// Totale di un contatore di sessione dentro [t0,t1].
//
// I contatori salgono da zero, ma ai confini di sessione il file porta due
// sporcizie, viste sul 26/09 dove fine e inizio cadono nello stesso secondo:
//
//   17:25:49  kWh=14.439  FV=14.277   Transaction.End           <- sessione 1
//   17:25:49  kWh=0       FV=14.277   Transaction.Begin-Start   <- sessione 2, FV vecchio
//   17:49:05  kWh=0       FV=0.427    Transaction.End-Stop      <- kWh azzerato, FV no
//
// L'ultimo campione sbaglia (prende lo zero della riga di apertura), e il solo
// massimo pure (prende il residuo in testa). Si scarta quindi tutto cio' che
// precede la ripartenza da zero, e del resto si prende il massimo.
function sessionTotal(series, t0, t1){
  if (!series?.length) return null;

  const win = [];
  for (const p of series){
    if (p.x < t0) continue;
    if (p.x > t1) break;
    if (typeof p.y === "number" && isFinite(p.y)) win.push(p.y);
  }
  if (!win.length) return null;

  const zero = win.indexOf(0);
  const from = zero >= 0 ? zero : 0;   // nessuno zero: la sessione non riparte, si tiene tutto
  let v = null;
  for (let i = from; i < win.length; i++) if (v == null || win[i] > v) v = win[i];
  return v;
}

function lastInWindow(series, t0, t1){
  if (!series?.length) return null;
  let v = null;
  for (const p of series){
    if (p.x < t0) continue;
    if (p.x > t1) break;
    v = p.y;
  }
  return (typeof v === "number" && isFinite(v)) ? v : null;
}

function parseChargeDat(text){
  const lines = text.split("\n").filter(Boolean);

  const byWb = new Map();
  let isNewFormat = false;

  const wbOf = (wb) => {
    if (!byWb.has(wb)) byWb.set(wb, { power: [], energyReg: [], sessionKwh: [], sessionPvKwh: [] });
    return byWb.get(wb);
  };

  for(const line of lines){
    const r = chgRow(line);
    if (!r) continue;
    if (r.isNew) isNewFormat = true;

    const w   = wbOf(r.wb);
    const xms = r.ts * 1000;

    // se parts[6] contiene "/" non è potenza (es. StopTransaction sposta le colonne)
    if (r.powerRaw && !r.powerRaw.includes("/")) {
      const powerW = parseFloat(r.powerRaw);
      if (Number.isFinite(powerW)){
        w.power.push({ x: xms, y: powerW / 1000 });  // kW
      }
    }

    // segna fine sessione con 0 W così resampleHold non estende l'ultimo valore
    if (chgIsEnd(r)) {
      w.power.push({ x: xms, y: 0 });
    }

    // accetta "NNN/NNN" o "NNN" (numeri puri) - rifiuta "120/120-1" (limite sessione)
    if (r.energyRegRaw && /^[\d\/]+$/.test(r.energyRegRaw)){
      const totalEnergy = parseFloat(r.energyRegRaw.split("/")[0]);
      if (Number.isFinite(totalEnergy)){
        w.energyReg.push({ x: xms, y: totalEnergy / 1000 }); // kWh
      }
    }

    if (Number.isFinite(r.sessionKwh))   w.sessionKwh.push({   x: xms, y: r.sessionKwh });
    if (Number.isFinite(r.sessionPvKwh)) w.sessionPvKwh.push({ x: xms, y: r.sessionPvKwh });
  }

  for (const w of byWb.values()){
    w.power        = normalizeSeries(w.power);
    w.energyReg    = normalizeSeries(w.energyReg);
    w.sessionKwh   = normalizeSeries(w.sessionKwh);
    w.sessionPvKwh = normalizeSeries(w.sessionPvKwh);
  }

  const wallboxes = [...byWb.keys()].sort();

  // Il totale è la SOMMA delle wallbox, non la concatenazione: prima le righe
  // delle due wallbox finivano nello stesso array e la curva saltellava tra i
  // due valori invece di sommarli.
  const evPower = sumSeriesHold(wallboxes.map(k => byWb.get(k).power));

  // Il registro assoluto è per-wallbox: sommare due cumulativi indipendenti ha
  // senso come livello, mai come delta. I kWh di sessione vengono da
  // session_kwh (col 10) in buildSessionsMeta.
  const evEnergy = wallboxes.length === 1
    ? byWb.get(wallboxes[0]).energyReg
    : sumSeriesHold(wallboxes.map(k => byWb.get(k).energyReg));

  return { evPower, evEnergy, byWb, wallboxes, isNewFormat };
}

function parseSolarDat(text){
  const lines = text.split("\n").filter(Boolean);
  const solarKw = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;

    const ts = parseInt(parts[0], 10);
    const w  = parseFloat(parts[3]);

    if (!Number.isFinite(ts) || !Number.isFinite(w)) continue;

    solarKw.push({ x: ts * 1000, y: w / 1000 });
  }

  return { solarKw };
}

function parseMeterDat(text){
  const lines = text.split("\n").filter(Boolean);

  const gridKw = [];

  for(const line of lines){

    const parts = line.trim().split(/\s+/);

    if (parts.length < 6) continue;

    const ts = parseInt(parts[0],10);
    const gridW = parseFloat(parts[5]);

    if (!Number.isFinite(ts) || !Number.isFinite(gridW)) continue;

    gridKw.push({ x: ts * 1000, y: gridW / 1000 });
  }

  return { gridKw };
}


// Colori delle serie per-wallbox: distinti da verde totale, rosa grid, azzurro solar.
const WB_COLORS   = ["#a3e635", "#a855f7", "#f59e0b", "#14b8a6"];
const WB_BAR_FILL = ["rgba(163,230,53,0.75)", "rgba(168,85,247,0.75)",
                     "rgba(245,158,11,0.75)", "rgba(20,184,166,0.75)"];

function wbLabel(wb){
  return `${wbShort(wb)} (kW)`;
}

// Con una sola wallbox non aggiunge niente: la curva totale è già quella.
function perWallboxDatasets(charge){
  // Con il filtro su una sola wallbox la curva principale e' gia' la sua:
  // una seconda linea tratteggiata identica sarebbe solo rumore.
  if (wbFilter !== "both") return [];

  const plots = charge?.wbPlot || [];
  if (plots.length < 2) return [];

  return plots.map((p, i) => ({
    label: wbLabel(p.wb),
    wbKey: p.wb,          // il tooltip le riconosce e le accorpa nella riga EV
    data: p.power,

    // Sopra a tutto (Chart.js disegna per ultimo l'order piu' basso): con una
    // sola wallbox che carica la sua curva coincide con "EV Power", e a parita'
    // di order vinceva quella - riempita e piu' spessa - lasciando il
    // tratteggio colorato invisibile sotto. Il tooltip diceva viola, il grafico
    // mostrava verde.
    order: 0,
    tension: 0.2,
    yAxisID: "yPower",
    parsing: false,
    pointRadius: 0,
    fill: false,
    borderColor: WB_COLORS[i % WB_COLORS.length],
    borderWidth: 1.5,
    borderDash: [4, 3]
  }));
}

function drawHistoryChart(charge, meter, solar, sessions, sessionsMeta){
  // Il grafico del giorno sono curve di potenza: col tasto valuta non cambia
  // niente, e non deve restare in piedi il modo di ridisegnare quello prima.
  lastChart = null;

  const canvas = document.getElementById("historyChart");
  const ctx = canvas.getContext("2d");

  if (historyChart) historyChart.destroy();

  // Quale curva "EV" ha senso mostrare:
  //  - filtro su una wallbox  -> la sua, col suo nome
  //  - una sola wallbox nei dati del giorno -> idem, "EV Power" sarebbe un
  //    totale di una cosa sola
  //  - altrimenti il totale, con la scomposizione nel tooltip
  const wbsInData = charge?.wallboxes || [];
  const picked = (wbFilter !== "both")
    ? (charge?.wbPlot || []).find(p => p.wb === wbFilter)
    : null;
  const soloWb = picked ? picked.wb : (wbsInData.length === 1 ? wbsInData[0] : null);

  const evData  = picked ? picked.power : charge.evPower;
  const evLabel = soloWb ? `${wbShort(soloWb)} Power (kW)` : "EV Power (kW)";

  historyChart = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [
        {
          label: evLabel,
          data: evData,
          order: 2,
          borderWidth: 2,
          tension: 0.2,
          yAxisID: "yPower",
          parsing: false,
          pointRadius: 0,
          fill: true,
          backgroundColor: "rgba(34,197,94,0.25)",
          borderColor: "#22c55e",
          borderWidth: 2
        },
        // una serie per wallbox, solo quando ce n'è più di una
        ...perWallboxDatasets(charge),
        {
          label: "Grid Power (kW)",
          data: meter.gridKw,
          order: 3,
          tension: 0.2,
          yAxisID: "yPower",
          parsing: false,
          pointRadius: 0,
          borderColor: "#f43f5e",
          borderWidth: 2,
          fill: false
        },
        ...(solar.solarKw.length ? [{
          label: "Solar Power (kW)",
          data: solar.solarKw,
          order: 1,
          tension: 0.2,
          yAxisID: "yPower",
          parsing: false,
          pointRadius: 0,
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56,189,248,0.15)",
          borderWidth: 2,
          fill: true
        }] : [])
      ]
    },

    plugins: [window.zeroLinePlugin],

    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },

      plugins: {
        sessionBands: { sessions },
        zoom: {
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: "x"
          },
          pan: {
            enabled: true,
            mode: "x",
            modifierKey: null
          },
          limits: {
            x: { min: "original", max: "original" }
          }
        },
        tooltip: {
          // Le righe per-wallbox confluiscono in quella EV: tre voci per lo
          // stesso istante (EV, Garage, Giardino) erano solo rumore.
          filter: (item) => !item.dataset.wbKey,

          callbacks: {
            label: (item) => {
              const y = item.parsed?.y;
              const base = `${item.dataset.label}: ${
                (typeof y === "number" && isFinite(y)) ? fmtNum(y, 2) : "—"}`;

              if (item.dataset.label !== evLabel) return base;

              // "EV Power (kW): 7.20 (Garage 3.20 · Giardino 4.00)".
              // Le serie sono ricampionate sulla stessa griglia, quindi
              // dataIndex vale per tutte.
              const parts = [];
              for (const ds of item.chart.data.datasets) {
                if (!ds.wbKey) continue;
                const v = ds.data?.[item.dataIndex]?.y;
                if (typeof v !== "number" || !isFinite(v)) continue;
                parts.push(`${wbShort(ds.wbKey)} ${fmtNum(v, 2)}`);
              }
              return parts.length ? `${base} (${parts.join(" · ")})` : base;
            },

            // Riga extra nel tooltip: Sessione #, durata, kWh
            afterBody: (items) => {
              const ts = items?.[0]?.parsed?.x;
              if (!ts) return "";

              const s = window.findSessionMetaAt(sessionsMeta, ts);
              if (!s) return "";

              const kwhStr = (s.kwh == null) ? "—" : fmtNum(s.kwh, 2) + " kWh";
              const fmt = (ms) => new Date(ms).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
              const h = Math.floor(s.durMin / 60);
              const m = s.durMin % 60;
              const durStr = h > 0 ? `${h}h ${String(m).padStart(2,"0")}min` : `${m}min`;
              // con piu' wallbox la sessione va attribuita, altrimenti "#2" e' ambiguo
              const wbStr = (wbIdentifyNeeded(charge?.wallboxes?.length) && s.wb) ? ` (${wbShort(s.wb)})` : "";
              const pvStr = (typeof s.pvKwh === "number" && isFinite(s.pvKwh)) ? ` · FV ${fmtNum(s.pvKwh, 2)} kWh` : "";
              return `#${s.n}${wbStr} · ${fmt(s.start)} → ${fmt(s.end)} · ${durStr} · ${kwhStr}${pvStr}`;
            }

          }
        }
      },

      scales: {
        x: {
          type: "time",
          time: { unit: "hour" },
          ticks: { display: false }
        },
        yPower: {
          position: "left",
          title: { display: true, text: "kW" },
          beginAtZero: false,
          afterDataLimits(scale) {
            if (scale.max > 0) scale.max *= 1.05;
            scale._dataMin = scale.min;
          },
          afterBuildTicks(scale) {
            if ((scale._dataMin ?? 0) < 0) {
              scale.ticks = scale.ticks.filter(t => t.value >= scale._dataMin);
              scale.min = scale._dataMin;
            }
          }
        }
      }
    }
  });

  setTimeout(() => historyChart.resize(), 50);
}
