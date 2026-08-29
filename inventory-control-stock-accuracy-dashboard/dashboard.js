// Inventory Control & Stock Accuracy Dashboard
// Reads the embedded dataset and renders KPIs + charts with Chart.js

const RAW = JSON.parse(document.getElementById('inventory-data').textContent);

const COLORS = {
  amber: '#E8A33D',
  teal: '#4FD1C0',
  red: '#E8664F',
  blue: '#5B8DEF',
  muted: '#8B98A6',
  line: '#2A3542',
  text: '#E9EDF1'
};

Chart.defaults.font.family = "'IBM Plex Mono', monospace";
Chart.defaults.font.size = 11;
Chart.defaults.color = COLORS.muted;

function fmtAED(n){
  return 'AED ' + Math.round(n).toLocaleString('en-US');
}
function fmtPct(n){
  return (n*100).toFixed(2) + '%';
}

// ---------- KPI calculations ----------
const totalSKU = RAW.length;
const totalValue = RAW.reduce((s,r)=>s + r['System Value (AED)'], 0);
const overallAccuracy = RAW.reduce((s,r)=>s + r['Accuracy %'], 0) / totalSKU;
const absVarianceQty = RAW.reduce((s,r)=>s + r['Abs Variance'], 0);
const accurateCount = RAW.filter(r=>r.Status === 'Accurate').length;
const shortageCount = RAW.filter(r=>r.Status === 'Shortage').length;
const excessCount = RAW.filter(r=>r.Status === 'Excess').length;
const cycleCompletePct = RAW.filter(r=>r['Cycle Count Status']==='Completed').length / totalSKU;

document.getElementById('heroAccuracy').innerHTML = (overallAccuracy*100).toFixed(2) + '<small>%</small>';

const kpis = [
  { label:'Total SKU Count', val: totalSKU, cls:'' },
  { label:'Total Inventory Value', val: fmtAED(totalValue), cls:'' },
  { label:'Overall Accuracy', val: fmtPct(overallAccuracy), cls:'up' },
  { label:'Abs Variance Qty', val: absVarianceQty + ' units', cls:'warn' },
  { label:'Shortage / Excess SKUs', val: `${shortageCount} / ${excessCount}`, cls:'down' },
  { label:'Cycle Count Complete', val: fmtPct(cycleCompletePct), cls: cycleCompletePct >= 0.9 ? 'up':'warn' },
];
document.getElementById('kpiGrid').innerHTML = kpis.map(k => `
  <div class="kpi">
    <div class="k-label">${k.label}</div>
    <div class="k-val ${k.cls}">${k.val}</div>
  </div>
`).join('');

// ---------- Helpers to group data ----------
function groupBy(rows, key){
  const map = {};
  rows.forEach(r=>{
    const k = r[key];
    if(!map[k]) map[k] = [];
    map[k].push(r);
  });
  return map;
}

// ---------- Chart 1: Accuracy by Category ----------
const byCategory = groupBy(RAW, 'Category');
const catLabels = Object.keys(byCategory).sort();
const catAccuracy = catLabels.map(c => {
  const rows = byCategory[c];
  return (rows.reduce((s,r)=>s+r['Accuracy %'],0)/rows.length)*100;
});

new Chart(document.getElementById('chartCategory'), {
  type: 'bar',
  data: {
    labels: catLabels,
    datasets: [{
      data: catAccuracy,
      backgroundColor: COLORS.teal,
      borderRadius: 3,
      maxBarThickness: 42
    }]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display:false }, tooltip:{ callbacks:{ label: ctx => ctx.parsed.y.toFixed(2)+'%' } } },
    scales: {
      y: { min:90, max:100, grid:{ color: COLORS.line }, ticks:{ callback:v=>v+'%' } },
      x: { grid:{ display:false } }
    }
  }
});

// ---------- Chart 2: Status split (donut) ----------
new Chart(document.getElementById('chartStatus'), {
  type: 'doughnut',
  data: {
    labels: ['Accurate','Shortage','Excess'],
    datasets: [{
      data: [accurateCount, shortageCount, excessCount],
      backgroundColor: [COLORS.teal, COLORS.red, COLORS.blue],
      borderColor: '#161E26',
      borderWidth: 3
    }]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    cutout: '68%',
    plugins: { legend: { position:'bottom', labels:{ boxWidth:10, padding:16 } } }
  }
});

// ---------- Chart 3: Accuracy by Location ----------
const byLocation = groupBy(RAW, 'Location');
const locLabels = Object.keys(byLocation).sort();
const locAccuracy = locLabels.map(l=>{
  const rows = byLocation[l];
  return (rows.reduce((s,r)=>s+r['Accuracy %'],0)/rows.length)*100;
});

new Chart(document.getElementById('chartLocation'), {
  type: 'bar',
  data: {
    labels: locLabels,
    datasets: [{
      data: locAccuracy,
      backgroundColor: locAccuracy.map(v => v < 98 ? COLORS.red : COLORS.amber),
      borderRadius: 3,
      maxBarThickness: 34
    }]
  },
  options: {
    indexAxis: 'y',
    responsive: true, maintainAspectRatio: false,
    plugins: { legend:{ display:false }, tooltip:{ callbacks:{ label: ctx => ctx.parsed.x.toFixed(2)+'%' } } },
    scales: {
      x: { min:90, max:100, grid:{ color: COLORS.line }, ticks:{ callback:v=>v+'%' } },
      y: { grid:{ display:false } }
    }
  }
});

// ---------- Chart 4: Root cause ----------
const causeCounts = {};
RAW.filter(r=>r['Root Cause'] !== 'No Variance').forEach(r=>{
  causeCounts[r['Root Cause']] = (causeCounts[r['Root Cause']]||0)+1;
});
const causeLabels = Object.keys(causeCounts).sort((a,b)=>causeCounts[b]-causeCounts[a]);
const causeVals = causeLabels.map(c=>causeCounts[c]);

new Chart(document.getElementById('chartRootCause'), {
  type: 'bar',
  data: {
    labels: causeLabels,
    datasets: [{
      data: causeVals,
      backgroundColor: COLORS.blue,
      borderRadius: 3,
      maxBarThickness: 28
    }]
  },
  options: {
    indexAxis: 'y',
    responsive: true, maintainAspectRatio: false,
    plugins: { legend:{ display:false } },
    scales: {
      x: { grid:{ color: COLORS.line }, ticks:{ stepSize:1 } },
      y: { grid:{ display:false } }
    }
  }
});

// ---------- Variance table ----------
const varianceRows = RAW
  .filter(r => r.Status !== 'Accurate')
  .sort((a,b) => b['Abs Variance'] - a['Abs Variance'])
  .slice(0, 10);

document.getElementById('varianceTable').innerHTML = varianceRows.map(r => `
  <tr>
    <td>${r.SKU}</td>
    <td>${r.Description}</td>
    <td>${r.Category}</td>
    <td>${r.Location}</td>
    <td><span class="pill ${r.Status}">${r.Status}</span></td>
    <td>${r['Variance Qty']}</td>
    <td>${r['Root Cause']}</td>
  </tr>
`).join('');
