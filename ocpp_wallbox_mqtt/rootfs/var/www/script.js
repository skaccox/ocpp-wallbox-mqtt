   function setHeaderHeightVar(){
      const h = document.querySelector("header")?.offsetHeight || 64;
      document.documentElement.style.setProperty("--header-h", h + "px");
    }
    
    
    const elLog = document.getElementById("log");
    const elLines = document.getElementById("lines");
    const elRefresh = document.getElementById("refresh");
    const elStatus = document.getElementById("status");
    const btn = document.getElementById("btn");
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

    setTimeout(() => { setHeaderHeightVar(); resizeBigChart(); }, 50);
    
    


    let t = null;
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

    // Bottone "Vai in fondo": riattiva follow e scende
    btnBottom.addEventListener("click", () => {
      followBottom = true;
      window.scrollTo(0, document.body.scrollHeight);
    });
	
	function chgHasPower(line) {
	  if (!/\bCHG\*/.test(line)) return false;
	
	  // accetta P=1234, P=1234.5, rifiuta P= , P=0, P=0.0
	  const m = line.match(/\bP\s*=\s*([0-9]+(?:\.[0-9]+)?)\b/);
	  if (!m) return false;
	
	  const p = parseFloat(m[1]);
	  return Number.isFinite(p) && p > 50; // soglia anti-falsi positivi
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

        for (let i = 0; i < sparkTime.length; i++){
          const t = sparkTime[i];
          const isFirst = i === 0;
          const isLast  = i === sparkTime.length - 1;
          const onTick  = ((t - t0) % tick) < (ms + 60);

          if (!(isFirst || isLast || onTick)) continue;

          const x = padL + ((t - t0) / range) * cw;

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
    const n = Math.max(50, Math.min(5000, parseInt(elLines.value || "400", 10)));
    const url = `log?n=${n}&_=${Date.now()}`;
    const q = (elFilter.value || "").trim().toLowerCase();

    elStatus.textContent = "loading…";

    try {
      const r = await fetch(url, { cache: "no-store" });
      const txt = await r.text();

      const all = txt.split("\n").filter(x => x.length);

      // Estrae ultimo GRID_LIMIT numerico per il grafico
      for (let i = all.length - 1; i >= 0; i--) {
        const m = all[i].match(/"GRID_LIMIT"\s*:\s*"?(\d+)"?/i);
        if (m) { gridLimitW = parseInt(m[1], 10); break; }
      }

		let liveState = null; // "CHARGE" | "AVAIL" | "STOP" | "SUSPEND"
		for (let i = all.length - 1; i >= 0; i--) {
		  // (NNNN, STOP/SUSPEND) oppure (STOP/SUSPEND) oppure (CHARGE) ecc.
		  const m = all[i].match(/\((?:\d+\s*,\s*)?(CHARGE|AVAIL|STOP|SUSPEND)(?:\/[A-Z_]+)?\)/i);
		  if (m) { liveState = m[1].toUpperCase(); break; }
		}
		
		let isCharging = (liveState === "CHARGE");

		if (!isCharging) {
		  const tail = all.slice(-120);
		
		  const hasChgPower = tail.some(chgHasPower);
		
		  const hasPublishCharging = tail.some(l => /Publish charging =>\s*\(actual=1\)/.test(l));
		  const hasStatusCharging  = tail.some(l => /"status"\s*:\s*"Charging"/.test(l));
		
		  if (hasChgPower || hasPublishCharging || hasStatusCharging) {
		    isCharging = true;
		    liveState = "CHARGE";
		  }
		}


      let kw = null;
      let pv = null;
      let kwh = null;

      // kw/kwh SOLO se CHARGE (così non resta "appeso" quando diventa AVAIL)
      if (isCharging) {
        for (let i = all.length - 1; i >= 0; i--) {
          const l = all[i];
			if (!chgHasPower(l)) continue;
			
			const mP = l.match(/\bP\s*=\s*([0-9]+(?:\.[0-9]+)?)\b/);
			const p = parseFloat(mP[1]);
			kw = p / 1000.0;
			
			const mKwh = l.match(/\bkwh\s*=\s*([0-9.]+)/i);
			if (mKwh) kwh = parseFloat(mKwh[1]);
			break;
        }
      }

      // export FV: SOLO se CHARGE (se AVAIL non ha senso)
      isExporting = false;
      if (isCharging) {
        for (let i = all.length - 1; i >= 0; i--) {
          const l = all[i];
          const mW = l.match(/\bW=(-?\d+)/i);
          if (mW && parseInt(mW[1], 10) < 0) { isExporting = true; break; }
        }
      }

      // PV%: se export -> 100%, altrimenti pv=xx%
      if (isCharging) {
        if (isExporting) {
          pv = 100;
        } else {
          for (let i = all.length - 1; i >= 0; i--) {
            const mPv = all[i].match(/\bpv=([0-9.]+)%/i);
            if (mPv) { pv = parseFloat(mPv[1]); break; }
          }
        }
      }

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
        const fullSolar = isCharging && (pv != null) && pv >= 99.9;
        elBadge.style.display = fullSolar ? "inline-flex" : "none";

        const limitKw = (typeof gridLimitW === "number" && isFinite(gridLimitW)) ? (gridLimitW / 1000) : null;
        const overNow = isCharging && limitKw != null && typeof kw === "number" && kw > limitKw;
        elBadge.classList.toggle("warn", overNow);
      }

      // Sparkline: se non CHARGE , spingi 0
      sparkData.push(isCharging && typeof kw === "number" && isFinite(kw) ? kw : 0);
      sparkTime.push(Date.now());
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

      elStatus.textContent = `ok · ${new Date().toLocaleTimeString()}`;

      if (followBottom) window.scrollTo(0, document.body.scrollHeight);
    } catch (e) {
      elStatus.textContent = "errore log";
    }
  }



    function setTimer() {
      if (t) clearInterval(t);
      const ms = parseInt(elRefresh.value, 10);
      if (ms > 0) t = setInterval(load, ms);
    }

    if (btn)  btn.addEventListener("click", async () => {
      await load();
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth"
      });
    });


    elRefresh.addEventListener("change", setTimer);

    load();
    setTimer();
    if (followBottom) {
	  window.scrollTo(0, document.body.scrollHeight);
    }




