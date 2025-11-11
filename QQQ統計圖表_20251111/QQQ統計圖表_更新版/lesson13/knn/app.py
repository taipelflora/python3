from flask import Blueprint,render_template,jsonify,request
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import accuracy_score, confusion_matrix

knn_bp = Blueprint(
    'knn',
    __name__,
    url_prefix='/knn',
    template_folder='../templates',
    static_folder='../static'
)

@knn_bp.route('/knn_index')
def knn_index():
    return render_template('knn.html')

@knn_bp.route('/api/data')
def knn_data():
    """knn 分類 API - 使用鳶尾花資料集"""
    try:
        # 載入鳶尾花資料集
        iris = load_iris()    
        X = iris.data
        y = iris.target

        # 特徵名稱翻譯為繁體中文
        feature_names_zh = ["花萼長度", "花萼寬度", "花瓣長度", "花瓣寬度"]
        target_names_zh = ["山鳶尾", "變色鳶尾", "維吉尼亞鳶尾"]

        # 取得特徵索引（預設使用花瓣長度和花瓣寬度）
        feature_x = int(request.args.get('feature_x',2))
        feature_y = int(request.args.get('feature_y', 3))
        k_neighbors = int(request.args.get('k',5))


        #驗證參數
        if feature_x < 0 or feature_x >= X.shape[1]:
            feature_x = 2
        
        if feature_y < 0 or feature_y >= X.shape[1]:
            feature_y = 3

        if k_neighbors < 1 or k_neighbors > 20:
            k_neighbors = 5

        # 使用兩個特徵進行分類
        X_2d = X[:,[feature_x, feature_y]]

        # 分割訓練和測試資料
        X_train, X_test, y_train, y_test = train_test_split(X_2d, y, test_size=0.3, random_state=42)

        # 訓練 KNN 分類器
        knn = KNeighborsClassifier(n_neighbors=k_neighbors)
        knn.fit(X_train, y_train)

        # 預測
        y_pred = knn.predict(X_test)

        # 計算評估指標
        accuracy = accuracy_score(y_test, y_pred)
        conf_matric = confusion_matrix(y_test, y_pred)

        # 準備回應資料
        response = {
            "success":True,
            "feature_names": feature_names_zh,
            "target_names": target_names_zh,
            "current_features":{
                "x": feature_names_zh[feature_x],
                "y": feature_names_zh[feature_y],
                "x_idx": feature_x,
                "y_idx": feature_y
            },
            "k_neighbors": k_neighbors,
            "data":{
                "train":{
                    "x": X_train[:, 0].tolist(),
                    "y": X_train[:, 1].tolist(),
                    "labels": y_train.tolist()
                },
                "test":{
                    "x": X_test[:, 0].tolist(),
                    "y": X_test[:, 1].tolist(),
                    "labels": y_test.tolist(),
                    "predictions": y_pred.tolist()
                }
            },
            "metrics":{
                "accuracy": round(accuracy,4),
                "confusion_matric": conf_matric.tolist()
            },
            "description":{
                "dataset": "鳶尾花資料集",
                "samples": len(y),
                "train_size": len(y_train),
                "test_size": len(y_test),
                "classes": len(target_names_zh)
            }
        }
        

        return jsonify(response)
    except Exception as error:
        
        return jsonify({
            "success": False,
            "error": str(error)
        }), 500