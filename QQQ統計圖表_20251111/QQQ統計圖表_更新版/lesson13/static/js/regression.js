let chart = null; //圖表實體
let modelData = null; //儲存模型資料

// 頁面戴入完成後才執行
document.addEventListener('DOMContentLoaded', function () {
    loadRegressionData();

    //綁定預測按鈕事件
    document.getElementById('predict-btn').addEventListener('click',function(){
        const rooms = parseFloat(document.getElementById('rooms-input').value)
        predictPrice(rooms)
    })

    //綁定Enter鍵觸發預測
    document.getElementById('rooms-input').addEventListener('keypress',function(e){
        if(e.key === "Enter"){
            const rooms = parseFloat(this.value)
            predictPrice(rooms)
        }
    })
});

async function loadRegressionData() {
    showLoading(true);
    try {
        const response = await fetch('/regression/api/data')
        if (!response.ok) {
            throw new Error(`網路出現問題:${response.statusText}`)
        }
        const data = await response.json()

        if (!data.success) {
            throw new Error(`解析josn失敗`);
        }
        modelData = data

        // 繪制圖表
        renderChart(data)

        // 更新評估指標
        updateMetrics(data.metrics)

        // 更新模型資訊
        updateModelInfo(data.description)

    } catch (error) {
        showError(error.message);
    } finally {
        showLoading(false);
    }

};

function renderChart(data) {
    const ctx = document.getElementById('regressionChart').getContext('2d')

    // 如果圖表已經存在,先銷毀
    if (chart) {
        chart.destroy();
    }
    //準備訓練資料集
    const trainData = data.data.train.x.map((xvalue, index) =>
    ({
        x: xvalue,
        y: data.data.train.y[index]
    })
    )

    //準備測試資料集
    const testData = data.data.test.x.map((xvalue, index) =>
    ({
        x: xvalue,
        y: data.data.test.y[index]
    })
    )

    //準備迴歸線資料集
    const regressionLine = data.data.regression_line.x.map((xvalue, index) =>
    (
        {
            x: xvalue,
            y: data.data.regression_line.y[index]
        }
    )
    )

    //建立圖表
    chart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: '訓練資料',
                    data: trainData,
                    backgroundColor: 'rgba(102, 126, 234, 0.6)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    pointRadius: 6,
                    pointHoverRadius: 8
                },
                {
                    label: '測試資料',
                    data: testData,
                    backgroundColor: 'rgba(237, 100, 166, 0.6)',
                    borderColor: 'rgba(237, 100, 166, 1)',
                    pointRadius: 6,
                    pointHoverRadius: 8
                },
                {
                    label: '迴歸線',
                    data: regressionLine,
                    type: 'line',
                    borderColor: '#f59e0b',
                    borderWidth: 3,
                    fill: false,
                    pointRadius: 0,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: function(evt, activeElements){
                if(activeElements.length > 0){
                    const element = activeElements[0]
                    const datasetIndex = element.datasetIndex
                    const index = element.index
                    const dataset = chart.data.datasets[datasetIndex]

                    if(datasetIndex === 0 || datasetIndex === 1){ //訓練或測試資料
                        const point = dataset.data[index]
                        const rooms = point.x
                        
                        //更新輸入框
                        document.getElementById('rooms-input').value = rooms.toFixed(1)
                        predictPrice(rooms)

                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: '平均房間數 vs 房價',
                    font: {
                        size: 18,
                        weight: 'bold'
                    },
                    padding: 20
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const datasetLabel = context.dataset.label || '';
                            const xValue = context.parsed.x.toFixed(2);
                            const yValue = context.parsed.y.toFixed(2);
                            return `${datasetLabel}: (平均房間數:${xValue}, 房價:${yValue})`;                            
                        },
                        afterLabel:function(context){
                            if(context.datasetIndex === 0 || context.datasetIndex === 1){
                                return '點擊可預測此資料點';
                            }
                            return '';
                        }
                    }
                }
            },
            animation: {
              duration: 1000,
              easing: 'easeInOutQuart'  
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: `${data.description.feature_name} (${data.description.feature_unit})`,
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: `${data.description.target_name} (${data.description.target_unit})`,
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            }
        }
    })
}

async function predictPrice(rooms){
    if (isNaN(rooms) || rooms < 1 || rooms > 15){
        alert('請輸入有效的房間數(1~15間)')
        return;
    }
    try{
        const response = await fetch(`/regression/api/predict?rooms=${rooms}`)
        const data = await response.json()
        if(data.success){
            //更新預測結果
            document.getElementById('predicted-price').textContent = data.prediction.price;

            //在圖表上顯示預測點
            if(chart && modelData){
                addPredictionPoint(rooms, data.prediction.price)
            }
        }else{
            showError(data.error);
        }
    } catch(error){
        showError('預測失敗:' + error.message)
    }
    
}

function addPredictionPoint(x, y){
    // 移除之前的預測點
    const existingDatasets = chart.data.datasets.filter(ds => ds.label !== '您的預測')
    existingDatasets.push({
        label: '您的預測',
        data: [{x:x,y:y}],
        backgroundColor: '#ffc107',
        borderColor: '#ff9800',
        pointRadius: 12,
        pointHoverRadius: 15,
        pointStyle: 'star',
        borderWidth: 3
    })

    chart.data.datasets = existingDatasets;
    chart.update();
}

function updateMetrics(metrics){
    document.getElementById('r2-score').textContent = metrics.r2_score;
    document.getElementById('mse').textContent = metrics.mse;
    document.getElementById('rmse').textContent = metrics.rmse;
    document.getElementById('coefficient').textContent = metrics.coefficient;

    //R² 分數顏色提示
    const r2Element = document.getElementById('r2-score')
    const r2Value = metrics.r2_score;
    if(r2Value > 0.7){
        r2Element.style.color = '#4caf50';
    }else if(r2Value > 0.4){
        r2Element.style.color = '#ff9800';
    }else{
        r2Element.style.color = '#f44336';
    }
}

function updateModelInfo(description){
    console.table(description)
    document.getElementById('dataset-name').textContent = description.dataset
    document.getElementById('total-samples').textContent = description.samples
    document.getElementById('train-size').textContent = description.train_size
    document.getElementById('test-size').textContent = description.test_size
    document.getElementById('target-name').textContent = description.target_name
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.add('active');
    } else {
        loading.classList.remove('active');
    }
};

function showError(message) {
    alert('錯誤:' + message);
    console.log(message)
}