"""
Flask REST API for the Vitals Check health-risk frontend.

Endpoints:
  GET  /api/health   -> liveness check
  POST /api/predict  -> { risk: 0-100, factors: [[name, "low"|"mid"|"high"], ...] }

Run locally:
  python3 train_model.py   # once, to create model.joblib
  python3 app.py

Deploy on EC2 with gunicorn:
  gunicorn --bind 0.0.0.0:8000 app:app
"""
import os
import joblib
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # allow the React frontend (different origin) to call this API

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.joblib")
_artifact = joblib.load(MODEL_PATH)
MODEL = _artifact["model"]
FEATURE_COLS = _artifact["feature_cols"]

# Optional: log each prediction to a database if DATABASE_URL is configured
# (e.g. an RDS instance). Skipped entirely if not set, so local dev needs
# no database at all.
DATABASE_URL = os.environ.get("DATABASE_URL")
db_engine = None
if DATABASE_URL:
    from sqlalchemy import create_engine, text
    db_engine = create_engine(DATABASE_URL)
    with db_engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS predictions (
                id SERIAL PRIMARY KEY,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                age INTEGER, bmi FLOAT, systolic INTEGER, diastolic INTEGER,
                cholesterol INTEGER, smoker VARCHAR(3), exercise_days INTEGER,
                family_history VARCHAR(3), risk INTEGER
            )
        """))

REQUIRED_FIELDS = [
    "age", "gender", "heightCm", "weightKg", "systolic",
    "diastolic", "cholesterol", "smoker", "exerciseDays", "familyHistory",
]


def parse_input(data):
    missing = [f for f in REQUIRED_FIELDS if f not in data or data[f] in ("", None)]
    if missing:
        raise ValueError(f"Missing fields: {', '.join(missing)}")

    try:
        age = float(data["age"])
        height_cm = float(data["heightCm"])
        weight_kg = float(data["weightKg"])
        systolic = float(data["systolic"])
        diastolic = float(data["diastolic"])
        cholesterol = float(data["cholesterol"])
        exercise_days = float(data["exerciseDays"])
    except (TypeError, ValueError):
        raise ValueError("Numeric fields must be valid numbers")

    gender = str(data["gender"])
    smoker = str(data["smoker"])
    family_history = str(data["familyHistory"])

    if height_cm <= 0:
        raise ValueError("heightCm must be greater than 0")

    bmi = weight_kg / ((height_cm / 100) ** 2)

    return {
        "age": age, "gender": gender, "bmi": bmi,
        "systolic": systolic, "diastolic": diastolic, "cholesterol": cholesterol,
        "smoker": smoker, "exerciseDays": exercise_days, "familyHistory": family_history,
    }


def build_feature_vector(v):
    row = {
        "age": v["age"], "bmi": v["bmi"], "systolic": v["systolic"],
        "diastolic": v["diastolic"], "cholesterol": v["cholesterol"],
        "exerciseDays": v["exerciseDays"],
        "gender_Male": 1 if v["gender"] == "Male" else 0,
        "gender_Other": 1 if v["gender"] == "Other" else 0,
        "smoker_Yes": 1 if v["smoker"] == "Yes" else 0,
        "familyHistory_Yes": 1 if v["familyHistory"] == "Yes" else 0,
    }
    return pd.DataFrame([[row[c] for c in FEATURE_COLS]], columns=FEATURE_COLS)


def tone(value, mid_cut, high_cut):
    if value >= high_cut:
        return "high"
    if value >= mid_cut:
        return "mid"
    return "low"


def compute_factors(v):
    factors = [
        ("Age", tone(v["age"], 40, 55)),
        ("BMI", tone(v["bmi"], 25, 30)),
        ("Blood pressure", tone(v["systolic"], 120, 140)),
        ("Cholesterol", tone(v["cholesterol"], 200, 240)),
        ("Smoking", "high" if v["smoker"] == "Yes" else "low"),
        ("Activity level", "mid" if v["exerciseDays"] < 2 else "low"),
        ("Family history", "mid" if v["familyHistory"] == "Yes" else "low"),
    ]
    return [[name, t] for name, t in factors]


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    try:
        v = parse_input(data)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    features = build_feature_vector(v)
    prob = MODEL.predict_proba(features)[0][1]
    risk = int(round(prob * 100))
    factors = compute_factors(v)

    if db_engine is not None:
        from sqlalchemy import text
        with db_engine.begin() as conn:
            conn.execute(
                text("""
                    INSERT INTO predictions
                    (age, bmi, systolic, diastolic, cholesterol, smoker, exercise_days, family_history, risk)
                    VALUES (:age, :bmi, :systolic, :diastolic, :cholesterol, :smoker, :exercise_days, :family_history, :risk)
                """),
                {
                    "age": v["age"], "bmi": v["bmi"], "systolic": v["systolic"],
                    "diastolic": v["diastolic"], "cholesterol": v["cholesterol"],
                    "smoker": v["smoker"], "exercise_days": v["exerciseDays"],
                    "family_history": v["familyHistory"], "risk": risk,
                },
            )

    return jsonify({"risk": risk, "factors": factors})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
