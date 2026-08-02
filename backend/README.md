# Vitals Check — Backend API

Flask REST API that powers the Vitals Check frontend's risk predictions.
Uses a scikit-learn RandomForestClassifier trained on synthetic clinical
data (swap `train_model.py`'s data source for a real dataset if you want
to train on actual records).

## Run locally

```bash
pip install -r requirements.txt
python3 train_model.py     # trains and saves model.joblib (run once)
python3 app.py              # starts the API on http://localhost:5000
```

## Endpoints

- `GET /api/health` — liveness check
- `POST /api/predict` — body:
  ```json
  {
    "age": 45, "gender": "Female", "heightCm": 160, "weightKg": 70,
    "systolic": 130, "diastolic": 84, "cholesterol": 210,
    "smoker": "No", "exerciseDays": 3, "familyHistory": "No"
  }
  ```
  returns:
  ```json
  { "risk": 79, "factors": [["Age", "mid"], ["BMI", "mid"], ...] }
  ```

## Deploy on EC2

1. Launch a `t2.micro` EC2 instance, SSH in
2. `git clone` this project (or upload it), then:
   ```bash
   sudo apt update && sudo apt install python3-pip -y
   pip3 install -r requirements.txt --break-system-packages
   python3 train_model.py
   ```
3. Run with gunicorn instead of the dev server:
   ```bash
   gunicorn --bind 0.0.0.0:8000 app:app
   ```
4. Put Nginx in front to proxy port 80 → 8000, or open port 8000 in the
   EC2 security group directly for a quick test.
5. Set the frontend's `VITE_API_URL` to `http://<ec2-public-ip>/api/predict`
   (or `:8000/api/predict` if not using Nginx) and rebuild it.

## Optional: log predictions to RDS

Set a `DATABASE_URL` environment variable (e.g.
`postgresql://user:pass@your-rds-endpoint:5432/vitals`) before starting
the app, and it will create a `predictions` table and log every request.
Leave it unset to run with no database at all.
