document.addEventListener('DOMContentLoaded', function () {
    const qqqCtx = document.getElementById('qqqClosePriceChart')?.getContext('2d');
    const featureCtx = document.getElementById('featureChart')?.getContext('2d');
    let qqqChart = null; // QQQ chart instance
    let featureChart = null; // Feature chart instance
    let allData = [];
    let currentTimeRange = 'all';

    // Indicator visibility state
    const indicatorsVisible = { SMA: false, EMA: false, BBANDS: false, MACD: false, RSI: false, STOCH: false, ATR: false, CMF: false };

    // --- Data utilities ---
    function filterDataByRange(range) {
        if (range === 'all') return allData;
        if (range === 'model') {
            return allData.filter(row => {
                if (!row.date) return false;
                const y = new Date(row.date).getFullYear();
                return y >= 2017 && y <= 2025;
            });
        }
        return allData;
    }

    // --- Indicator implementations ---
    function computeSMA(values, period) {
        const out = new Array(values.length).fill(null);
        let sum = 0;
        for (let i = 0; i < values.length; i++) {
            const v = values[i];
            if (v == null) { out[i] = null; continue; }
            sum += v;
            if (i >= period) {
                const prev = values[i - period];
                if (prev != null) sum -= prev;
            }
            if (i >= period - 1) out[i] = sum / period;
        }
        return out;
    }

    function computeEMA(values, period) {
        const out = new Array(values.length).fill(null);
        const k = 2 / (period + 1);
        let ema = null;
        for (let i = 0; i < values.length; i++) {
            const v = values[i];
            if (v == null) { out[i] = null; continue; }
            if (ema == null) ema = v;
            else ema = v * k + ema * (1 - k);
            out[i] = ema;
        }
        return out;
    }

    function stddev(values, period) {
        const out = new Array(values.length).fill(null);
        for (let i = 0; i < values.length; i++) {
            if (i >= period - 1) {
                let mean = 0;
                for (let j = i - period + 1; j <= i; j++) mean += values[j] || 0;
                mean /= period;
                let sum = 0;
                for (let j = i - period + 1; j <= i; j++) sum += Math.pow((values[j] || 0) - mean, 2);
                out[i] = Math.sqrt(sum / period);
            }
        }
        return out;
    }

    function computeBBANDS(values, period = 20, mult = 2) {
        const mid = computeSMA(values, period);
        const sd = stddev(values, period);
        const upper = mid.map((m, i) => (m == null || sd[i] == null) ? null : m + mult * sd[i]);
        const lower = mid.map((m, i) => (m == null || sd[i] == null) ? null : m - mult * sd[i]);
        return { upper, mid, lower };
    }

    function computeRSI(values, period = 14) {
        const out = new Array(values.length).fill(null);
        for (let i = 1; i < values.length; i++) {
            if (i < period) continue;
            if (i === period) {
                let gain = 0, loss = 0;
                for (let j = 1; j <= period; j++) {
                    const ch = values[j] - values[j - 1];
                    gain += Math.max(ch, 0);
                    loss += Math.max(-ch, 0);
                }
                const avgG = gain / period; const avgL = loss / period;
                out[i] = avgL === 0 ? 100 : 100 - (100 / (1 + avgG / avgL));
            } else {
                let sumG = 0, sumL = 0;
                for (let j = i - period + 1; j <= i; j++) { const ch = values[j] - values[j - 1]; sumG += Math.max(ch, 0); sumL += Math.max(-ch, 0); }
                const avgG = sumG / period; const avgL = sumL / period;
                out[i] = avgL === 0 ? 100 : 100 - (100 / (1 + avgG / avgL));
            }
        }
        return out;
    }

    function computeStochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
        const K = new Array(closes.length).fill(null);
        for (let i = 0; i < closes.length; i++) {
            if (i >= kPeriod - 1) {
                let hh = -Infinity, ll = Infinity;
                for (let j = i - kPeriod + 1; j <= i; j++) { if (highs[j] != null) hh = Math.max(hh, highs[j]); if (lows[j] != null) ll = Math.min(ll, lows[j]); }
                const denom = hh - ll;
                K[i] = denom === 0 ? 0 : ((closes[i] - ll) / denom) * 100;
            }
        }
        const D = computeSMA(K, dPeriod);
        return { K, D };
    }

    function computeATR(highs, lows, closes, period = 14) {
        const TR = new Array(closes.length).fill(null);
        for (let i = 0; i < closes.length; i++) {
            if (i === 0) TR[i] = (highs[i] - lows[i]) || null;
            else TR[i] = Math.max((highs[i] - lows[i]) || 0, Math.abs((highs[i] || 0) - (closes[i - 1] || 0)), Math.abs((lows[i] || 0) - (closes[i - 1] || 0)));
        }
        return computeSMA(TR, period);
    }

    function computeMACD(values, fast = 12, slow = 26, signal = 9) {
        const emaFast = computeEMA(values, fast);
        const emaSlow = computeEMA(values, slow);
        const macd = values.map((v, i) => (emaFast[i] == null || emaSlow[i] == null) ? null : emaFast[i] - emaSlow[i]);
        const signalLine = computeEMA(macd, signal);
        const hist = macd.map((m, i) => (m == null || signalLine[i] == null) ? null : m - signalLine[i]);
        return { macd, signalLine, hist };
    }

    function computeCMF(highs, lows, closes, volumes, period = 20) {
        const mfm = new Array(closes.length).fill(null);
        const mfv = new Array(closes.length).fill(null);
        for (let i = 0; i < closes.length; i++) {
            const h = highs[i], l = lows[i], c = closes[i], v = volumes[i];
            if (h == null || l == null || c == null || v == null) continue;
            const denom = h - l;
            const multiplier = denom === 0 ? 0 : ((c - l) - (h - c)) / denom;
            mfm[i] = multiplier;
            mfv[i] = multiplier * v;
        }
        const out = new Array(closes.length).fill(null);
        for (let i = 0; i < closes.length; i++) {
            if (i >= period - 1) {
                let sumMFV = 0, sumVol = 0;
                for (let j = i - period + 1; j <= i; j++) { sumMFV += mfv[j] || 0; sumVol += volumes[j] || 0; }
                out[i] = sumVol === 0 ? null : sumMFV / sumVol;
            }
        }
        return out;
    }

    // --- Chart creation helpers ---
    function createChart(ctx, dataKeys, labels, yAxisLabel, colors = ['#2196F3'], dualAxis = false, dataToUse = allData) {
        if (!ctx || !dataToUse || !dataToUse.length) return null;
        const keyArray = Array.isArray(dataKeys) ? dataKeys : [dataKeys];
        const labelArray = Array.isArray(labels) ? labels : [labels];

        const chartData = dataToUse.filter(row => row.date && row[keyArray[0]] != null);
        const dates = chartData.map(r => new Date(r.date));

        const datasets = keyArray.map((key, idx) => {
            const values = chartData.map(r => r[key]);
            const color = colors[idx % colors.length] || '#2196F3';
            return { label: labelArray[idx] || key, data: values, borderColor: color, backgroundColor: color + '33', borderWidth: 2, tension: 0.1, fill: false, pointRadius: 0, yAxisID: dualAxis && idx === 0 ? 'y1' : 'y' };
        });

        const scales = {
            x: { type: 'time', time: { unit: 'month', displayFormats: { month: 'yyyy-MM' } }, title: { display: true, text: '日期' }, ticks: { autoSkip: true, maxTicksLimit: 20 } },
            y: { position: 'left', title: { display: true, text: yAxisLabel } }
        };
        if (dualAxis) scales.y1 = { type: 'linear', position: 'right', title: { display: true, text: labelArray[0] || '右軸' }, grid: { drawOnChartArea: false } };

        return new Chart(ctx, { type: 'line', data: { labels: dates, datasets }, options: { responsive: true, maintainAspectRatio: true, aspectRatio: 2.5, plugins: { legend: { display: true, position: 'top' }, tooltip: { mode: 'index', intersect: false, callbacks: { label: function (context) { return `${context.dataset.label}: ${context.parsed.y != null ? context.parsed.y.toFixed(2) : context.parsed.y}`; } } } }, scales } });
    }

    function updateFeatureChart(dataKey, label, yAxisLabel) {
        if (!featureCtx) return;
        if (featureChart) featureChart.destroy();
        const filtered = filterDataByRange(currentTimeRange);
        featureChart = createChart(featureCtx, ['close', dataKey], ['QQQ 收盤價 (USD)', label], yAxisLabel, ['#FF6B6B', '#2196F3'], true, filtered);
    }

    function drawQqqChart(dataToUse) {
        if (!qqqCtx || !dataToUse || !dataToUse.length) return;
        if (qqqChart) qqqChart.destroy();

        const dates = dataToUse.map(r => new Date(r.date));
        const closes = dataToUse.map(r => r.close == null ? null : Number(r.close));
        const highs = dataToUse.map(r => r.high == null ? null : Number(r.high));
        const lows = dataToUse.map(r => r.low == null ? null : Number(r.low));
        const volumes = dataToUse.map(r => r.volume == null ? null : Number(r.volume));

        const datasets = [];
        datasets.push({ label: 'QQQ 收盤價', data: closes, borderColor: '#111827', backgroundColor: 'rgba(17,24,39,0.05)', borderWidth: 2, tension: 0.1, fill: false, pointRadius: 0, yAxisID: 'y1' });

        if (indicatorsVisible.SMA) datasets.push({ label: 'SMA(20)', data: computeSMA(closes, 20), borderColor: '#FF8C00', borderWidth: 1.5, tension: 0.1, fill: false, pointRadius: 0, yAxisID: 'y1' });
        if (indicatorsVisible.EMA) datasets.push({ label: 'EMA(20)', data: computeEMA(closes, 20), borderColor: '#00A86B', borderWidth: 1.5, tension: 0.1, fill: false, pointRadius: 0, yAxisID: 'y1' });
        if (indicatorsVisible.BBANDS) { const b = computeBBANDS(closes, 20, 2); datasets.push({ label: 'BBANDS Upper', data: b.upper, borderColor: '#8A2BE2', borderWidth: 1, tension: 0.1, fill: false, pointRadius: 0, borderDash: [4, 2], yAxisID: 'y1' }); datasets.push({ label: 'BBANDS Mid', data: b.mid, borderColor: '#8A2BE2', borderWidth: 1, tension: 0.1, fill: false, pointRadius: 0, yAxisID: 'y1' }); datasets.push({ label: 'BBANDS Lower', data: b.lower, borderColor: '#8A2BE2', borderWidth: 1, tension: 0.1, fill: false, pointRadius: 0, borderDash: [4, 2], yAxisID: 'y1' }); }
        if (indicatorsVisible.MACD) { const macd = computeMACD(closes); datasets.push({ label: 'MACD', data: macd.macd, borderColor: '#FF1493', borderWidth: 1.5, tension: 0.1, fill: false, pointRadius: 0, yAxisID: 'y' }); datasets.push({ label: 'Signal', data: macd.signalLine, borderColor: '#1E90FF', borderWidth: 1, tension: 0.1, fill: false, pointRadius: 0, yAxisID: 'y' }); datasets.push({ label: 'MACD Hist', data: macd.hist, type: 'bar', backgroundColor: 'rgba(255,20,147,0.3)', yAxisID: 'y' }); }
        if (indicatorsVisible.RSI) datasets.push({ label: 'RSI(14)', data: computeRSI(closes, 14), borderColor: '#FF4500', borderWidth: 1, tension: 0.1, fill: false, pointRadius: 0, yAxisID: 'y' });
        if (indicatorsVisible.STOCH) { const st = computeStochastic(highs, lows, closes, 14, 3); datasets.push({ label: '%K', data: st.K, borderColor: '#32CD32', borderWidth: 1, tension: 0.1, fill: false, pointRadius: 0, yAxisID: 'y' }); datasets.push({ label: '%D', data: st.D, borderColor: '#FFD700', borderWidth: 1, tension: 0.1, fill: false, pointRadius: 0, yAxisID: 'y' }); }
        if (indicatorsVisible.ATR) datasets.push({ label: 'ATR(14)', data: computeATR(highs, lows, closes, 14), borderColor: '#708090', borderWidth: 1, tension: 0.1, fill: false, pointRadius: 0, yAxisID: 'y' });
        if (indicatorsVisible.CMF) datasets.push({ label: 'CMF(20)', data: computeCMF(highs, lows, closes, volumes, 20), borderColor: '#20B2AA', borderWidth: 1, tension: 0.1, fill: false, pointRadius: 0, yAxisID: 'y' });

        const scales = { x: { type: 'time', time: { unit: 'month', displayFormats: { month: 'yyyy-MM' } }, title: { display: true, text: '日期' }, ticks: { autoSkip: true, maxTicksLimit: 20 } }, y: { position: 'left', title: { display: true, text: '指標 / 振盪' } }, y1: { position: 'right', title: { display: true, text: '股價 (USD)' }, grid: { drawOnChartArea: false } } };

        qqqChart = new Chart(qqqCtx, { type: 'line', data: { labels: dates, datasets }, options: { responsive: true, maintainAspectRatio: true, aspectRatio: 2.5, plugins: { legend: { display: true, position: 'top' }, tooltip: { mode: 'index', intersect: false } }, scales } });
    }

    // --- Initialization / data loading ---
    async function loadAndInitialize() {
        try {
            const res = await fetch('data.csv');
            const csv = await res.text();
            Papa.parse(csv, {
                header: true, dynamicTyping: true, skipEmptyLines: true, complete: results => {
                    allData = results.data.map(r => ({ ...r }));
                    const filtered = filterDataByRange(currentTimeRange);
                    drawQqqChart(filtered);
                    // initial feature chart
                    if (featureCtx) {
                        featureChart = createChart(featureCtx, ['close', 'M2_Not_seasonally_adjusted'], ['QQQ 收盤價 (USD)', 'M2:廣義貨幣供給量'], '數值', ['#FF6B6B', '#2196F3'], true, filtered);
                    }
                }
            });
        } catch (err) {
            console.error('讀取 data.csv 發生錯誤', err);
            alert('讀取 data.csv 檔案時發生錯誤: ' + err.message);
        }
    }

    // --- UI wiring ---
    document.querySelectorAll('.time-filter-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const range = this.dataset.range;
            const section = this.closest('.chart-container');
            const chartId = section ? section.querySelector('canvas')?.id : null;
            const actualChartType = this.dataset.chart || (chartId === 'qqqClosePriceChart' ? 'qqq' : chartId === 'featureChart' ? 'feature' : null);
            if (!actualChartType) return;
            currentTimeRange = range;
            // update active
            section.querySelectorAll('.time-filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const filtered = filterDataByRange(range);
            if (actualChartType === 'qqq') drawQqqChart(filtered);
            else if (actualChartType === 'feature') { if (featureChart) featureChart.destroy(); featureChart = createChart(featureCtx, ['close', 'M2_Not_seasonally_adjusted'], ['QQQ 收盤價 (USD)', '特徵'], '數值', ['#FF6B6B', '#2196F3'], true, filtered); }
        });
    });

    // indicator toggles: use change event for checkboxes
    document.querySelectorAll('.indicator-toggle').forEach(el => {
        el.addEventListener('change', function () {
            const ind = this.dataset.ind;
            indicatorsVisible[ind] = !!this.checked;
            this.classList.toggle('active', !!this.checked);
            const filtered = filterDataByRange(currentTimeRange);
            drawQqqChart(filtered);
        });
    });

    document.querySelectorAll('.chart-card').forEach(card => {
        card.addEventListener('click', function () {
            const dataKey = this.dataset.key;
            const label = this.dataset.label;
            const yAxis = this.dataset.yAxis || '數值';
            if (!dataKey || dataKey === 'close') return;
            updateFeatureChart(dataKey, label, yAxis);
        });
    });

    // Start
    loadAndInitialize();
});