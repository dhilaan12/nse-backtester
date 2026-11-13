import fs from 'node:fs/promises';

const symbols = ['HDFCBANK.NS', 'RELIANCE.NS', 'TCS.NS'];
const start = Math.floor(Date.UTC(2020, 0, 1) / 1000);
const end = Math.floor(Date.UTC(2026, 10, 10) / 1000);
const series = {};
const outputFile = name => new URL(`./${name}`, import.meta.url);

for (const symbol of symbols) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${start}&period2=${end}&interval=1d&events=div%2Csplits`;
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!response.ok) throw new Error(`${symbol}: Yahoo Finance returned ${response.status}`);
  const json = await response.json();
  const result = json.chart?.result?.[0];
  if (!result?.timestamp?.length) throw new Error(`${symbol}: no price data returned`);
  const prices = result.indicators.adjclose?.[0]?.adjclose ?? result.indicators.quote?.[0]?.close;
  series[symbol] = result.timestamp.map((ts, i) => ({ date: new Date(ts * 1000), price: prices[i] })).filter(x => Number.isFinite(x.price));
}

function backtest(rows, fast, slow, cost = 0.002) {
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    if (i < slow - 1) continue;
    const f = rows.slice(i-fast+1, i+1).reduce((a, x) => a + x.price, 0) / fast;
    const s = rows.slice(i-slow+1, i+1).reduce((a, x) => a + x.price, 0) / slow;
    const signal = +(f > s);
    const ret = i ? rows[i].price / rows[i-1].price - 1 : 0;
    const prev = out.at(-1);
    const prevprev = out.at(-2);
    const strategyRet = prev ? prev.signal * ret - (prevprev && prev.signal !== prevprev.signal ? cost : 0) : 0;
    out.push({ date: rows[i].date, signal, bhRet: ret, stRet: strategyRet });
  }
  return out;
}
function sharpe(rows, key) {
  const rs = rows.filter(x => x.date.getFullYear() >= 2020 && x.date.getFullYear() <= 2023).map(x => x[key]);
  const mean = rs.reduce((a,b)=>a+b,0)/rs.length;
  const sd = Math.sqrt(rs.reduce((a,b)=>a+(b-mean)**2,0)/(rs.length-1));
  return mean / sd * Math.sqrt(252);
}
const grid = [10,20,30].flatMap(f => [50,100,150,200].map(s => [f,s]));
const scores = grid.map(([f,s]) => {
  const score = symbols.map(sym => sharpe(backtest(series[sym], f, s), 'stRet')).reduce((a,b)=>a+b,0)/symbols.length;
  return { f, s, score };
});
const best = scores.reduce((a,b)=>a.score>b.score?a:b);
const full = Object.fromEntries(symbols.map(sym => [sym, backtest(series[sym], ...[20,50])]));
const test = Object.fromEntries(symbols.map(sym => [sym, backtest(series[sym], best.f, best.s)]));

const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
const colors = ['#2563eb','#f97316','#16a34a','#a855f7','#dc2626','#0891b2'];
function svgStart(title, width=1200, height=520) { return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><text x="${width/2}" y="34" text-anchor="middle" font-family="Arial" font-size="22" font-weight="bold" fill="#111827">${esc(title)}</text>`; }
function axes(x,y,w,h, x0,x1,y0,y1, xLabel, yLabel) {
  let z = `<g font-family="Arial" font-size="11" fill="#374151" stroke="#9ca3af" stroke-width="1"><path d="M${x} ${y}V${y+h}H${x+w}" fill="none"/>`;
  for(let i=0;i<=4;i++) { const py=y+h-i*h/4, val=y0+(y1-y0)*i/4; z+=`<path d="M${x} ${py}h${w}" stroke="#e5e7eb"/><text x="${x-8}" y="${py+4}" text-anchor="end" stroke="none">${(val*100).toFixed(0)}%</text>`; }
  for(let i=0;i<=4;i++){ const px=x+i*w/4, d=new Date(x0.getTime()+(x1-x0)*i/4); z+=`<text x="${px}" y="${y+h+18}" text-anchor="middle" stroke="none">${d.getFullYear()}</text>`; }
  z+=`<text x="${x+w/2}" y="${y+h+42}" text-anchor="middle" stroke="none">Date</text><text x="${x-48}" y="${y+h/2}" transform="rotate(-90 ${x-48} ${y+h/2})" text-anchor="middle" stroke="none">${yLabel}</text></g>`;
  return z;
}
function linePath(rows, key, x,y,w,h, minDate,maxDate,minVal,maxVal) {
  const pts=rows.filter(a=>a.date>=minDate&&a.date<=maxDate).map(a=>{
    const val=a[key]; const xx=x+(a.date-minDate)/(maxDate-minDate)*w; const yy=y+h-(val-minVal)/(maxVal-minVal)*h; return `${xx.toFixed(1)},${yy.toFixed(1)}`;
  }); return pts.join(' ');
}
function writeLineChart(filename,title,bySymbol,keys,minDate,maxDate,forcedRange=null) {
  const W=1200,H=520, left=70, top=68, gap=30, panelW=(W-left-25-gap*2)/3, panelH=365;
  let out=svgStart(title,W,H);
  symbols.forEach((sym,si)=>{
    const rows=bySymbol[sym].filter(a=>a.date>=minDate&&a.date<=maxDate);
    let vals=[]; for(const key of keys) { let cum=1; vals.push(...rows.map(a=>{cum*=1+a[key];return cum;})); }
    let lo=forcedRange?.[0] ?? Math.min(...vals)*0.95, hi=forcedRange?.[1] ?? Math.max(...vals)*1.05;
    const x=left+si*(panelW+gap), y=top;
    out+=`<text x="${x+panelW/2}" y="56" text-anchor="middle" font-family="Arial" font-size="15" fill="#111827">${sym.replace('.NS','')}</text>`;
    out+=axes(x,y,panelW,panelH,rows[0].date,rows.at(-1).date,lo,hi,'Date','Growth of ₹1');
    for(let ki=0;ki<keys.length;ki++){
      const key=keys[ki]; let cum=1; const transformed=rows.map(a=>({date:a.date,val:(cum*=1+a[key])}));
      const path=transformed.map(a=>`${(x+(a.date-rows[0].date)/(rows.at(-1).date-rows[0].date)*panelW).toFixed(1)},${(y+panelH-(a.val-lo)/(hi-lo)*panelH).toFixed(1)}`).join(' ');
      out+=`<polyline points="${path}" fill="none" stroke="${colors[ki]}" stroke-width="2"/>`;
    }
    if(filename==='equity_curves_split.svg') {
      const splitX=x+(new Date('2024-01-01')-rows[0].date)/(rows.at(-1).date-rows[0].date)*panelW;
      out+=`<line x1="${splitX}" y1="${y}" x2="${splitX}" y2="${y+panelH}" stroke="#111827" stroke-dasharray="6 5" stroke-width="1.5"/><text x="${splitX+5}" y="${y+16}" font-family="Arial" font-size="11" fill="#111827">Test begins</text>`;
    }
  });
  out+=`<g font-family="Arial" font-size="13"><line x1="420" y1="493" x2="448" y2="493" stroke="${colors[0]}" stroke-width="3"/><text x="455" y="497">${keys[0]==='bhRet'?'Buy &amp; hold':'Buy &amp; hold'}</text><line x1="610" y1="493" x2="638" y2="493" stroke="${colors[1]}" stroke-width="3"/><text x="645" y="497">MA crossover</text></g></svg>`;
  return fs.writeFile(outputFile(filename),out);
}
await writeLineChart('test_period_results.svg','Out-of-sample performance (2024–2026)',test,['bhRet','stRet'],new Date('2024-01-01'),new Date('2026-11-10'));
await writeLineChart('equity_curves_split.svg','Equity curves with train/test split (20/50 windows)',full,['bhRet','stRet'],new Date('2020-01-01'),new Date('2026-11-10'));
// Drawdown chart, with each stock and strategy shown as separate panels.
{
  const W=1200,H=540, left=72, top=64, gap=24, panelW=(W-left-20-gap*2)/3, panelH=370;
  let out=svgStart('Drawdowns in the test period',W,H);
  symbols.forEach((sym,si)=>{
    const rows=test[sym].filter(a=>a.date>=new Date('2024-01-01'));
    const curves=[];
    for(const key of ['bhRet','stRet']){let cum=1,peak=1;curves.push(rows.map(a=>{cum*=1+a[key];peak=Math.max(peak,cum);return {date:a.date,val:cum/peak-1};}));}
    const x=left+si*(panelW+gap),y=top, lo=-0.6,hi=0.05;
    out+=`<text x="${x+panelW/2}" y="52" text-anchor="middle" font-family="Arial" font-size="15" fill="#111827">${sym.replace('.NS','')}</text>`;
    out+=axes(x,y,panelW,panelH,rows[0].date,rows.at(-1).date,lo,hi,'Date','Drawdown');
    curves.forEach((curve,ki)=>{const path=curve.map(a=>`${(x+(a.date-rows[0].date)/(rows.at(-1).date-rows[0].date)*panelW).toFixed(1)},${(y+panelH-(a.val-lo)/(hi-lo)*panelH).toFixed(1)}`).join(' ');out+=`<polyline points="${path}" fill="none" stroke="${colors[ki]}" stroke-width="2"/>`;});
  });
  out+=`<g font-family="Arial" font-size="13"><line x1="420" y1="505" x2="448" y2="505" stroke="${colors[0]}" stroke-width="3"/><text x="455" y="509">Buy &amp; hold</text><line x1="610" y1="505" x2="638" y2="505" stroke="${colors[1]}" stroke-width="3"/><text x="645" y="509">MA crossover (${best.f}/${best.s})</text></g></svg>`;
  await fs.writeFile(outputFile('drawdowns_test.svg'),out);
}
// Sharpe heatmaps use the same grid search and in-sample/out-of-sample windows as the notebook.
{
  function annualSharpe(rs) { const a=rs.filter(Number.isFinite); const m=a.reduce((s,v)=>s+v,0)/a.length; const sd=Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1)); return m/sd*Math.sqrt(252); }
  const vals={};
  for(const [f,s] of grid){
    const train=[], out=[];
    for(const sym of symbols){const rows=backtest(series[sym],f,s); train.push(...rows.filter(x=>x.date.getFullYear()<=2023).map(x=>x.stRet)); out.push(...rows.filter(x=>x.date.getFullYear()>=2024).map(x=>x.stRet));}
    const tr=symbols.map(sym=>annualSharpe(backtest(series[sym],f,s).filter(x=>x.date.getFullYear()<=2023).map(x=>x.stRet))).reduce((a,b)=>a+b,0)/symbols.length;
    const te=symbols.map(sym=>annualSharpe(backtest(series[sym],f,s).filter(x=>x.date.getFullYear()>=2024).map(x=>x.stRet))).reduce((a,b)=>a+b,0)/symbols.length;
    vals[`${f}-${s}`]=[tr,te];
  }
  const W=1000,H=500; let out=svgStart('Sharpe ratio: training vs test',W,H);
  const panels=[{title:'Train (2020–2023)',idx:0,x:90},{title:'Test (2024–2026)',idx:1,x:540}];
  for(const p of panels){
    out+=`<text x="${p.x+180}" y="85" text-anchor="middle" font-family="Arial" font-size="17" fill="#111827">${p.title}</text>`;
    out+=`<text x="${p.x+170}" y="115" text-anchor="middle" font-family="Arial" font-size="13" fill="#374151">Slow window (days)</text>`;
    [50,100,150,200].forEach((s,j)=>out+=`<text x="${p.x+130+j*82}" y="145" text-anchor="middle" font-family="Arial" font-size="12" fill="#374151">${s}</text>`);
    [10,20,30].forEach((f,i)=>{
      out+=`<text x="${p.x+36}" y="${174+i*82}" text-anchor="middle" font-family="Arial" font-size="12" fill="#374151">${f}</text>`;
      [50,100,150,200].forEach((s,j)=>{const v=vals[`${f}-${s}`][p.idx];const t=Math.max(0,Math.min(1,(v+0.5)/1.5));const col=`rgb(${Math.round(220-150*t)},${Math.round(235-100*t)},${Math.round(255-30*t)})`;out+=`<rect x="${p.x+90+j*82}" y="${154+i*82}" width="78" height="78" fill="${col}" stroke="white"/><text x="${p.x+129+j*82}" y="${198+i*82}" text-anchor="middle" font-family="Arial" font-size="14" fill="#111827">${v.toFixed(2)}</text>`;});
    });
    out+=`<text x="${p.x+35}" y="285" transform="rotate(-90 ${p.x+35} 285)" text-anchor="middle" font-family="Arial" font-size="13" fill="#374151">Fast window (days)</text>`;
  }
  out+='</svg>';
  await fs.writeFile(outputFile('sharpe_heatmaps.svg'),out);
}
console.log(`Generated charts for best training windows ${best.f}/${best.s}: ${Object.values(series).map(x=>x.length).join(', ')} daily rows.`);
