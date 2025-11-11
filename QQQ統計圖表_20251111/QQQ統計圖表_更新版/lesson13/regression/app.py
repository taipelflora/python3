from flask import Blueprint,render_template,request,jsonify
from sklearn.datasets import fetch_california_housing
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_squared_error
import numpy as np

regression_bp = Blueprint(
    'regression',
    __name__,
    url_prefix='/regression',
    template_folder='../templates',
    static_folder='../static'
)

@regression_bp.route('/regression_index')
def regression_index():
    return render_template('regression.html')

@regression_bp.route("/api/data")
def regression_data():
    """線性迴歸 API - 使用加州房價資料集（簡化版）"""
    try:  

        # 載入加州房價資料集
        housing = fetch_california_housing()

        # 只使用前200筆資料作為展示
        sample_size = 200
        X_full = housing.data[:sample_size]
        y_full = housing.target[:sample_size] #房價(單位:十萬美元)

        # 使用**平均房間數**作為預測特徵(索引2)
        feature_idx = 2
        X = X_full[:,feature_idx].reshape(-1,1)
        y = y_full * 10

        # 分割訓練和測試資料(80/20)
        X_train, X_test, y_train, y_test = train_test_split(X,y,test_size=0.2,random_state=42)

        # 訓練線性迴歸模型
        model = LinearRegression()
        model.fit(X_train, y_train)

        # 預測
        # 訓練資料的預測
        y_train_pred = model.predict(X_train)

        #測試資料的預測
        y_test_pred = model.predict(X_test)

        # 計算評估指標
        r2 = r2_score(y_test, y_test_pred)
        mse = mean_squared_error(y_test, y_test_pred)
        rmse = np.sqrt(mse)

        # 生成迴歸線資料(用於繪圖)
        X_line = np.linspace(X.min(),X.max(), 100).reshape(-1,1)
        y_line = model.predict(X_line)

        # 準備回應資料
        response = {
            "success": True,
            "data":{
                "train":{
                    "x": X_train.flatten().tolist(),
                    "y": y_train.tolist(),
                    "y_pred": y_train_pred.tolist()
                },
                "test":{
                    "x": X_test.flatten().tolist(),
                    "y": y_test.tolist(),
                    "y_pred": y_test_pred.tolist()
                },
                "regression_line":{
                    "x": X_line.flatten().tolist(),
                    "y": y_line.tolist()
                }        
            },
            "metrics":{
                "r2_score": round(r2, 4),
                "mse": round(mse, 2),
                "rmse": round(rmse, 2),
                "coefficient": round(model.coef_[0], 2),
                "intercept": round(model.intercept_, 2)
            },
            "description":{
                "dataset":"加州房價資料集",
                "samples": len(y),
                "train_size": len(y_train),
                "test_size": len(y_test),
                "feature_name": "平均房間數",
                "feature_unit": "間",
                "target_name": "房價",
                "target_unit": "萬美元",
                "info": "此資料集取自 1990 年加州人口普查資料"
            }
        }

        return jsonify(response)
    except Exception as e:
        return jsonify(
            {
                "success": False,
                "error": str(e)
            }, 500
        )

@regression_bp.route("/api/predict")
def regression_predict():
    """線性迴歸預測 API - 根據房間數預測房價"""
    try:
    # 取得使用者輸入的房間數
        rooms = float(request.args.get('rooms', 5))

        # 載入資料並訓練模型
        housing = fetch_california_housing()
        sample_size = 200
        feature_idx = 2
        X = housing.data[:sample_size,feature_idx].reshape(-1,1) #特徵
        y = housing.target[:sample_size] * 10 # 房價(萬美金) #標籤

        # 訓練模型
        model = LinearRegression()
        model.fit(X, y)

        # 預測
        X_input = np.array([[rooms]])
        predicted_price = model.predict(X_input)[0]
        print(predicted_price)

        response = {
            "success": True,
            "input": {
                "rooms": rooms,
                "unit" : "間"
            },
            "prediction": {
                "price": round(predicted_price, 2),
                "unit": "萬美元"
            },
            "formula":{
                "coefficient": round(model.coef_[0],2),
                "intercept": round(model.intercept_, 2),
                "equation": f"房價={round(model.coef_[0],2)} x 房間數 + {round(model.intercept_, 2)}"
            }
        }
        return jsonify(response)
    except Exception as error:
        return jsonify({
            "success": False,
            "error": str(error)
        }), 500