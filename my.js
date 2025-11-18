// app.js - QQQ 儀表板的最終邏輯 (已修改為 Twelve Data API，並優化即時數據更新)

// --- 配置部分 (請務必替換 API Key) ---
const QQQ_TICKER = 'QQQ';
// ⚠️ 請替換成您在 Twelve Data 網站上註冊獲取的真實 Key ⚠️
const API_KEY = '18ef03e311f344e58c1b1918dbfb5cec'; // <--- 請在這裡替換成您自己的 Key！

const BASE_URL = 'https://api.twelvedata.com';

// 1. 即時報價 API (Twelve Data 使用 /price 接口，僅返回最新價格)
const GLOBAL_QUOTE_API = `${BASE_URL}/price?symbol=${QQQ_TICKER}&apikey=${API_KEY}`;

// 2. 歷史數據 API (Twelve Data 使用 /time_series 接口，interval=1day 獲取日線數據)
const HISTORY_API = `${BASE_URL}/time_series?symbol=${QQQ_TICKER}&interval=1day&outputsize=100&apikey=${API_KEY}`;

// 3. MACD 指標 API (Twelve Data 使用 /macd 接口，用於 model-chart)
const MACD_API = `${BASE_URL}/macd?symbol=${QQQ_TICKER}&interval=1day&fast_period=12&slow_period=26&signal_period=9&apikey=${API_KEY}`;


// --- ECharts 初始化 ---
const priceChartDom = document.getElementById('price-chart');
const modelChartDom = document.getElementById('model-chart');

// 確保 ECharts 已經載入
const priceChart = priceChartDom && window.echarts ? echarts.init(priceChartDom) : null;
const modelChart = modelChartDom && window.echarts ? echarts.init(modelChartDom) : null;


// --- 儀表板頂部數據更新函數 (通用版本，用於填充所有欄位) ---
// 由於 Twelve Data /price 數據不完整，我們在此調整為只處理 K 線圖所需的數據，
// 即時價格更新將直接在 fetchAndUpdateData 函式中處理。
function updateDashboard(latestPrice, changePct, changeAmt, open, high, low, volume) {
    const priceEl = document.getElementById('current-price');
    const changePctEl = document.getElementById('price-change-pct');
    const changeAmtEl = document.getElementById('price-change-amt');

    // 1. 更新當前價格 (如果從 K 線圖數據中獲取到最新價格)
    if (latestPrice) {
        priceEl.textContent = latestPrice.toFixed(2);
    }

    // 2. 更新漲跌幅和統計數據 (如果數據為空，則顯示 '--')
    changePctEl.textContent = changePct ? `${changePct.toFixed(2)}%` : '--';
    const formattedChangeAmt = changeAmt !== undefined ? (changeAmt > 0 ? `+${changeAmt.toFixed(2)}` : changeAmt.toFixed(2)) : '--';
    changeAmtEl.textContent = formattedChangeAmt;

    // 3. 顏色邏輯
    changePctEl.classList.remove('up', 'down');
    changeAmtEl.classList.remove('up', 'down');
    if (changePct > 0) {
        changePctEl.classList.add('up');
        changeAmtEl.classList.add('up');
    } else if (changePct < 0) {
        changePctEl.classList.add('down');
        changeAmtEl.classList.add('down');
    }

    // 4. 統計網格
    document.getElementById('open-price').textContent = open ? open.toFixed(2) : '--';
    document.getElementById('high-price').textContent = high ? high.toFixed(2) : '--';
    document.getElementById('low-price').textContent = low ? low.toFixed(2) : '--';
    document.getElementById('volume').textContent = volume ? volume.toLocaleString() : '--';
}


// --- 獲取並解析即時數據 (優化後 Twelve Data 版本) ---
async function fetchAndUpdateData() {
    try {
        const response = await fetch(GLOBAL_QUOTE_API);
        // 確保響應狀態碼是 200 級別
        if (!response.ok) {
            throw new Error(`HTTP 錯誤! 狀態: ${response.status}`);
        }

        const data = await response.json();

        // ⚠️ Twelve Data 錯誤檢查 (如果返回錯誤狀態，則拋出錯誤)
        if (data.status === 'error' || data.code) {
            throw new Error(`Twelve Data API 錯誤或限制: ${data.message || '未知錯誤'}`);
        }

        const priceEl = document.getElementById('current-price');
        const changePctEl = document.getElementById('price-change-pct');
        const changeAmtEl = document.getElementById('price-change-amt');

        // Twelve Data 的 /price 接口只返回單一價格
        if (data && data.price) {
            const latestPrice = parseFloat(data.price);

            // 1. 更新當前價格
            if (priceEl) {
                priceEl.textContent = latestPrice.toFixed(2);
                console.log(`即時價格更新成功: ${latestPrice}`);
            }

            // 2. 清理其他不完整的統計欄位，防止顯示錯誤數據
            document.getElementById('open-price').textContent = '--';
            document.getElementById('high-price').textContent = '--';
            document.getElementById('low-price').textContent = '--';
            document.getElementById('volume').textContent = '--';

            // 清理漲跌幅顏色和數值
            if (changePctEl) changePctEl.textContent = '--';
            if (changeAmtEl) changeAmtEl.textContent = '--';
            if (changePctEl) changePctEl.classList.remove('up', 'down');
            if (changeAmtEl) changeAmtEl.classList.remove('up', 'down');

        } else {
            // 如果 API 成功，但沒有價格數據
            throw new Error("API 數據結構錯誤或價格數據缺失。");
        }

    } catch (error) {
        console.error("即時數據更新失敗:", error);
        // 失敗時，將價格顯示為 --
        const priceEl = document.getElementById('current-price');
        if (priceEl) priceEl.textContent = '--';
    }
}


// --- K 線圖繪製邏輯 (Twelve Data 版本) ---

// 獲取歷史數據並整理格式
async function fetchAndDrawKLine() {
    if (!priceChart) return;

    try {
        const response = await fetch(HISTORY_API);
        const data = await response.json();

        // ⚠️ Twelve Data 數據在 'values' 鍵下，且是最新的數據在最前面
        const timeSeries = data.values;

        if (!timeSeries || data.status === 'error') {
            priceChart.setOption({ title: { text: 'K線圖數據載入失敗 (請檢查 Twelve Data Key 或頻率限制)', left: 'center' } });
            return;
        }

        let dates = [];
        let prices = [];

        // 1. 為了讓圖表從左到右是時間順序，我們遍歷後再反轉
        const rawDates = [];
        const rawPrices = [];

        timeSeries.forEach(dailyData => {
            rawDates.push(dailyData.datetime);
            // K線圖數據順序: [open, close, low, high]
            rawPrices.push([
                parseFloat(dailyData.open),
                parseFloat(dailyData.close),
                parseFloat(dailyData.low),
                parseFloat(dailyData.high)
            ]);
        });

        // 2. 反轉陣列，使時間順序從舊到新 (左到右)
        dates = rawDates.reverse();
        prices = rawPrices.reverse();

        drawKLineChart(dates, prices);

    } catch (error) {
        console.error("獲取歷史數據失敗 (K線):", error);
    }
}

// 繪製 K 線圖 (不變)
function drawKLineChart(dates, prices) {
    const option = {
        title: { text: `${QQQ_TICKER} 股價 K 線圖`, left: 'center', textStyle: { fontSize: 14 } },
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        xAxis: { type: 'category', data: dates, scale: true, boundaryGap: false, axisLine: { onZero: false }, splitLine: { show: false } },
        yAxis: { scale: true },
        series: [
            {
                name: 'K線', type: 'candlestick', data: prices,
                itemStyle: { color: '#00da3c', color0: '#ef232a', borderColor: '#00da3c', borderColor0: '#ef232a' }
            }
        ]
    };
    priceChart.setOption(option);
}


// --- 模型圖形/MACD 副圖邏輯 (Twelve Data 版本) ---

async function fetchAndDrawMACD() {
    if (!modelChart) return;

    try {
        const response = await fetch(MACD_API);
        const data = await response.json();

        // ⚠️ MACD 數據在 'values' 鍵下，且是最新的數據在最前面
        const macdSeries = data.values;

        if (!macdSeries || data.status === 'error') {
            modelChart.setOption({ title: { text: 'MACD數據載入失敗 (請檢查 Twelve Data Key 或頻率限制)', left: 'center' } });
            return;
        }

        let dates = [];
        let macdLine = [];
        let signalLine = [];
        let histogram = [];

        // 1. 為了讓圖表從左到右是時間順序，我們遍歷後再反轉
        const rawDates = [];
        const rawMacdLine = [];
        const rawSignalLine = [];
        const rawHistogram = [];

        macdSeries.forEach(dailyData => {
            rawDates.push(dailyData.datetime);
            // MACD 的鍵名是 'macd', 'macd_signal', 'histogram'
            rawMacdLine.push(parseFloat(dailyData.macd));
            rawSignalLine.push(parseFloat(dailyData.macd_signal));
            rawHistogram.push(parseFloat(dailyData.histogram));
        });

        // 2. 反轉陣列，使時間順序從舊到新 (左到右)
        dates = rawDates.reverse();
        macdLine = rawMacdLine.reverse();
        signalLine = rawSignalLine.reverse();
        histogram = rawHistogram.reverse();

        drawMACDChart(dates, macdLine, signalLine, histogram);

    } catch (error) {
        console.error("獲取MACD數據失敗:", error);
    }
}

function drawMACDChart(dates, macdLine, signalLine, histogram) {
    const option = {
        // 修正：移除 ECharts 內建標題，避免與 HTML h2 衝突
        // title: { text: 'MACD (模型圖形)', left: 'center', textStyle: { fontSize: 14 } }, 
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        // 修正：調整 top 至 20% (原 15%)，給 h2 標題和圖例更多空間
        grid: { left: '3%', right: '4%', bottom: '10%', top: '20%', containLabel: true },
        xAxis: { type: 'category', data: dates, splitLine: { show: false } },
        yAxis: { scale: true },
        // 確保副圖也支持縮放和平移，並與主圖同步
        dataZoom: [{ type: 'inside', start: 70, end: 100 }, { type: 'slider', start: 70, end: 100 }],
        // 修正：調整圖例位置，使其靠右對齊 (right: 30)
        legend: { data: ['MACD', 'Signal', 'Histogram'], top: 'top', right: 30 },
        series: [
            // 柱狀圖 (Histogram)
            {
                name: 'Histogram',
                type: 'bar',
                data: histogram,
                itemStyle: {
                    // 根據正負值設置顏色
                    color: function (params) {
                        return params.value > 0 ? '#00da3c' : '#ef232a';
                    }
                }
            },
            // MACD 線 (折線圖)
            {
                name: 'MACD',
                type: 'line',
                data: macdLine,
                lineStyle: { color: '#007bff', width: 1.5 }, // 藍色
                symbol: 'none'
            },
            // Signal 線 (折線圖)
            {
                name: 'Signal',
                type: 'line',
                data: signalLine,
                lineStyle: { color: '#ffc107', width: 1.5, type: 'dashed' }, // 黃色虛線
                symbol: 'none'
            }
        ]
    };
    modelChart.setOption(option);
}


// --- 最終執行部分 (包含定時同步) ---

// 1. 初始執行 K 線圖 (歷史數據)
fetchAndDrawKLine();
// 每 1 小時 (3,600,000 毫秒) 同步一次 K 線圖數據
setInterval(fetchAndDrawKLine, 3600000);

// 2. 初始執行 MACD 副圖 (模型/指標數據)
fetchAndDrawMACD();
// 每 1 小時同步一次 MACD 數據
setInterval(fetchAndDrawMACD, 3600000);


// 3. 執行即時數據，並設置定時刷新 (15 秒/次)
fetchAndUpdateData();
setInterval(fetchAndUpdateData, 15000);

// 讓圖表在窗口大小改變時響應式調整
window.addEventListener('resize', () => {
    if (priceChart) priceChart.resize();
    if (modelChart) modelChart.resize();
});