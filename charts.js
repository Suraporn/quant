// QuadBreak dashboard (live High setting) + risk-profile comparison, equity/drawdown, monthly heatmap, daily P&L calendar,
// per-strategy table. Plain SVG/HTML, no libraries. Data: versions.json.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const $ = (s) => document.querySelector(s);
  const fmtDate = (s) => { const [y, m, d] = s.split("-"); return `${+d} ${MON[+m - 1]} ${y}`; };
  const fmtMoney = (v) => v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(0)}`;
  const sign = (v, d = 1) => `${v > 0 ? "+" : ""}${v.toFixed(d)}`;

  function frame(host, H, pad) {
    host.innerHTML = "";
    const W = 1000;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", class: "chart-svg" });
    host.appendChild(svg);
    const tip = document.createElement("div"); tip.className = "chart-tip"; tip.hidden = true; host.appendChild(tip);
    return { svg, tip, W, H, x0: pad.l, x1: W - pad.r, y0: pad.t, y1: H - pad.b };
  }
  function showTip(f, html, px, py) {
    f.tip.innerHTML = html; f.tip.hidden = false;
    const box = f.svg.getBoundingClientRect(), sx = box.width / f.W, sy = box.height / f.H;
    let left = px * sx + 14, top = py * sy - 10;
    if (left + f.tip.offsetWidth > box.width) left = px * sx - f.tip.offsetWidth - 14;
    f.tip.style.left = `${Math.max(0, left)}px`; f.tip.style.top = `${Math.max(0, top)}px`;
  }
  function svgX(f, evt) { const r = f.svg.getBoundingClientRect(); return (evt.clientX - r.left) * f.W / r.width; }
  function xAxisMonths(f, dates, X) {
    dates.forEach((d, i) => {
      const [y, m] = d.split("-");
      if ((+m - 1) % 3 === 0 && (i === 0 || dates[i - 1].slice(0, 7) !== d.slice(0, 7))) {
        el("line", { x1: X(i), x2: X(i), y1: f.y1, y2: f.y1 + 5, class: "axis" }, f.svg);
        el("text", { x: X(i), y: f.y1 + 20, class: "tick", "text-anchor": "middle" }, f.svg).textContent = `${MON[+m - 1]} ${y.slice(2)}`;
      }
    });
  }
  function periodBands(f, dates, X, labels = true) {
    const BL = Array.isArray(labels) ? labels : [];
    const i0 = dates.findIndex((d) => d >= "2026-01-01"), i1 = dates.findIndex((d) => d >= "2026-07-01");
    el("rect", { x: X(i0), y: f.y0, width: X(i1) - X(i0), height: f.y1 - f.y0, class: "band" }, f.svg);
    if (!labels) return;
    [i0, i1].forEach((i) => el("line", { x1: X(i), x2: X(i), y1: f.y0 - 16, y2: f.y1, class: "band-edge" }, f.svg));
    [[BL[0] || "Test 2025", 0, i0], [BL[1] || "Training · Jan–Jun 2026", i0, i1], [BL[2] || "Test 2026", i1, dates.length - 1]].forEach(([t, a, b]) =>
      el("text", { x: (X(a) + X(b)) / 2, y: f.y0 - 6, class: "band-label", "text-anchor": "middle" }, f.svg).textContent = t);
  }
  function hover(f, n, X, onMove, extra = []) {
    const cross = el("line", { y1: f.y0, y2: f.y1, class: "cross", visibility: "hidden" }, f.svg);
    const hit = el("rect", { x: f.x0, y: f.y0, width: f.x1 - f.x0, height: f.y1 - f.y0, class: "hit" }, f.svg);
    const move = (e) => {
      const px = svgX(f, e.touches ? e.touches[0] : e);
      const i = Math.round(Math.min(Math.max((px - f.x0) / (f.x1 - f.x0), 0), 1) * (n - 1));
      cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i)); cross.setAttribute("visibility", "visible");
      onMove(i);
    };
    const leave = () => { cross.setAttribute("visibility", "hidden"); extra.forEach((x) => x.setAttribute("visibility", "hidden")); f.tip.hidden = true; };
    hit.addEventListener("mousemove", move); hit.addEventListener("touchmove", move, { passive: true });
    hit.addEventListener("mouseleave", leave); hit.addEventListener("touchend", leave);
  }

  function equity(host, B, V) {
    const f = frame(host, 370, { l: 64, r: 18, t: 30, b: 30 });
    const n = B.dates.length, all = Object.values(V.eq).flat();
    const X = (i) => f.x0 + (f.x1 - f.x0) * i / (n - 1);
    let Y;
    if (V.scale === "linear") {
      const step = 500, lo = Math.floor(Math.min(...all) / step) * step, hi = Math.ceil(Math.max(...all) * 1.04 / step) * step;
      Y = (v) => f.y1 - (f.y1 - f.y0) * (v - lo) / (hi - lo);
      periodBands(f, B.dates, X, B.bandLabels || true);
      for (let v = lo; v <= hi; v += step) {
        el("line", { x1: f.x0, x2: f.x1, y1: Y(v), y2: Y(v), class: "grid" }, f.svg);
        el("text", { x: f.x0 - 8, y: Y(v) + 4, class: "tick", "text-anchor": "end" }, f.svg).textContent = `$${v.toLocaleString("en-US")}`;
      }
    } else {
    const lo = Math.log10(Math.min(...all) * 0.9);
    const hi = Math.log10(Math.max(...all) * 1.15);
    Y = (v) => f.y1 - (f.y1 - f.y0) * (Math.log10(Math.max(v, 1)) - lo) / (hi - lo);
    periodBands(f, B.dates, X, B.bandLabels || true);
    const ticks = [];
    for (let p = Math.floor(lo); p <= Math.ceil(hi); p++) [1, 2, 5].forEach((m) => ticks.push(m * Math.pow(10, p)));
    const span = hi - lo, keep = span > 2.5 ? [1] : [1, 2, 5];
    ticks.filter((v) => Math.log10(v) >= lo && Math.log10(v) <= hi && keep.includes(Math.round(v / Math.pow(10, Math.floor(Math.log10(v) + 1e-9)))))
      .forEach((v) => {
        el("line", { x1: f.x0, x2: f.x1, y1: Y(v), y2: Y(v), class: "grid" }, f.svg);
        el("text", { x: f.x0 - 8, y: Y(v) + 4, class: "tick", "text-anchor": "end" }, f.svg).textContent = fmtMoney(v);
      });
    }
    xAxisMonths(f, B.dates, X);
    ["b25", "d1", "d5", "raw"].forEach((k) => {
      el("path", { d: V.eq[k].map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(""), class: k === "raw" ? "line-main" : "line-ctx" }, f.svg);
    });
    const dot = el("circle", { r: 5, class: "dot", visibility: "hidden" }, f.svg);
    hover(f, n, X, (i) => {
      dot.setAttribute("cx", X(i)); dot.setAttribute("cy", Y(V.eq.raw[i])); dot.setAttribute("visibility", "visible");
      const rows = ["raw", "b25", "d1", "d5"].map((k) => `<div class="r${k === "raw" ? " main" : ""}"><span>${B.labels[k]}</span><b>${fmtMoney(V.eq[k][i])}</b></div>`).join("");
      showTip(f, `<div class="h">${fmtDate(B.dates[i])}</div>${rows}`, X(i), Y(V.eq.raw[i]));
    }, [dot]);
  }

  function drawdown(host, B, V) {
    const f = frame(host, 260, { l: 64, r: 18, t: 24, b: 30 });
    const n = B.dates.length, X = (i) => f.x0 + (f.x1 - f.x0) * i / (n - 1);
    const floor = -Math.min(...V.dd), step = floor > 30 ? 20 : floor > 12 ? 5 : 2;
    const lim = Math.ceil((floor * 1.1) / step) * step;
    const Y = (v) => f.y0 + (f.y1 - f.y0) * (-v) / lim;
    periodBands(f, B.dates, X, false);
    for (let v = 0; v >= -lim; v -= step) {
      el("line", { x1: f.x0, x2: f.x1, y1: Y(v), y2: Y(v), class: v === 0 ? "axis" : "grid" }, f.svg);
      el("text", { x: f.x0 - 8, y: Y(v) + 4, class: "tick", "text-anchor": "end" }, f.svg).textContent = `${v}%`;
    }
    xAxisMonths(f, B.dates, X);
    const pts = V.dd.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
    el("path", { d: `M${X(0)},${Y(0)}L${pts.join("L")}L${X(n - 1)},${Y(0)}Z`, class: "area" }, f.svg);
    el("path", { d: `M${pts.join("L")}`, class: "line-main dd thin" }, f.svg);
    let mi = 0; V.dd.forEach((v, i) => { if (v < V.dd[mi]) mi = i; });
    el("text", { x: X(mi) + 10, y: Math.min(Y(V.dd[mi]) + 14, f.y1 - 4), class: "direct" }, f.svg).textContent = `${V.dd[mi].toFixed(1)}% max`;
    hover(f, n, X, (i) => showTip(f, `<div class="h">${fmtDate(B.dates[i])}</div><div class="r main"><span>Drawdown</span><b>${V.dd[i].toFixed(1)}%</b></div>`, X(i), Y(V.dd[i])));
  }

  // sequential gold (gains) and blue (losses) on the dark panel; sqrt keeps typical values readable
  function gold(t) {
    t = Math.sqrt(Math.min(Math.max(t, 0), 1)); const L = (a, b) => Math.round(a + (b - a) * t);
    return t < 0.5 ? `rgb(${L(92, 242)},${L(69, 193)},${L(18, 78)})` : `rgb(${L(242, 255)},${L(193, 231)},${L(78, 163)})`;
  }
  function green(t) {
    t = Math.sqrt(Math.min(Math.max(t, 0), 1)); const L = (a, b) => Math.round(a + (b - a) * t);
    return `rgb(${L(112, 22)},${L(180, 112)},${L(132, 56)})`;   // mid green -> deep green
  }
  function red(t) {
    t = Math.sqrt(Math.min(Math.max(t, 0), 1)); const L = (a, b) => Math.round(a + (b - a) * t);
    return `rgb(${L(214, 160)},${L(120, 26)},${L(120, 26)})`;  // mid red -> deep red
  }
  function blue(t) {
    t = Math.sqrt(Math.min(Math.max(t, 0), 1)); const L = (a, b) => Math.round(a + (b - a) * t);
    return `rgb(${L(44, 124)},${L(58, 156)},${L(110, 255)})`;
  }

  function heatmap(host, B, V) {
    const years = [...new Set(B.months.map((m) => m.slice(0, 4)))];
    const val = {}; B.months.forEach((m, i) => { val[m] = V.mret[i]; });
    const vmax = Math.max(...V.mret), dec = vmax < 40 ? 1 : 0;
    let h = '<table><thead><tr><th class="y"></th>' + MON.map((m) => `<th>${m}</th>`).join("") + "</tr></thead><tbody>";
    years.forEach((y) => {
      h += `<tr><th class="y">${y}</th>`;
      for (let m = 1; m <= 12; m++) {
        const k = `${y}-${String(m).padStart(2, "0")}`, v = val[k];
        if (v === undefined) { h += '<td class="empty"></td>'; continue; }
        const partial = k === B.months[B.months.length - 1] ? " (to Nov 12)" : "";
        const t = v / vmax;
        h += v < 0 ? `<td class="neg" style="background:${red(Math.min(-v / vmax * 3, 1))};color:#fff" title="${MON[m - 1]} ${y}${partial}: ${v.toFixed(1)}%">${v.toFixed(dec)}%</td>`
                   : `<td style="background:${green(t)};color:#fff" title="${MON[m - 1]} ${y}${partial}: +${v.toFixed(1)}%">+${v.toFixed(dec)}%</td>`;
      }
      h += "</tr>";
    });
    host.innerHTML = h + `</tbody></table><div class="scale"><span>0%</span><i></i><span>+${Math.round(vmax)}%</span></div>`;
  }

  // GitHub-style calendar of daily P&L (weekdays), one block per year
  function calendar(host, V) {
    const days = Object.keys(V.daily).sort(), vals = Object.values(V.daily).map(Math.abs).sort((a, b) => a - b);
    const cap = vals[Math.floor(vals.length * 0.95)] || 1;
    const tip = host.parentElement.querySelector(".cal-tip");
    let html = "";
    [...new Set(days.map((d) => d.slice(0, 4)))].forEach((y) => {
      const start = new Date(`${y}-01-01T00:00:00Z`), end = y === "2026" ? new Date("2026-11-11T00:00:00Z") : new Date(`${y}-12-31T00:00:00Z`);
      const lead = (start.getUTCDay() + 6) % 7; // Monday = 0
      let cells = "", months = "", lastMon = -1, gains = 0, losses = 0;
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const dow = (d.getUTCDay() + 6) % 7;
        if (dow > 4) continue;                    // weekdays only
        const idx = Math.floor((lead + Math.round((d - start) / 864e5)) / 7);
        if (d.getUTCMonth() !== lastMon) { lastMon = d.getUTCMonth(); months += `<span style="grid-column:${idx + 1}">${MON[lastMon]}</span>`; }
        const key = d.toISOString().slice(0, 10), v = V.daily[key];
        let style = "", cls = "c";
        if (v === undefined || Math.abs(v) < 1e-9) cls += " z";
        else { style = `background:${v > 0 ? green(v / cap) : red(-v / cap)}`; v > 0 ? gains++ : losses++; }
        cells += `<i class="${cls}" style="grid-column:${idx + 1};grid-row:${dow + 1};${style}" data-d="${key}" data-v="${v === undefined ? "" : v}"></i>`;
      }
      html += `<div class="cal-year"><div class="cal-y">${y}<span>${gains} up · ${losses} down days</span></div><div class="cal-row"><div></div><div class="cal-m">${months}</div></div><div class="cal-row"><div class="cal-d"><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span></div><div class="cal-g">${cells}</div></div></div>`;
    });
    html += `<div class="scale"><span>Loss</span><i class="neg"></i><span>Gain</span><i></i><span style="margin-left:10px">daily % change · weeks start Monday · dark = no trading (holiday or no trade) · hover a day</span></div>`;
    host.innerHTML = html;
    host.querySelectorAll("i.c").forEach((c) => {
      const on = () => {
        const v = c.dataset.v;
        tip.innerHTML = `<div class="h">${fmtDate(c.dataset.d)}</div><div class="r main"><span>Daily P&amp;L</span><b>${v === "" ? "no trades" : sign(+v, 2) + "%"}</b></div>`;
        tip.hidden = false;
        const hb = host.getBoundingClientRect(), cb = c.getBoundingClientRect();
        let left = cb.left - hb.left + 16; if (left + tip.offsetWidth > hb.width) left = cb.left - hb.left - tip.offsetWidth - 6;
        tip.style.left = `${left}px`; tip.style.top = `${cb.top - hb.top - 8}px`;
      };
      c.addEventListener("mouseenter", on); c.addEventListener("touchstart", on, { passive: true });
      c.addEventListener("mouseleave", () => { tip.hidden = true; });
    });
  }

  function strategies(host, S) {
    const maxR = Math.max(...S.map((s) => Math.max(...s.cum))), minR = Math.min(0, ...S.map((s) => Math.min(...s.cum)));
    const spark = (cum) => {
      const w = 110, h = 28, n = cum.length;
      const X = (i) => 2 + (w - 4) * i / (n - 1), Y = (v) => h - 3 - (h - 6) * (v - minR) / (maxR - minR);
      return `<svg viewBox="0 0 ${w} ${h}" class="spark" aria-hidden="true"><line x1="2" x2="${w - 2}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" class="z"/><path d="${cum.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("")}"/></svg>`;
    };
    const oos = (v) => `<span class="${v >= 0 ? "pos" : "negv"}">${sign(v, 1)}R</span>`;
    host.innerHTML = `<div class="tablewrap"><table class="qb-table strat"><thead><tr><th>Strategy</th><th>Trades</th><th>Win rate</th><th>Profit factor</th><th>Expectancy</th><th>Total</th><th>Share of profit</th><th>2025 <em>OOS</em></th><th>Jul–Nov 26 <em>OOS</em></th><th>Cumulative R</th></tr></thead><tbody>` +
      S.map((s) => `<tr><td><span class="lt">${s.label.slice(-1)}</span>${s.label}</td><td>${s.trades}</td><td>${s.win.toFixed(0)}%</td><td>${s.pf.toFixed(2)}</td><td>${sign(s.exp, 2)}R</td><td>${sign(s.totR, 0)}R</td><td><div class="share"><b style="width:${s.share.toFixed(1)}%"></b></div><small>${s.share.toFixed(0)}%</small></td><td>${oos(s.per["2025"])}</td><td>${oos(s.per.JulNov)}</td><td>${spark(s.cum)}</td></tr>`).join("") +
      `</tbody></table></div>`;
  }

  // ---------- wiring ----------
  let DATA, current = "high";
  function render() {
    const B = DATA.base, V = DATA.versions[current], K = V.kpi;
    const set = (k, v) => { const e = document.querySelector(`[data-kpi="${k}"]`); if (e) e.textContent = v; };
    set("avg_month", `${K.avg_month.toFixed(1)}%`); set("mdd", `${K.mdd.toFixed(1)}%`); set("sharpe", K.sharpe.toFixed(2));
    set("sortino", K.sortino.toFixed(1)); set("calmar", K.calmar >= 100 ? K.calmar.toFixed(0) : K.calmar.toFixed(1)); set("pf", K.pf.toFixed(2));
    set("win", `${K.win.toFixed(0)}%`); set("trades", K.trades.toLocaleString("en-US")); set("pos_months", `${K.pos_months}/${K.n_months}`);
    set("risk", `${(+V.risk_per_strategy.toFixed(2))}% per strategy · volatility targeting`);
    V.periods.forEach((p) => {
      const g = document.querySelector(`[data-pg="${p.w}"]`), m = document.querySelector(`[data-pm="${p.w}"]`);
      if (g) g.textContent = `${p.growth.toFixed(1)}%`; if (m) m.textContent = `${p.mdd.toFixed(1)}%`;
    });
    const tb = $("#profiles");
    if (tb) tb.innerHTML = [["low", "Low"], ["medium", "Medium"], ["high", "High <em>live</em>"]].map(([p, lab]) => {
      const P = DATA.versions[p], k = P.kpi;
      const money = k.final >= 1e6 ? `$${(k.final / 1e6).toFixed(2)}M` : `$${Math.round(k.final).toLocaleString("en-US")}`;
      return `<tr${p === "high" ? ' class="on"' : ""}><td>${lab}</td><td>${(+P.risk_per_strategy.toFixed(2))}%</td><td class="up">${k.avg_month.toFixed(1)}%</td><td class="dn">${k.mdd.toFixed(1)}%</td><td class="dn">${k.worst_cond_mdd.toFixed(1)}%</td><td>${k.sharpe.toFixed(2)}</td><td>${k.calmar >= 100 ? k.calmar.toFixed(0) : k.calmar.toFixed(1)}</td><td>${money}</td></tr>`;
    }).join("");
    equity($("#chart-equity"), B, V);
    drawdown($("#chart-dd"), B, V);
    heatmap($("#heatmap"), B, V);
    calendar($("#calendar"), V);
  }
  fetch("versions.json?v=2").then((r) => r.json()).then((D) => {
    DATA = D; render(); strategies($("#strategies"), D.strategies);
  }).catch((err) => { console.error(err); document.querySelectorAll("#chart-equity,#chart-dd,#heatmap,#calendar,#strategies").forEach((h) => { h.textContent = "Data couldn't load."; }); });

  // ---------- Alfred (second system) ----------
  if ($("#al-equity")) fetch("alfred.json?v=5").then((r) => r.json()).then((A) => {
    const B = A.base, V = A.versions.high;
    equity($("#al-equity"), B, V);
    drawdown($("#al-dd"), B, V);
    heatmap($("#al-heatmap"), B, V);
    calendar($("#al-calendar"), V);
  }).catch((err) => { console.error(err); document.querySelectorAll("#al-equity,#al-dd,#al-heatmap,#al-calendar").forEach((h) => { h.textContent = "Data couldn't load."; }); });
})();
