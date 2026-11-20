// QuadBreak charts: plain SVG + hover tooltips, no libraries. Data comes from qb_data.json.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtDate = (s) => { const [y, m, d] = s.split("-"); return `${+d} ${MON[+m - 1]} ${y}`; };
  const fmtMonth = (s) => { const [y, m] = s.split("-"); return `${MON[+m - 1]} ${y}`; };
  const fmtMoney = (v) => v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(0)}`;

  function frame(host, H, pad) {
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
  function svgPoint(f, evt) {
    const r = f.svg.getBoundingClientRect();
    return [(evt.clientX - r.left) * f.W / r.width, (evt.clientY - r.top) * f.H / r.height];
  }
  function xAxisMonths(f, dates, X) {
    // a tick at the first day of every quarter
    dates.forEach((d, i) => {
      const [y, m, dd] = d.split("-");
      if ((+m - 1) % 3 === 0 && (i === 0 || dates[i - 1].slice(0, 7) !== d.slice(0, 7))) {
        el("line", { x1: X(i), x2: X(i), y1: f.y1, y2: f.y1 + 5, class: "axis" }, f.svg);
        el("text", { x: X(i), y: f.y1 + 20, class: "tick", "text-anchor": "middle" }, f.svg).textContent = `${MON[+m - 1]} ${y.slice(2)}`;
      }
    });
  }
  function periodBands(f, dates, X, labels = true) {
    const i0 = dates.findIndex((d) => d >= "2026-01-01"), i1 = dates.findIndex((d) => d >= "2026-07-01");
    el("rect", { x: X(i0), y: f.y0, width: X(i1) - X(i0), height: f.y1 - f.y0, class: "band" }, f.svg);
    if (!labels) return;
    const lbl = [["Test · 2025", 0, i0], ["Training", i0, i1], ["Test", i1, dates.length - 1]];
    lbl.forEach(([t, a, b]) => el("text", { x: (X(a) + X(b)) / 2, y: f.y0 + 14, class: "band-label", "text-anchor": "middle" }, f.svg).textContent = t);
  }

  function equity(host, D) {
    const f = frame(host, 360, { l: 64, r: 18, t: 24, b: 30 });
    const n = D.dates.length, keys = ["b25", "d1", "d5", "raw"];
    const lo = Math.log10(500), hi = Math.log10(1e7);
    const X = (i) => f.x0 + (f.x1 - f.x0) * i / (n - 1);
    const Y = (v) => f.y1 - (f.y1 - f.y0) * (Math.log10(Math.max(v, 1)) - lo) / (hi - lo);
    periodBands(f, D.dates, X);
    [1e3, 1e4, 1e5, 1e6, 1e7].forEach((v) => {
      el("line", { x1: f.x0, x2: f.x1, y1: Y(v), y2: Y(v), class: "grid" }, f.svg);
      el("text", { x: f.x0 - 8, y: Y(v) + 4, class: "tick", "text-anchor": "end" }, f.svg).textContent = fmtMoney(v);
    });
    xAxisMonths(f, D.dates, X);
    keys.forEach((k) => {
      const d = D.eq[k].map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("");
      el("path", { d, class: k === "raw" ? "line-main" : "line-ctx" }, f.svg);
    });
    const last = n - 1;
    const cross = el("line", { y1: f.y0, y2: f.y1, class: "cross", visibility: "hidden" }, f.svg);
    const dot = el("circle", { r: 5, class: "dot", visibility: "hidden" }, f.svg);
    const hit = el("rect", { x: f.x0, y: f.y0, width: f.x1 - f.x0, height: f.y1 - f.y0, class: "hit" }, f.svg);
    const move = (e) => {
      const [px] = svgPoint(f, e.touches ? e.touches[0] : e);
      const i = Math.round(Math.min(Math.max((px - f.x0) / (f.x1 - f.x0), 0), 1) * last);
      cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i)); cross.setAttribute("visibility", "visible");
      dot.setAttribute("cx", X(i)); dot.setAttribute("cy", Y(D.eq.raw[i])); dot.setAttribute("visibility", "visible");
      const rows = ["raw", "b25", "d1", "d5"].map((k) => `<div class="r${k === "raw" ? " main" : ""}"><span>${D.labels[k]}</span><b>${fmtMoney(D.eq[k][i])}</b></div>`).join("");
      showTip(f, `<div class="h">${fmtDate(D.dates[i])}</div>${rows}`, X(i), Y(D.eq.raw[i]));
    };
    const leave = () => { cross.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); f.tip.hidden = true; };
    hit.addEventListener("mousemove", move); hit.addEventListener("touchmove", move, { passive: true });
    hit.addEventListener("mouseleave", leave); hit.addEventListener("touchend", leave);
  }

  function drawdown(host, D) {
    const f = frame(host, 220, { l: 64, r: 18, t: 24, b: 30 });
    const n = D.dates.length, X = (i) => f.x0 + (f.x1 - f.x0) * i / (n - 1);
    const Y = (v) => f.y0 + (f.y1 - f.y0) * (-v) / 60;
    periodBands(f, D.dates, X, false);
    [0, -20, -40, -60].forEach((v) => {
      el("line", { x1: f.x0, x2: f.x1, y1: Y(v), y2: Y(v), class: v === 0 ? "axis" : "grid" }, f.svg);
      el("text", { x: f.x0 - 8, y: Y(v) + 4, class: "tick", "text-anchor": "end" }, f.svg).textContent = `${v}%`;
    });
    xAxisMonths(f, D.dates, X);
    const pts = D.dd.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
    el("path", { d: `M${X(0)},${Y(0)}L${pts.join("L")}L${X(n - 1)},${Y(0)}Z`, class: "area" }, f.svg);
    el("path", { d: `M${pts.join("L")}`, class: "line-main thin" }, f.svg);
    let mi = 0; D.dd.forEach((v, i) => { if (v < D.dd[mi]) mi = i; });
    el("text", { x: X(mi) + 10, y: Y(D.dd[mi]) + 14, class: "direct" }, f.svg).textContent = `${D.dd[mi].toFixed(1)}% max`;
    const cross = el("line", { y1: f.y0, y2: f.y1, class: "cross", visibility: "hidden" }, f.svg);
    const hit = el("rect", { x: f.x0, y: f.y0, width: f.x1 - f.x0, height: f.y1 - f.y0, class: "hit" }, f.svg);
    const move = (e) => {
      const [px] = svgPoint(f, e.touches ? e.touches[0] : e);
      const i = Math.round(Math.min(Math.max((px - f.x0) / (f.x1 - f.x0), 0), 1) * (n - 1));
      cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i)); cross.setAttribute("visibility", "visible");
      showTip(f, `<div class="h">${fmtDate(D.dates[i])}</div><div class="r main"><span>Drawdown</span><b>${D.dd[i].toFixed(1)}%</b></div>`, X(i), Y(D.dd[i]));
    };
    const leave = () => { cross.setAttribute("visibility", "hidden"); f.tip.hidden = true; };
    hit.addEventListener("mousemove", move); hit.addEventListener("touchmove", move, { passive: true });
    hit.addEventListener("mouseleave", leave); hit.addEventListener("touchend", leave);
  }

  function monthly(host, D) {
    const f = frame(host, 260, { l: 64, r: 18, t: 18, b: 34 });
    const n = D.months.length, slot = (f.x1 - f.x0) / n, bw = Math.max(slot - 6, 4);
    const vmax = 180, vmin = -20, Y = (v) => f.y0 + (f.y1 - f.y0) * (vmax - v) / (vmax - vmin);
    [0, 50, 100, 150].forEach((v) => {
      el("line", { x1: f.x0, x2: f.x1, y1: Y(v), y2: Y(v), class: v === 0 ? "axis" : "grid" }, f.svg);
      el("text", { x: f.x0 - 8, y: Y(v) + 4, class: "tick", "text-anchor": "end" }, f.svg).textContent = `${v}%`;
    });
    D.months.forEach((m, i) => {
      const v = D.mret[i], x = f.x0 + i * slot + (slot - bw) / 2, y = Math.min(Y(v), Y(0)), h = Math.max(Math.abs(Y(v) - Y(0)), 1.5);
      const r = Math.min(4, bw / 2);
      // rounded at the data end, square at the baseline
      const d = v >= 0
        ? `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${y + h}Z`
        : `M${x},${y}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + bw - r}Q${x + bw},${y + h} ${x + bw},${y + h - r}V${y}Z`;
      el("path", { d, class: v >= 0 ? "bar-pos" : "bar-neg" }, f.svg);
      const [yy, mm] = m.split("-");
      if (+mm === 1 || i === 0) el("text", { x: x + bw / 2, y: f.y1 + 30, class: "tick", "text-anchor": "middle" }, f.svg).textContent = yy;
      if (+mm % 3 === 1) el("text", { x: x + bw / 2, y: f.y1 + 15, class: "tick", "text-anchor": "middle" }, f.svg).textContent = MON[+mm - 1];
      const hit = el("rect", { x: f.x0 + i * slot, y: f.y0, width: slot, height: f.y1 - f.y0, class: "hit" }, f.svg);
      const partial = i === n - 1 ? " (to Nov 12)" : "";
      const on = () => showTip(f, `<div class="h">${fmtMonth(m)}${partial}</div><div class="r main"><span>Return</span><b>${v > 0 ? "+" : ""}${v.toFixed(1)}%</b></div>`, x + bw / 2, Y(Math.max(v, 0)));
      hit.addEventListener("mouseenter", on); hit.addEventListener("touchstart", on, { passive: true });
      hit.addEventListener("mouseleave", () => { f.tip.hidden = true; });
    });
  }

  fetch("qb_data.json?v=2").then((r) => r.json()).then((D) => {
    equity(document.getElementById("chart-equity"), D);
    drawdown(document.getElementById("chart-dd"), D);
    monthly(document.getElementById("chart-monthly"), D);
  }).catch(() => {
    document.querySelectorAll(".chart-host").forEach((h) => { h.textContent = "Chart data couldn't load."; });
  });
})();
