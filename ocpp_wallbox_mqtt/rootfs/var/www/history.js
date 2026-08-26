let historyChart = null;
let currentDate = new Date();
let viewMode = "day";
let chartTypeMode = "bars";
const chartTypeDefaults = { day: "bars", week: "bars", month: "lines" };

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


function loadCurrentView() {
  if (viewMode === "day")   loadHistoryForDate(currentDate);
  else if (viewMode === "week")  loadHistoryForWeek(currentDate);
  else if (viewMode === "month") loadHistoryForMonth(currentDate);
}

function setViewMode(mode) {
  viewMode = mode;
  document.getElementById("btnDay").classList.toggle("active",   mode === "day");
  document.getElementById("btnWeek").classList.toggle("active",  mode === "week");
  document.getElementById("btnMonth").classList.toggle("active", mode === "month");
  document.getElementById("datePicker").style.display = mode === "month" ? "none" : "";
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

async function computeDailyTotals(d) {
  const { y, ymd } = ymdParts(d);
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

    const evMaxKw = minMax(evArr)?.max ?? 0;
    const pvMaxKw = minMax(normalizeSeries(solar.solarKw))?.max ?? 0;

    return { chargeKwh, solarKwh, importKwh, exportKwh, pvChargedKwh, evMaxKw, pvMaxKw,
             sessionCount: sessionsMeta.length,
             chargeByWb: kwhByWallbox(sessionsMeta),
             hasData: true };
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
  const wbs = wallboxesInTotals(totals);

  if (!wbs.length || !wbIdentifyNeeded(wbs.length)) {
    return [{
      label: "EV Charged (kWh)",
      metric: "ev",
      stack: "ev",
      primary: true,
      data: totals.map(t => t.hasData ? +t.chargeKwh.toFixed(2) : null),
      backgroundColor: "rgba(34,197,94,0.75)",
      borderColor: "#22c55e", borderWidth: 1
    }];
  }

  return wbs.map((wb, i) => ({
    label: `${wbShort(wb)} (kWh)`,
    metric: "ev",
    stack: "ev",
    wbKey: wb,
    primary: i === 0,
    data: totals.map(t => t.hasData ? +((t.chargeByWb || {})[wb] || 0).toFixed(2) : null),
    backgroundColor: WB_BAR_FILL[i % WB_BAR_FILL.length],
    borderColor: WB_COLORS[i % WB_COLORS.length],
    borderWidth: 1
  }));
}

function drawBarChart(labels, totals, title) {
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
          label: "Solar (kWh)",
          metric: "solar",
          stack: "solar",
          data: totals.map(t => t.hasData ? +t.solarKwh.toFixed(2) : null),
          backgroundColor: "rgba(56,189,248,0.75)",
          borderColor: "#38bdf8", borderWidth: 1
        },
        {
          label: "Grid Export (kWh)",
          metric: "export",
          stack: "export",
          data: totals.map(t => t.hasData ? +t.exportKwh.toFixed(2) : null),
          backgroundColor: "rgba(139,92,246,0.75)",
          borderColor: "#8b5cf6", borderWidth: 1
        },
        {
          label: "Grid Import (kWh)",
          metric: "import",
          stack: "import",
          data: totals.map(t => t.hasData ? +t.importKwh.toFixed(2) : null),
          backgroundColor: "rgba(244,63,94,0.75)",
          borderColor: "#f43f5e", borderWidth: 1
        },
        // Linee di trend: stessi dati delle barre, mostrate in modalita' "lines".
        // Ognuna ha il suo stack: su un asse stacked i dataset dello stesso
        // gruppo si sommerebbero, e le linee devono restare indipendenti.
        { type:"line", label:"_trend_ev",     metric:"ev",     displayLabel:"EV Charged (kWh)",  stack:"trend_ev",     data: totals.map(t => t.hasData ? +t.chargeKwh.toFixed(2) : null), borderColor:"#22c55e", borderWidth:2, pointRadius:3, pointHoverRadius:7, fill:false, tension:0.2, order:0 },
        { type:"line", label:"_trend_solar",  metric:"solar",  displayLabel:"Solar (kWh)",       stack:"trend_solar",  data: totals.map(t => t.hasData ? +t.solarKwh.toFixed(2)  : null), borderColor:"#38bdf8", borderWidth:2, pointRadius:3, pointHoverRadius:7, fill:false, tension:0.2, order:0 },
        { type:"line", label:"_trend_export", metric:"export", displayLabel:"Grid Export (kWh)", stack:"trend_export", data: totals.map(t => t.hasData ? +t.exportKwh.toFixed(2) : null), borderColor:"#8b5cf6", borderWidth:2, pointRadius:3, pointHoverRadius:7, fill:false, tension:0.2, order:0 },
        { type:"line", label:"_trend_import", metric:"import", displayLabel:"Grid Import (kWh)", stack:"trend_import", data: totals.map(t => t.hasData ? +t.importKwh.toFixed(2) : null), borderColor:"#f43f5e", borderWidth:2, pointRadius:3, pointHoverRadius:7, fill:false, tension:0.2, order:0 }

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
              const val = context.parsed.y;
              const lines = [`Total: ${val !== null ? val.toFixed(2) + " kWh" : "—"}`];

              // i "Max" sono valori del giorno, non del singolo dataset: con le
              // barre per wallbox li mostriamo una volta sola, sulla prima
              if (metric === "ev"    && ds.primary && t.evMaxKw) lines.push(`Max: ${t.evMaxKw.toFixed(2)} kW`);
              if (metric === "solar" && t.pvMaxKw)               lines.push(`Max: ${t.pvMaxKw.toFixed(2)} kW`);

              // Scomposizione per wallbox: serve solo quando la barra EV e'
              // aggregata. Se le barre sono gia' per wallbox sarebbe ridondante.
              if (metric === "ev" && !ds.wbKey) {
                const keys = Object.keys(t.chargeByWb || {}).sort();
                if (keys.length > 1) {
                  for (const wb of keys) lines.push(`${wbShort(wb)}: ${(t.chargeByWb[wb] || 0).toFixed(2)} kWh`);
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
        y: { stacked: true, beginAtZero: true, ticks: { color: "#9ca3af" }, grid: { color: "rgba(255,255,255,0.05)" } }
      }
    }
  });

  applyChartTypeMode();
  setTimeout(() => historyChart.resize(), 50);
}

// Scrive il totale caricato e, con piu' di una wallbox, la scomposizione
// accanto al numero: "7.00 kWh (EV1 2.00 · EV2 5.00)".
// Con una sola wallbox il riquadro resta identico a prima.
function setChargedStat(totKwh, byWb){
  const el = document.getElementById("statCharged");
  if (!el) return;

  el.textContent = (totKwh > 0 || Object.keys(byWb || {}).length) ? totKwh.toFixed(2) + " kWh" : "—";

  // span fratello dentro lo stesso contenitore inline: un blocco romperebbe
  // il layout flex/nowrap di .historyStats
  const host = el.parentElement;
  if (!host) return;

  const breakdown = wbBreakdownText(byWb, "");
  let sub = host.querySelector(".wbSplit");

  if (!breakdown) {
    if (sub) sub.remove();
    return;
  }
  if (!sub) {
    sub = document.createElement("span");
    sub.className = "wbSplit";
    el.insertAdjacentElement("afterend", sub);
  }
  sub.textContent = ` (${breakdown})`;
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

  document.getElementById("statEv").textContent       = evMax ? evMax.toFixed(2) + " kW" : "—";
  const totCharge = sum("chargeKwh");
  const byWb      = mergeKwhByWallbox(totals.map(t => t.chargeByWb));
  setChargedStat(totCharge, byWb);
  const totPvCharged = sum("pvChargedKwh");
  document.getElementById("statPvCharged").textContent = totPvCharged > 0 ? totPvCharged.toFixed(2) + " kWh" : "—";
  const pctPv = (totCharge > 0 && totPvCharged > 0) ? Math.min(100, totPvCharged / totCharge * 100) : 0;
  document.getElementById("statPvChargedPct").textContent = pctPv > 0 ? pctPv.toFixed(0) + "%" : "—";
  document.getElementById("statSessions").textContent = sessions || "—";
  document.getElementById("statPvMax").textContent    = pvMax ? pvMax.toFixed(2) + " kW" : "—";
  document.getElementById("statSolar").textContent    = sum("solarKwh").toFixed(2) + " kWh";
  document.getElementById("statGridImport").textContent = sum("importKwh").toFixed(2) + " kWh";
  document.getElementById("statGridExport").textContent = sum("exportKwh").toFixed(2) + " kWh";
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

    // Formato nuovo: session_kwh (col 10) e' running, quindi l'ultimo valore
    // dentro la finestra E' il totale di sessione. Nessun delta di registri.
    if (w?.sessionKwh?.length) {
      kwh   = lastInWindow(w.sessionKwh,   s.start, s.end);
      pvKwh = lastInWindow(w.sessionPvKwh, s.start, s.end);
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
  evMM ? `${evMM.max.toFixed(2)} kW` : "—";

const totalKwh = sessionsMeta.reduce((acc,s)=>acc+(s.kwh||0),0);
setChargedStat(totalKwh, kwhByWallbox(sessionsMeta));

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
document.getElementById("statPvCharged").textContent =
  pvChargedKwh > 0 ? pvChargedKwh.toFixed(2)+" kWh" : "—";
const pvPct = (totalKwh > 0 && pvChargedKwh > 0) ? (pvChargedKwh / totalKwh * 100) : 0;
document.getElementById("statPvChargedPct").textContent =
  pvPct > 0 ? pvPct.toFixed(0)+"%" : "—";

document.getElementById("statPvMax").textContent =
  pvMM ? pvMM.max.toFixed(2)+" kW" : "—";

// energia solare totale: integrazione trapezoidale (dati resampled a 30s)
let solarKwh = 0;
for (let i = 1; i < solar.solarKw.length; i++) {
  const dtH = (solar.solarKw[i].x - solar.solarKw[i-1].x) / 3600000;
  solarKwh += (solar.solarKw[i].y + solar.solarKw[i-1].y) / 2 * dtH;
}
document.getElementById("statSolar").textContent =
  solarKwh > 0 ? solarKwh.toFixed(2)+" kWh" : "—";

// grid export giornaliero: integra solo i valori negativi (negativo = immissione)
let gridExportKwh = 0;
let gridImportKwh = 0;
for (let i = 1; i < meter.gridKw.length; i++) {
  const dtH = (meter.gridKw[i].x - meter.gridKw[i-1].x) / 3600000;
  const avg = (meter.gridKw[i].y + meter.gridKw[i-1].y) / 2;
  if (avg < 0) gridExportKwh += Math.abs(avg) * dtH;
  else gridImportKwh += avg * dtH;
}
document.getElementById("statGridExport").textContent =
  gridExportKwh > 0 ? gridExportKwh.toFixed(2)+" kWh" : "—";
document.getElementById("statGridImport").textContent =
  gridImportKwh > 0 ? gridImportKwh.toFixed(2)+" kWh" : "—";

document.getElementById("statSessions").textContent =
  sessionsMeta.length;


  drawHistoryChart(charge, meter, solar, sessions, sessionsMeta);
}

// kWh per wallbox a partire dalle sessioni: {wallbox01: 2.0, wallbox02: 5.0}
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
function wbBreakdownText(byWb, unit = " kWh"){
  const keys = Object.keys(byWb || {}).sort();
  if (!keys.length || !wbIdentifyNeeded(keys.length)) return "";
  return keys.map(wb => `${wbShort(wb)} ${(byWb[wb] || 0).toFixed(2)}${unit}`).join(" · ");
}

// Nome leggibile di una wallbox. Priorita':
//  1. WALLBOX_MQTT_NAME dalla sua sezione di ocpp.ini, iniettato dal server
//     in window.OCPP_WALLBOX_NAMES (la colonna 9 dei .dat E' l'id di sezione)
//  2. "EV<n>" se l'id segue la convenzione wallboxNN
//  3. l'id cosi' com'e' (le sezioni possono avere nomi arbitrari)
function wbShort(wb){
  const named = (typeof window !== "undefined" && window.OCPP_WALLBOX_NAMES) || {};
  const n = named[wb];
  if (typeof n === "string" && n.trim()) return n.trim();

  const m = /^wallbox0*(\d+)$/i.exec(wb || "");
  return m ? `EV${m[1]}` : (wb || "");
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
  const plots = charge?.wbPlot || [];
  if (plots.length < 2) return [];

  return plots.map((p, i) => ({
    label: wbLabel(p.wb),
    data: p.power,
    order: 2,
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

  const canvas = document.getElementById("historyChart");
  const ctx = canvas.getContext("2d");

  if (historyChart) historyChart.destroy();

  historyChart = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [
        {
          label: "EV Power (kW)",
          data: charge.evPower,
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
          callbacks: {
            // Riga extra nel tooltip: Sessione #, durata, kWh
            afterBody: (items) => {
              const ts = items?.[0]?.parsed?.x;
              if (!ts) return "";

              const s = window.findSessionMetaAt(sessionsMeta, ts);
              if (!s) return "";

              const kwhStr = (s.kwh == null) ? "—" : s.kwh.toFixed(2) + " kWh";
              const fmt = (ms) => new Date(ms).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
              const h = Math.floor(s.durMin / 60);
              const m = s.durMin % 60;
              const durStr = h > 0 ? `${h}h ${String(m).padStart(2,"0")}min` : `${m}min`;
              // con piu' wallbox la sessione va attribuita, altrimenti "#2" e' ambiguo
              const wbStr = (wbIdentifyNeeded(charge?.wallboxes?.length) && s.wb) ? ` (${wbShort(s.wb)})` : "";
              const pvStr = (typeof s.pvKwh === "number" && isFinite(s.pvKwh)) ? ` · FV ${s.pvKwh.toFixed(2)} kWh` : "";
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
