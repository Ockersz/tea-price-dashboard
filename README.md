# Mid-Country BOPF Tea Price Dashboard

A one-screen, interactive dashboard for **week-ahead tea auction price monitoring**. It blends **market signals** (FX, Kenya/India BOPF), **IoT field conditions** (temperature, humidity, rainfall), and **lagged price features** to produce a point forecast with an uncertainty band. Designed for **fast decision-making** by estates, brokers, and analysts.

---

## ✨ Key Features

- **KPI Row (at-a-glance)**
  - **Forecast** (LKR/kg) with confidence text and sparkline
  - **Price Trend (4w)** with color-coded delta
  - **Market Volatility** (std dev of recent weeks)
  - **FX & Competitor Spread** (Sri Lanka vs Kenya/India)
- **Supply Pressure (IoT)**: a composite early-warning score (0–100) from temperature & humidity, with contextual chips for rain/Temp/Humidity.
- **Alerts**: human-readable signals like “High field temperature may tighten supply in 1–2 weeks.”
- **Main Chart**:
  - Left axis: **Sri Lanka (LKR/kg)** Actual & Forecast (with **confidence band**)
  - Right axis: **Kenya/India (USD/kg)** dotted reference lines
  - Tooltips show units appropriately (LKR vs USD)
- **What-if Sensitivity (modal)**: tweak FX, Kenya/India, Temp, Humidity, Rain and re-run forecast.
- **CSV Export** of the currently visualized series.
- **“Last Updated”** status chip.

---

## 🧱 Tech Stack

**Frontend**
- React + Vite/CRA (any React bundler)
- Material UI (MUI) for components
- Recharts for charts
- Axios for HTTP

**Backend API**
- Flask (Python)
- scikit-learn model pipeline (loaded via `joblib`)
- pandas for data prep
- CORS enabled

---

## 📦 Repository Structure (suggested)

```
.
├── api/
│   ├── app.py                    # Flask app (endpoints below)
│   ├── model_artifacts_mid_ipynb/
│   │   └── best_model_mid.pkl    # Trained model (expected path)
│   ├── weekly_model_table.csv    # Recent history table (data source)
│   └── requirements.txt
├── web/
│   ├── src/
│   │   ├── App.jsx
│   │   └── ForecastDashboard.jsx # The one-screen dashboard component
│   ├── package.json
│   └── vite.config.js / etc.
├── README.md
└── LICENSE
```

---

## ▶️ Quick Start

### 1) Backend (Flask)

```bash
cd api
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

By default the API runs at: `http://127.0.0.1:5000`

**Required files**
- `model_artifacts_mid_ipynb/best_model_mid.pkl` — trained scikit-learn pipeline
- `weekly_model_table.csv` — recent history with at least:
  - `auction_date_start` (datetime or ISO date)
  - `bopf_price_lkr_per_kg` (float)
  - `kenya_bopf_price_usd_w` (float)
  - `india_bopf_price_usd_w` (float)
  - `elevation` (string; “Mid/High/Low” or similar)

> The API normalizes elevation internally and filters to **Mid**.

### 2) Frontend (React)

```bash
cd web
npm install
npm run dev
```

Default dev URL: `http://localhost:5173` (Vite) or `http://localhost:3000` (CRA)

Make sure the frontend posts to `http://127.0.0.1:5000/forecast` (or update the base URL).

---

## 🔌 API Contract

### `POST /forecast`

**Request body** (JSON): features expected by the trained model (the API interrogates `model.feature_names_in_` if available). Typical keys:

```json
{
  "fx_lkr_per_usd_m": 300,
  "kenya_bopf_price_usd_w": 3.1,
  "india_bopf_price_usd_w": 2.8,
  "fob_rs_per_kg_wavg_m": 1250,
  "rain_mm_sum_w": 60,
  "temp_mean_c_w": 22,
  "humidity_mean_w": 82,
  "month": 9,
  "bopf_price_lkr_per_kg_lag1": 1220,
  "bopf_price_lkr_per_kg_lag4": 1190,
  "bopf_price_lkr_per_kg_lag8": 1180,
  "fx_lkr_per_usd_m_lag1": 298,
  "kenya_bopf_price_usd_w_lag1": 3.0,
  "india_bopf_price_usd_w_lag1": 2.7,
  "rain_4w_sum": 240,
  "price_ma4w": 1210
}
```

**Response**:

```json
{
  "history": [
    {
      "auction_date_start": "2025-07-14",
      "bopf_price_lkr_per_kg": 1188.25,
      "kenya_bopf_price_usd_w": 2.92,
      "india_bopf_price_usd_w": 2.65
    }
  ],
  "forecast": {
    "auction_date_start": "2025-10-06",
    "forecast_price_lkr": 1215.42,
    "confidence": "±30 LKR (estimated)",
    "ci_lower": 1185.42,
    "ci_upper": 1245.42
  }
}
```

- `history` includes **Kenya/India** so the frontend can draw dotted references.
- `ci_lower`/`ci_upper` power the chart’s **confidence band**.

### `GET /features`

Lists required model features, count, and an example payload.

---

## ⚙️ Environment / Config

- **CORS** is enabled in Flask (`CORS(app)`).
- If hosting separately, set the frontend base URL for the API via an env var or config:

```js
// web/src/config.js
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";
```

```bash
# web/.env
VITE_API_BASE_URL=http://127.0.0.1:5000
```

---

## 📈 Data & Assumptions

- Forecast target: **Sri Lanka BOPF (LKR/kg)**.
- Competitor series: **Kenya BOPF (USD/kg)**, **India BOPF (USD/kg)**.
- IoT inputs are used for **supply pressure** and can be included in features (temperature, humidity, rainfall).
- The market is **noisy**; R² may be low while **RMSE/MAE/MAPE remain operationally useful**.

---

## 🧪 Development Notes

- **Confidence band**: The API returns a simple ±CI. Replace with model-based intervals when available (e.g., quantile gradient boosting, bootstrap residuals, or conformal prediction).
- **Merging competitor data**: The API already includes Kenya/India in `history`. If you change it to separate arrays, remember to merge by date on the frontend.
- **What-if panel**: Recomputes the forecast with adjusted drivers without altering stored data.

---

## 🚀 Deployment

- **Backend**: run behind a reverse proxy (nginx) with Gunicorn or Uvicorn workers.
- **Frontend**: `npm run build` then serve `dist/` with nginx or a static host (S3/CloudFront, Vercel, Netlify).
- **Docker (optional)**: create `Dockerfile` for Flask & Nginx; or docker-compose for API + web.

---

## 🛠 Troubleshooting

- **Kenya/India lines not visible**: ensure `history` rows from API include `kenya_bopf_price_usd_w` and `india_bopf_price_usd_w`, and that the React chart uses them.
- **Confidence band not showing**: API must return `ci_lower` and `ci_upper`.
- **NaN in tooltips**: some rows may have null competitor values; the React tooltip already guards for nulls.
- **CORS errors**: ensure `CORS(app)` and that the frontend base URL matches the API URL.

---

## 🗺 Roadmap

- Model-based uncertainty (quantile GBM / conformal)
- Seasonality overlays (month/quarter bands)
- Download **PNG** for board-ready charts
- Toggle to convert competitor USD → LKR on the chart
- Multi-site IoT aggregation & alert thresholds by elevation band

---

**Questions?** Open an issue or ping the maintainer. Happy forecasting! 📊🍃