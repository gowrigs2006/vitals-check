"""
Trains a health-risk classifier on synthetic patient data and saves it to
model.joblib. In a real project you'd swap this synthetic generator for a
real dataset (e.g. a Kaggle cardiovascular disease dataset) — the rest of
the pipeline (features, API, frontend contract) stays the same.

Run: python3 train_model.py
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score
import joblib

RNG = np.random.default_rng(42)
N = 6000

def generate_dataset(n=N):
    age = RNG.integers(18, 85, n)
    gender = RNG.choice(["Male", "Female", "Other"], n, p=[0.48, 0.48, 0.04])
    height_cm = RNG.normal(168, 9, n).clip(140, 205)
    weight_kg = RNG.normal(72, 15, n).clip(40, 160)
    bmi = weight_kg / (height_cm / 100) ** 2
    systolic = RNG.normal(122, 15, n).clip(90, 200)
    diastolic = RNG.normal(78, 10, n).clip(55, 130)
    cholesterol = RNG.normal(195, 35, n).clip(120, 350)
    smoker = RNG.choice(["Yes", "No"], n, p=[0.22, 0.78])
    exercise_days = RNG.integers(0, 8, n)
    family_history = RNG.choice(["Yes", "No"], n, p=[0.3, 0.7])

    df = pd.DataFrame({
        "age": age, "gender": gender, "heightCm": height_cm, "weightKg": weight_kg,
        "bmi": bmi, "systolic": systolic, "diastolic": diastolic,
        "cholesterol": cholesterol, "smoker": smoker,
        "exerciseDays": exercise_days, "familyHistory": family_history,
    })

    # Latent risk score drives the label — mirrors real clinical risk factors,
    # with noise so the model has to learn a genuine boundary, not a formula.
    z = (
        0.045 * (age - 40)
        + 0.14 * (bmi - 24)
        + 0.035 * (systolic - 120)
        + 0.02 * (cholesterol - 190)
        + 1.3 * (smoker == "Yes")
        - 0.22 * (exercise_days - 3)
        + 0.9 * (family_history == "Yes")
        + RNG.normal(0, 1.0, n)
    )
    prob = 1 / (1 + np.exp(-z))
    label = (RNG.random(n) < prob).astype(int)
    df["target"] = label
    return df

def build_features(df):
    out = df.copy()
    out["gender_Male"] = (out["gender"] == "Male").astype(int)
    out["gender_Other"] = (out["gender"] == "Other").astype(int)
    out["smoker_Yes"] = (out["smoker"] == "Yes").astype(int)
    out["familyHistory_Yes"] = (out["familyHistory"] == "Yes").astype(int)
    feature_cols = [
        "age", "bmi", "systolic", "diastolic", "cholesterol", "exerciseDays",
        "gender_Male", "gender_Other", "smoker_Yes", "familyHistory_Yes",
    ]
    return out[feature_cols], feature_cols

if __name__ == "__main__":
    df = generate_dataset()
    X, feature_cols = build_features(df)
    y = df["target"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    model = RandomForestClassifier(
        n_estimators=300, max_depth=6, min_samples_leaf=15, random_state=42
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    probs = model.predict_proba(X_test)[:, 1]
    acc = accuracy_score(y_test, preds)
    auc = roc_auc_score(y_test, probs)
    print(f"Accuracy: {acc:.3f}")
    print(f"ROC AUC:  {auc:.3f}")
    print("Feature importances:")
    for name, imp in sorted(zip(feature_cols, model.feature_importances_), key=lambda x: -x[1]):
        print(f"  {name:20s} {imp:.3f}")

    joblib.dump({"model": model, "feature_cols": feature_cols}, "model.joblib")
    print("\nSaved model.joblib")
