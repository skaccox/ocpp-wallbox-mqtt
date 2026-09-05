   function setHeaderHeightVar(){
      const h = document.querySelector("header")?.offsetHeight || 64;
      document.documentElement.style.setProperty("--header-h", h + "px");
    }
    
    
let lastGoodKw = null;
let lastGoodKwh = null;
let lastGoodKwTs = null; // timestamp log dell’ultima CHG* valida
let lastGoodExporting = false;
window.currentMode = (window.OCPP_DEFAULT_VIEW === "graph") ? "history" : "live";


    const elLog = document.getElementById("log");
    const elLines = document.getElementById("lines");
    const elRefresh = document.getElementById("refresh");
    const elStatus = document.getElementById("status");
    const btnBottom = document.getElementById("btnBottom");
    const elFilter = document.getElementById("filter");
    const elKw = document.getElementById("kw");
    const elPv = document.getElementById("pv");
    const elLogo = document.getElementById("logo");
    const elKwh = document.getElementById("kwh");

    const elSpark = document.getElementById("spark");
    const sparkCtx = elSpark?.getContext("2d");

    const sparkData = [];
    const sparkTime = [];

    const SPARK_MAX = 120; // ~4 minuti se refresh 2s

    const bigCanvas = document.getElementById("powerChart");
    const bigCtx = bigCanvas.getContext("2d");

    function resizeBigChart(){
      const dpr = window.devicePixelRatio || 1;
      const rect = bigCanvas.getBoundingClientRect();

      bigCanvas.width  = rect.width * dpr;
      bigCanvas.height = rect.height * dpr;

      bigCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    window.addEventListener("resize", () => { setHeaderHeightVar(); resizeBigChart(); });
    window.resizeBigChart = resizeBigChart;

    setTimeout(() => { setHeaderHeightVar(); resizeBigChart(); }, 50);
    
    


    
    let followBottom = true;
    let gridLimitW = null; // es. 4000
    let isExporting = false;   // <-- serve per grafico + badge

    function isNearBottom(px = 120) {
      const scrollPos = window.scrollY + window.innerHeight;
      const bottom = document.documentElement.scrollHeight;
      return (bottom - scrollPos) <= px;
    }

    // Se l'utente scrolla su, disattiva il follow. Se torna giù, riattiva.
    window.addEventListener("scroll", () => {
      followBottom = isNearBottom();
    }, { passive: true });

    // Quando l'utente interagisce con input, blocca follow
    ["focus", "input"].forEach(evt => {
      elFilter.addEventListener(evt, () => followBottom = false);
      elLines.addEventListener(evt, () => followBottom = false);
      elRefresh.addEventListener(evt, () => followBottom = false);
    });

    // Righe da caricare: il tetto e' 10000 anche lato server (run.sh, /log?n=).
    // Con normalize=true riscrive il campo, altrimenti resta a schermo un
    // valore piu' alto di quello che viene davvero chiesto.
    const LINES_MIN = 50, LINES_MAX = 10000;
    function linesValue(normalize) {
      let n = parseInt(elLines.value, 10);
      if (!isFinite(n)) n = 800;
      n = Math.max(LINES_MIN, Math.min(LINES_MAX, n));
      if (normalize && String(n) !== elLines.value) elLines.value = String(n);
      return n;
    }

    // Solo su change (blur/invio): normalizzare su "input" romperebbe la
    // digitazione, "1" di 10000 verrebbe subito riscritto a 50
    elLines.addEventListener("change", () => linesValue(true));

    // Bottone "Vai in fondo": riattiva follow e scende
    btnBottom.addEventListener("click", () => {
      followBottom = true;
      window.scrollTo(0, document.body.scrollHeight);
    });
	
function parseLogTsMs(line) {
  const m = line.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [_, Y, Mo, D, h, mi, s] = m;
  return new Date(+Y, +Mo - 1, +D, +h, +mi, +s).getTime();
}

function getLastLogTimestamp(lines){
  for (let i = lines.length - 1; i >= 0; i--) {
    const ts = parseLogTsMs(lines[i]);
    if (ts != null) return ts;
  }
  return null;
}

function chgHasPower(line) {
  if (!/\bCHG\*/.test(line)) return false;
  const m = line.match(/\bP\s*=\s*([0-9]+(?:[.,][0-9]+)?)/); // niente \b finale
  if (!m) return false;
  const p = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(p) && p > 50;
}


    function escapeHtml(s) {
      return s.replace(/[&<>"']/g, m => ({
        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        '"':"&quot;",
        "'":"&#039;"
      }[m]));
    }

    function drawBigChart(){
      const w = bigCanvas.clientWidth;
      const h = bigCanvas.clientHeight;

      bigCtx.clearRect(0, 0, w, h);

      if (sparkData.length < 2) return;

      const maxRaw = Math.max(...sparkData, 1);

      // se ho la soglia, includila nella scala
      const limitKw = (typeof gridLimitW === "number" && isFinite(gridLimitW))
        ? (gridLimitW / 1000.0)
        : null;

      let maxForScale = maxRaw;
      if (limitKw != null && limitKw > 0) {
        maxForScale = Math.max(maxForScale, limitKw);
      }

      // margine +10% così la soglia non sta attaccata al bordo
      maxForScale *= 1.10;

      // arrotonda a 0.5 kW
      const max = Math.max(1, Math.ceil(maxForScale * 2) / 2);


      const padL = 54;
      const padR = 90;   // spazio per valore live + label soglia
      const padT = 8;
      const padB = 22;

      const cw = Math.max(1, w - padL - padR);
      const ch = Math.max(1, h - padT - padB);

      // helpers
      const xAt = (i) => padL + i / (sparkData.length - 1) * cw;
      const yAt = (v) => padT + (1 - (v / max)) * ch;

      /* ==== Griglia + asse Y ==== */
      const steps = 4;
      bigCtx.font = "12px system-ui";
      bigCtx.fillStyle = "rgba(255,255,255,.55)";
      bigCtx.strokeStyle = "rgba(255,255,255,.08)";
      bigCtx.lineWidth = 1;

      for (let i = 0; i <= steps; i++){
        const y = padT + (steps - i) / steps * ch;
        const value = max * i / steps;

        bigCtx.beginPath();
        bigCtx.moveTo(padL, y);
        bigCtx.lineTo(padL + cw, y);
        bigCtx.stroke();

        bigCtx.fillText(value.toFixed(1) + " kW", 6, y + 4);
      }

      /* ==== Asse X (tempo) ==== */
      if (sparkTime.length >= 2){
        const t0 = sparkTime[0];
        const t1 = sparkTime[sparkTime.length - 1];
        const range = Math.max(1, t1 - t0);

        const ms = parseInt(elRefresh?.value || "2000", 10);
        const tick = (ms > 2500) ? 60000 : 30000;

        bigCtx.fillStyle = "rgba(255,255,255,.45)";
        bigCtx.font = "11px system-ui";

        const MIN_LABEL_GAP = 52; // px minimi tra etichette
        let lastLabelX = -Infinity;

        for (let i = 0; i < sparkTime.length; i++){
          const t = sparkTime[i];
          const onTick = ((t - t0) % tick) < (ms + 60);
          if (!onTick) continue;

          const x = padL + ((t - t0) / range) * cw;
          if (x - lastLabelX < MIN_LABEL_GAP) continue;

          bigCtx.strokeStyle = "rgba(255,255,255,.10)";
          bigCtx.beginPath();
          bigCtx.moveTo(x, padT + ch);
          bigCtx.lineTo(x, padT + ch + 4);
          bigCtx.stroke();

          const d = new Date(t);
          const label = d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
          const tw = bigCtx.measureText(label).width;

          bigCtx.fillText(
            label,
            Math.min(padL + cw - tw, Math.max(padL, x - tw/2)),
            h - 6
          );
          lastLabelX = x;
        }
      }

      /* ==== Soglia GRID LIMIT ==== */
      if (limitKw != null && limitKw > 0) {
        const y = yAt(Math.min(limitKw, max));

        bigCtx.strokeStyle = "rgba(251,113,133,.75)";
        bigCtx.lineWidth = 2;
        bigCtx.setLineDash([6,4]);
        bigCtx.beginPath();
        bigCtx.moveTo(padL, y);
        bigCtx.lineTo(padL + cw, y);
        bigCtx.stroke();
        bigCtx.setLineDash([]);

        bigCtx.font = "12px system-ui";
        bigCtx.fillStyle = "rgba(251,113,133,.9)";
        bigCtx.fillText(
          "LIMIT " + limitKw.toFixed(2) + " kW",
          padL + cw + 10,
          Math.min(h - padB, Math.max(padT + 12, y + 4))
        );
      }


      /* ==== Area sotto la curva (fill gradient) ==== */
      bigCtx.beginPath();
      sparkData.forEach((v, i) => {
        const x = xAt(i);
        const y = yAt(v);
        if (i === 0) bigCtx.moveTo(x, y);
        else bigCtx.lineTo(x, y);
      });

      // chiudi area verso il basso
      bigCtx.lineTo(padL + cw, padT + ch);
      bigCtx.lineTo(padL, padT + ch);
      bigCtx.closePath();

      const grad = bigCtx.createLinearGradient(0, padT, 0, padT + ch);
      if (isExporting) {
        grad.addColorStop(0, "rgba(34,197,94,.55)");  // più pieno
        grad.addColorStop(1, "rgba(34,197,94,0)");
      } else {
        grad.addColorStop(0, "rgba(34,197,94,.35)");
        grad.addColorStop(1, "rgba(34,197,94,0)");
      }


      bigCtx.fillStyle = grad;
      bigCtx.fill();



// ==== AREA ROSSA SOPRA LIMITE (solo se superi) ====
if (limitKw != null && limitKw > 0) {
  const yLimit = yAt(Math.min(limitKw, max));

  // controlla se c'è almeno un punto sopra soglia
  const over = sparkData.some(v => v > limitKw);

  if (over) {
    bigCtx.save();

    // clip: solo la zona SOPRA la linea limite
    bigCtx.beginPath();
    bigCtx.rect(padL, padT, cw, Math.max(0, yLimit - padT));
    bigCtx.clip();

    // riusa la stessa area sotto curva (così colora solo la parte sopra)
    bigCtx.beginPath();
    sparkData.forEach((v, i) => {
      const x = xAt(i);
      const y = yAt(v);
      if (i === 0) bigCtx.moveTo(x, y);
      else bigCtx.lineTo(x, y);
    });
    bigCtx.lineTo(padL + cw, padT + ch);
    bigCtx.lineTo(padL, padT + ch);
    bigCtx.closePath();

    const rgrad = bigCtx.createLinearGradient(0, padT, 0, padT + ch);
    rgrad.addColorStop(0, "rgba(251,113,133,.28)");
    rgrad.addColorStop(1, "rgba(251,113,133,0)");

    bigCtx.fillStyle = rgrad;
    bigCtx.fill();

    bigCtx.restore();
  }
}

      /* ==== Linea potenza sopra l’area ==== */
      bigCtx.beginPath();
      sparkData.forEach((v, i) => {
        const x = xAt(i);
        const y = yAt(v);
        if (i === 0) bigCtx.moveTo(x, y);
        else bigCtx.lineTo(x, y);
      });

      bigCtx.strokeStyle = isExporting ? "rgba(34,197,94,1)" : "#22c55e";
      bigCtx.lineWidth   = isExporting ? 2.5 : 2;
      bigCtx.stroke();

      /* ==== Ultimo punto + valore live a destra ==== */
      const last = sparkData[sparkData.length - 1];
      const lx = padL + cw;
      const ly = yAt(last);

      bigCtx.beginPath();
      bigCtx.arc(lx - 4, ly, 4, 0, Math.PI * 2);
      bigCtx.fillStyle = "#22c55e";
      bigCtx.fill();

      const live = last.toFixed(2) + " kW";
      bigCtx.font = "13px system-ui";
      bigCtx.fillStyle = "#22c55e";
      bigCtx.fillText(live, padL + cw + 10, Math.min(h - padB, Math.max(padT + 12, ly + 4)));
    }



    async function load() {

    if (window.currentMode !== "live") return;
    const n = linesValue(true);
    const url = `log?n=${n}&_=${Date.now()}`;
    const q = (elFilter.value || "").trim().toLowerCase();

    elStatus.textContent = "loading…";

    try {
      const r = await fetch(url, { cache: "no-store" });
      const txt = await r.text();

      const all = txt.split("\n").filter(x => x.length);
      // const nowLog = parseLogTsMs(all[all.length - 1]) ?? Date.now();
      const nowLog = getLastLogTimestamp(all) ?? Date.now();


      // Estrae ultimo GRID_LIMIT numerico per il grafico
      for (let i = all.length - 1; i >= 0; i--) {
        const m = all[i].match(/"GRID_LIMIT"\s*:\s*"?(\d+)"?/i);
        if (m) { gridLimitW = parseInt(m[1], 10); break; }
      }

		let liveState = null; // "CHARGE" | "AVAIL" | "STOP" | "SUSPEND"

		// Cerca SOLO righe L1/L2/L3, dall'ultima verso l'alto
		for (let i = all.length - 1; i >= 0; i--) {
		  const l = all[i];
		  if (!/\bL[123]\s*\*/.test(l)) continue;
      const m = all[i].match(/\((?:\d+\s*,\s*)?(CHARGE|AVAIL|STOP|SUSPEND|UPDATING)(?:\/(CHARGE|SUSPEND))?(?:,\s*\d+s)?\)/i);
		  if (m) {
        liveState = m[1].toUpperCase();
        if (liveState === "UPDATING") liveState = "CHARGE"; // o "UPDATING" ma trattalo come charging
        break;
      }

		}





      let isCharging = false; // carica vera = solo da CHG* fresca (vedi sotto)


      // ===== CHG* TTL: carica “vera” solo se CHG* con P>50 è recente =====
      const CHG_TTL_MS = 8000; // 8s (con refresh 2s è perfetto)
      let lastChgTs = null;

      // cerco l'ultima CHG* con potenza e prendo il suo timestamp
      for (let i = all.length - 1; i >= 0; i--) {
        const l = all[i];
        if (!chgHasPower(l)) continue;
        lastChgTs = parseLogTsMs(l);
        break;
      }

      const chgFresh = (lastChgTs != null) && ((nowLog - lastChgTs) <= CHG_TTL_MS);

      // HOLD: se L* dice CHARGE, tengo su per un attimo anche se CHG* non è ancora arrivata
      const CHG_HOLD_MS = 30000; // 30s basta per coprire il buco tra L* e CHG*
      const chgHold = (liveState === "CHARGE") && (lastGoodKwTs != null) && ((nowLog - lastGoodKwTs) <= CHG_HOLD_MS);

     const liveCharge = (liveState === "CHARGE");
     const kwHold = (lastGoodKwTs != null) && ((nowLog - lastGoodKwTs) <= 60000); // stessa logica di chargingWindow
     isCharging = liveCharge || chgFresh || chgHold || kwHold;   // <-- CHARGE = charging
     if (isCharging) liveState = "CHARGE";



      let kw = null;
      let pv = null;
      let kwh = null;



// PV: sempre da L* quando isCharging (anche in HOLD)
if (isCharging) {
  const start = Math.max(0, all.length - 300);
  for (let i = all.length - 1; i >= start; i--) {
    const l = all[i];
    if (!/\bL[123]\s*\*/.test(l)) continue;

    const mPv = l.match(/\bpv\s*[:=]\s*([0-9]+(?:[.,][0-9]+)?)\s*%?/i);
    if (mPv) { pv = parseFloat(mPv[1].replace(",", ".")); break; }
  }
}

// kW/kWh/export: solo da CHG* fresca
if (chgFresh) {
  for (let i = all.length - 1; i >= 0; i--) {
    const l = all[i];
    if (!chgHasPower(l)) continue;

    const mP = l.match(/\bP\s*=\s*([0-9]+(?:[.,][0-9]+)?)/);
    const p  = mP ? parseFloat(mP[1].replace(",", ".")) : NaN;

    if (!Number.isFinite(p)) continue;
    kw = p / 1000.0;

    const mKwh = l.match(/\bkwh\s*=\s*([0-9.]+)/i);
    if (mKwh) kwh = parseFloat(mKwh[1]);

    const mW = l.match(/\bW\s*=\s*(-?\d+)/i);
    if (mW) {
      isExporting = parseInt(mW[1], 10) < 0;
      lastGoodExporting = isExporting;
    }

    break;
  }
} else {
    isExporting = (isCharging && chgHold) ? lastGoodExporting : false;
}

if (kw != null) { lastGoodKw=kw; lastGoodKwTs=lastChgTs; }
if (kwh != null) { lastGoodKwh=kwh; }
if (kw == null && isCharging && chgHold && lastGoodKw != null) kw = lastGoodKw;
if (kwh == null && isCharging && lastGoodKwh != null) kwh = lastGoodKwh;

      // Header coerente (mostra anche AVAIL/STOP)
      if (!isCharging) {
        elKw.textContent = liveState || "-";
        elKw.className = (liveState === "STOP") ? "state-stop" : "state-avail";

        elPv.textContent = "-";
        elPv.className = "state-avail";

        elKwh.textContent = "-";
        elKwh.className = "state-avail";
      } else {
        elKw.textContent = (kw == null) ? "—" : kw.toFixed(2) + " kW";
        elKw.className = "state-chg";

        elPv.textContent = (pv == null) ? "—" : pv.toFixed(1) + "%";
        elPv.className = "state-chg";

        elKwh.textContent = (kwh == null) ? "—" : kwh.toFixed(2) + " kWh";
        elKwh.className = "state-chg";
      }

      // Badge FULL SOLAR + warn se sopra limite
      const elBadge = document.getElementById("solarBadge");
      if (elBadge) {
        const fullSolar = isCharging && (pv != null) && pv >= 98;
        elBadge.style.display = fullSolar ? "inline-flex" : "none";

        const limitKw = (typeof gridLimitW === "number" && isFinite(gridLimitW)) ? (gridLimitW / 1000) : null;
        const overNow = isCharging && limitKw != null && typeof kw === "number" && kw > limitKw;
        elBadge.classList.toggle("warn", overNow);
      }

      // Sparkline: se non CHARGE , spingi 0
      //sparkData.push(isCharging && typeof kw === "number" && isFinite(kw) ? kw : 0);
      //const v = (liveState === "CHARGE" && typeof kw === "number" && isFinite(kw)) ? kw : 0;

     /* const v =
          (isCharging && typeof kw === "number" && isFinite(kw)) ? kw :
          (isCharging && lastGoodKw != null ? lastGoodKw : 0);
      sparkData.push(v);*/

      let chargingWindow =
        (liveState === "CHARGE") ||
        (lastGoodKwTs != null && (nowLog - lastGoodKwTs) <= 60000);

      let v = null;

      if (typeof kw === "number" && isFinite(kw)) {
        v = kw;
      }
      else if (chargingWindow && lastGoodKw != null) {
        v = lastGoodKw;
      }
      else if (chargingWindow) {
        v = null; // in attesa di CHG*, non pushare 0
      }
      else {
        v = 0;
      }

      if (v != null) {
        sparkData.push(v);
        sparkTime.push(nowLog);
      }

      while (sparkData.length > SPARK_MAX) { sparkData.shift(); sparkTime.shift(); }
      drawBigChart();

      // Logo state (CHARGING)
      if (elLogo) elLogo.classList.toggle("charging", isCharging);

      // applica filtro
      const lines = q ? all.filter(l => l.toLowerCase().includes(q)) : all;

      elLog.innerHTML = lines.map((l) => {
        let c = "line";

        if (/grid safe limit exceeded/i.test(l)) c += " safe";
        else if (/\bCHG\*/.test(l)) {
          const m = l.match(/\bP=(\d+(?:\.\d+)?)\b/);
          const p = m ? parseFloat(m[1]) : 0;
          c += (p >= 2500) ? " chgH" : " chgL";
        }
        else if (/\bL[123]\b/i.test(l)) c += " dim";
        else if (/\bIncreasing to\b/i.test(l)) c += " inc";
        else if (/\b(Decreasing to|Reducing to)\b/i.test(l)) c += " dec";
        else if (/Setting default grid limits|grid limits:|GRID_LIMIT/i.test(l)) c += " gridlimit";
        else if (/Publishing retain|Publish (start|stop)|Publish charging|Publish stop/i.test(l)) c += " dim";
        else if (/StatusNotification|SecurityEventNotification/.test(l)) c += " dim";
        else if (/ERROR|FATAL|Exception/i.test(l)) c += " err";
        else if (/\bWARN\b/i.test(l)) c += " warn";
        else if (/\bINFO\b/i.test(l)) c += " dim";
        else if (/\[TX\]|\[RX\]/.test(l)) c += " dim";
        else if (/^20\d\d-/.test(l)) c += " dim";

        let raw = l;

        // marker prima dell'escape
        if (/SetChargingProfile/.test(raw)) {
          raw = raw.replace(/("?\blimit\b"?\s*:\s*)(\d+)/gi, `$1@@SCP@@$2@@/SCP@@`);
        }

        let html = escapeHtml(raw)
          .replaceAll("@@SCP@@", `<span class="scp">`)
          .replaceAll("@@/SCP@@", `</span>`);

        return `<div class="${c}">${html}</div>`;
      }).join("");

      elStatus.textContent = new Date().toLocaleTimeString();

      if (followBottom) window.scrollTo(0, document.body.scrollHeight);
    } catch (e) {
      elStatus.textContent = "errore log";
    }
  }


window.liveTimer = null;

window.startLive = function startLive() {
  if (window.liveTimer) clearInterval(window.liveTimer);
  const ms = parseInt(elRefresh.value, 10);
  if (ms > 0) window.liveTimer = setInterval(load, ms);
};

window.stopLive = function stopLive() {
  if (window.liveTimer) clearInterval(window.liveTimer);
  window.liveTimer = null;
};


    // con Refresh su OFF era il pulsante "Update" a rileggere il log: ora lo
    // fa la conferma del filtro, altrimenti non resterebbe alcun modo
    elFilter.addEventListener("change", () => { load(); });


    elRefresh.addEventListener("change",  window.startLive);

    if (window.OCPP_DEFAULT_VIEW !== "graph") {
      load();
      window.startLive();
    }
    if (followBottom) {
	  window.scrollTo(0, document.body.scrollHeight);
    }







/* ===== Versione del server perl e aggiornamento =====
   Il repo del server e' configurabile (code_repo/code_ref) e non pubblica un
   numero di versione: il confronto lo fa il web server con git, fra il commit
   in uso e la punta del ref configurato. Il commit sta sempre accanto all'ora;
   la freccia compare solo quando ci sono commit nuovi, e il pannello spiega
   cosa cambierebbe prima di riavviare. */
(function () {
  const wrap  = document.getElementById("verWrap");
  const btn   = document.getElementById("btnVersion");
  const text  = document.getElementById("verText");
  const panel = document.getElementById("updatePanel");
  if (!wrap || !btn || !text || !panel) return;

  const RECHECK_MS = 15 * 60 * 1000;  // ricontrollo dal browser
  const RETRY_MS   = 8 * 1000;        // il server non ha ancora controllato
  const GIVEUP_MS  = 4 * 60 * 1000;   // attesa massima del riavvio

  let info = null;
  let busy = false;

  const esc = s => String(s == null ? "" : s).replace(/[<>&"]/g,
    c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

  function shortDate(iso) {
    const d = iso ? new Date(iso) : null;
    return (d && !isNaN(d)) ? d.toLocaleDateString() : "";
  }

  async function getVersion(refresh) {
    const q = refresh ? "?refresh=1&_=" : "?_=";
    const r = await fetch("version" + q + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  }

  const isOpen = () => panel.style.display !== "none";

  function closePanel() {
    panel.style.display = "none";
  }

  function showPanel(html) {
    panel.innerHTML = html;
    panel.style.display = "block";
  }

  // "1.9919" se ocpp.pl lo dichiara, altrimenti si ripiega sullo sha
  function label(version, short) {
    return version ? "v" + version : short;
  }

  // "https://gitlab.com/tizio/ocpp-mqtt-perl-server.git" -> "tizio/ocpp-mqtt-perl-server"
  function shortRepo(url) {
    const u = String(url || "").replace(/\.git$/, "").replace(/\/+$/, "");
    const parts = u.split(/[/:]/).filter(Boolean);  // anche git@host:tizio/repo
    return parts.slice(-2).join("/") || u;
  }

  // nel pannello servono entrambi: il numero non cambia a ogni commit
  function full(version, short) {
    return version ? esc("v" + version) + " · <code>" + esc(short) + "</code>"
                   : "<code>" + esc(short) + "</code>";
  }

  function paint() {
    const d = info || {};
    const short = d.local_short || "";
    const name = label(d.local_version, short);

    text.textContent = name;
    wrap.style.display = short ? "inline-flex" : "none";
    wrap.classList.toggle("has-update", !!d.update_available);
    btn.title = d.update_available
      ? d.behind + " new commit(s) on " + d.ref + " — click to update"
      : "Server " + name + " (" + short + ")";
  }

  function renderPanel() {
    const d = info || {};

    // sempre validi, aggiornamento o no
    let extra = "";
    if (d.last_update && d.last_update.status === "error") {
      extra += `<div class="msg err">Last attempt (${esc(d.last_update.when)}):
        ${esc(d.last_update.message)}</div>`;
    }
    if (d.error) {
      extra += `<div class="msg err">${esc(d.error)}</div>`;
    }

    if (!d.update_available) {
      if (d.ahead > 0) {
        extra += `<div class="msg">${d.ahead} local commit(s) not on
          <code>${esc(d.ref)}</code>.</div>`;
      }
      if (d.pinned) {
        extra += `<div class="msg"><code>${esc(d.ref)}</code> is a tag or a
          commit: there is no branch tip to follow, so no update is offered.</div>`;
      }
      showPanel(`
        <h4>${d.pinned ? "Server pinned" : "Server up to date"}</h4>
        <div class="kv"><span>Running</span><span>${full(d.local_version, d.local_short)}</span></div>
        <div class="kv"><span>Repo</span><code>${esc(shortRepo(d.repo))}</code></div>
        <div class="kv"><span>Ref</span><code>${esc(d.ref)}</code></div>
        ${d.local_subject ? `<div class="msg">“${esc(d.local_subject)}”
          ${shortDate(d.local_date)}</div>` : ""}
        ${extra}
        <div class="actions">
          <button data-act="check">Check now</button>
          <button data-act="close">Close</button>
        </div>`);
      return;
    }

    if (d.charging) {
      extra += `<div class="msg warn">A charging session is running: the restart
        drops the wallbox connection.</div>`;
    }
    if (d.ahead > 0) {
      extra += `<div class="msg warn">${d.ahead} local commit(s) not on
        <code>${esc(d.ref)}</code>: they would be left behind.</div>`;
    }
    if (d.dirty) {
      extra += `<div class="msg warn">Local changes to tracked files would be
        overwritten. <code>ocpp.ini</code>, logs and <code>data/</code> are
        never touched.</div>`;
    }
    if (d.auto_update) {
      extra += `<div class="msg">Auto update is on: this happens by itself
        within the hour, once no session is running.</div>`;
    }

    showPanel(`
      <h4>Server update available</h4>
      <div class="kv"><span>Running</span><span>${full(d.local_version, d.local_short)}</span></div>
      <div class="kv"><span>Latest</span><span>${full(d.remote_version, d.remote_short)}</span></div>
      <div class="kv"><span>New commits</span><strong>${d.behind || 0}</strong></div>
      <div class="kv"><span>Repo</span><code>${esc(shortRepo(d.repo))}</code></div>
      <div class="kv"><span>Ref</span><code>${esc(d.ref)}</code></div>
      ${d.remote_subject ? `<div class="msg">“${esc(d.remote_subject)}”
        ${shortDate(d.remote_date)}</div>` : ""}
      ${extra}
      <div class="msg">The add-on restarts to apply it (a few seconds).</div>
      <div class="actions">
        <button data-act="close">Cancel</button>
        <button class="go" data-act="go">Update now</button>
      </div>`);
  }

  function renderDone(cls, html) {
    busy = false;
    wrap.classList.remove("busy");
    showPanel(`<h4>Server update</h4><div class="msg ${cls}">${html}</div>
      <div class="actions"><button data-act="close">Close</button></div>`);
  }

  async function checkNow() {
    showPanel(`<h4>Checking…</h4><div class="msg">Asking
      <code>${esc((info && info.ref) || "origin")}</code> for new commits.</div>`);
    try {
      info = await getVersion(true);
      paint();
      renderPanel();
    } catch (e) {
      renderDone("err", "Check failed: " + esc(e.message || e));
    }
  }

  async function startUpdate() {
    busy = true;
    wrap.classList.add("busy");
    showPanel(`<h4>Updating…</h4><div class="msg">The add-on is restarting.
      The panel says when the new version is up.</div>`);

    try {
      const r = await fetch("update", { method: "POST", cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        renderDone("err", "Update not started: " + esc(d.error || ("HTTP " + r.status)));
        return;
      }
    } catch (e) {
      // il riavvio puo' arrivare prima della risposta: non e' un errore
    }

    waitForRestart(Date.now(), info ? info.local : "");
  }

  function waitForRestart(t0, wasLocal) {
    setTimeout(async () => {
      if (Date.now() - t0 > GIVEUP_MS) {
        renderDone("err", "The add-on did not come back. Check the add-on log.");
        return;
      }
      try {
        const d = await getVersion(false);

        if (d.local && wasLocal && d.local !== wasLocal) {
          info = d;
          paint();
          renderDone("", "Updated to " + esc(label(d.local_version, d.local_short)) +
            ". The log picks up again on its own.");
          return;
        }
        if (d.restart_error) {
          renderDone("err", "Restart request refused: " + esc(d.restart_error) +
            ". The update will be applied at the next add-on restart.");
          return;
        }
        // stesso commit e nessun update in sospeso: run.sh ha gia' concluso
        if (!d.pending && Date.now() - t0 > 25000) {
          const st = d.last_update || {};
          renderDone(st.status === "error" ? "err" : "warn",
            st.message ? esc(st.message) : "Nothing was updated.");
          return;
        }
      } catch (e) {
        // server giu' durante il riavvio: normale
      }
      waitForRestart(t0, wasLocal);
    }, 3000);
  }

  async function check() {
    let next = RECHECK_MS;
    try {
      const d = await getVersion(false);
      if (!busy) {
        info = d;
        paint();
        if (isOpen()) renderPanel();
      }
      // il server fa il primo controllo pochi secondi dopo l'avvio
      if (!d.checked) next = RETRY_MS;
    } catch (e) {
      next = RETRY_MS;
    }
    setTimeout(check, next);
  }

  btn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (busy) return;
    if (isOpen()) { closePanel(); return; }
    renderPanel();
  });

  panel.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const act = ev.target.closest("button")?.dataset.act;
    if (act === "close") closePanel();
    if (act === "check") checkNow();
    if (act === "go") startUpdate();
  });

  document.addEventListener("click", () => { if (!busy) closePanel(); });

  check();
})();
