import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
} from "recharts";
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Stack,
  Chip,
  Divider,
  Alert,
  LinearProgress,
  IconButton,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import TuneIcon from "@mui/icons-material/Tune";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

const currency = (v) => (v == null ? "—" : `${v.toFixed(2)} LKR/kg`);
const pct = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);
const num = (v, d = 2) => (v == null ? "—" : v.toFixed(d));
const kyc = (v) => (v == null ? "—" : `$${v.toFixed(2)} USD/kg`);
const classByDelta = (d) => (d >= 0 ? "success.main" : "error.main");

function Sparkline({ data = [], dataKey = "v", stroke = "#8884d8" }) {
  // minimal sparkline
  return (
    <Box sx={{ height: 30 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={stroke}
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}

export default function ForecastDashboard() {
  const [inputs, setInputs] = useState({
    fx_lkr_per_usd_m: 300,
    kenya_bopf_price_usd_w: 3.1,
    india_bopf_price_usd_w: 2.8,
    fob_rs_per_kg_wavg_m: 1250,
    rain_mm_sum_w: 60,
    temp_mean_c_w: 22,
    humidity_mean_w: 82,
    month: new Date().getMonth() + 1,
    bopf_price_lkr_per_kg_lag1: 1220,
    bopf_price_lkr_per_kg_lag4: 1190,
    bopf_price_lkr_per_kg_lag8: 1180,
    fx_lkr_per_usd_m_lag1: 298,
    kenya_bopf_price_usd_w_lag1: 3.0,
    india_bopf_price_usd_w_lag1: 2.7,
    rain_4w_sum: 240,
    price_ma4w: 1210,
  });

  const [loading, setLoading] = useState(false);
  const [forecast, setForecast] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [kenyaHistory, setKenyaHistory] = useState([]);
  const [indiaHistory, setIndiaHistory] = useState([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const fetchFx = async () => {
      try {
        const res = await axios.get(
          "https://api.exchangerate.host/latest?base=USD&symbols=LKR"
        );
        const fxRate = res?.data?.rates?.LKR;
        if (fxRate)
          setInputs((p) => ({ ...p, fx_lkr_per_usd_m: Math.round(fxRate) }));
      } catch {
        /* ignore */
      }
    };
    fetchFx();
  }, []);

  useEffect(() => {
    if (inputs.fx_lkr_per_usd_m) getForecast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.fx_lkr_per_usd_m]);

  const handleNum = (e) =>
    setInputs((p) => ({ ...p, [e.target.name]: parseFloat(e.target.value) }));

  async function getForecast(override = null) {
    setLoading(true);
    setError("");
    try {
      const body = override ? { ...inputs, ...override } : inputs;
      const res = await axios.post("http://127.0.0.1:5000/forecast", body, {
        headers: { "Content-Type": "application/json" },
      });
      const {
        history = [],
        forecast,
        kenya_history = [],
        india_history = [],
      } = res.data || {};
      setForecast(forecast || null);
      setKenyaHistory(kenya_history || []);
      setIndiaHistory(india_history || []);

      // Build merged series: actuals + forecast + (optional CI) + competitor refs
      const merged = [
        ...history.map((d) => ({
          date: d.auction_date_start,
          actual: d.bopf_price_lkr_per_kg, // LKR/kg
          kenya: d.kenya_bopf_price_usd_w ?? null, // USD/kg
          india: d.india_bopf_price_usd_w ?? null, // USD/kg
        })),
      ];

      if (forecast) {
        merged.push({
          date: forecast.auction_date_start,
          predicted: forecast.forecast_price_lkr,
          lower: forecast?.ci_lower ?? null,
          upper: forecast?.ci_upper ?? null,
          kenya: null,
          india: null,
        });
      }
      setChartData(merged);
      setLastUpdated(new Date().toISOString());
    } catch (e) {
      console.error(e);
      setError("Forecast request failed. Please check the API or your inputs.");
    } finally {
      setLoading(false);
    }
  }

  const last4 = useMemo(
    () =>
      chartData
        .slice(-5, -1)
        .map((d) => d.actual)
        .filter(Boolean),
    [chartData]
  );
  const lastPrice = useMemo(
    () =>
      chartData
        .map((d) => d.actual)
        .filter(Boolean)
        .slice(-1)[0] ?? null,
    [chartData]
  );
  const price4wAgo = useMemo(
    () =>
      chartData
        .map((d) => d.actual)
        .filter(Boolean)
        .slice(-5, -4)[0] ?? null,
    [chartData]
  );

  const trendChange = useMemo(() => {
    if (!lastPrice || !price4wAgo) return null;
    return ((lastPrice - price4wAgo) / price4wAgo) * 100;
  }, [lastPrice, price4wAgo]);

  const volatility = useMemo(() => {
    if (last4.length < 2) return null;
    const avg = last4.reduce((a, b) => a + b, 0) / last4.length;
    const varc =
      last4.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / last4.length;
    return Math.sqrt(varc);
  }, [last4]);

  const compSpread = useMemo(() => {
    if (!lastPrice) return null;
    const kUsd = kenyaHistory.length
      ? kenyaHistory.slice(-1)[0]?.kenya_bopf_price_usd_w ??
        kenyaHistory.slice(-1)[0]?.price
      : null;
    const iUsd = indiaHistory.length
      ? indiaHistory.slice(-1)[0]?.india_bopf_price_usd_w ??
        indiaHistory.slice(-1)[0]?.price
      : null;
    const kInLkr = kUsd ? kUsd * (inputs.fx_lkr_per_usd_m || 300) : null;
    const iInLkr = iUsd ? iUsd * (inputs.fx_lkr_per_usd_m || 300) : null;
    return {
      vsKenya: kInLkr ? lastPrice - kInLkr : null,
      vsIndia: iInLkr ? lastPrice - iInLkr : null,
    };
  }, [lastPrice, kenyaHistory, indiaHistory, inputs.fx_lkr_per_usd_m]);

  const iotPressure = useMemo(() => {
    const t = inputs.temp_mean_c_w ?? 22;
    const h = inputs.humidity_mean_w ?? 82;
    const normT = Math.min(1, Math.max(0, (t - 18) / 10)); // 18–28C
    const normH = Math.min(1, Math.max(0, (85 - h) / 20));
    return Math.round((0.6 * normT + 0.4 * normH) * 100);
  }, [inputs.temp_mean_c_w, inputs.humidity_mean_w]);

  const alerts = useMemo(() => {
    const a = [];
    if ((inputs.temp_mean_c_w ?? 0) >= 27)
      a.push("High field temperature may tighten supply in 1–2 weeks.");
    if ((inputs.humidity_mean_w ?? 100) <= 70)
      a.push("Low humidity suggests dry-stress risk next week.");
    if ((inputs.rain_mm_sum_w ?? 0) >= 120)
      a.push(
        "Heavy rainfall may elevate logistics risk and quality variability."
      );
    if (!a.length) a.push("No critical field alerts this week.");
    return a;
  }, [inputs]);

  const downloadCSV = () => {
    const rows = [
      [
        "date",
        "actual",
        "predicted",
        "lower",
        "upper",
        "kenya_usd",
        "india_usd",
      ],
    ];
    chartData.forEach((d) =>
      rows.push([
        d.date,
        d.actual ?? "",
        d.predicted ?? "",
        d.lower ?? "",
        d.upper ?? "",
        d.kenya ?? "",
        d.india ?? "",
      ])
    );
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bopf_dashboard_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Typography variant="h4">
          Mid-Country BOPF Tea Price Dashboard
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            icon={<InfoOutlinedIcon />}
            label={
              lastUpdated
                ? `Updated ${new Date(lastUpdated).toLocaleString()}`
                : "Waiting for data…"
            }
          />
          <Button startIcon={<DownloadIcon />} onClick={downloadCSV}>
            Export CSV
          </Button>
        </Stack>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* KPI ROW */}
      <Grid container spacing={2}>
        {/* FORECAST */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="h6">Forecast</Typography>
                <IconButton size="small" onClick={() => setModal("forecast")}>
                  <InfoOutlinedIcon />
                </IconButton>
              </Stack>
              <Typography variant="h3" color="primary">
                {forecast ? currency(forecast.forecast_price_lkr) : "—"}
              </Typography>
              <Typography variant="body2">
                Confidence: {forecast?.confidence ?? "—"}
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Sparkline
                  data={chartData.slice(-12).map((d) => ({ v: d.actual }))}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* TREND */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="h6">Price Trend (4w)</Typography>
                <IconButton size="small" onClick={() => setModal("trend")}>
                  <InfoOutlinedIcon />
                </IconButton>
              </Stack>
              <Typography
                variant="h3"
                sx={{ color: classByDelta(trendChange ?? 0) }}
              >
                {pct(trendChange)}
              </Typography>
              <Typography variant="body2">vs. 4 weeks ago</Typography>
              <Box sx={{ mt: 1 }}>
                <Sparkline
                  data={chartData.slice(-12).map((d) => ({ v: d.actual }))}
                  stroke={trendChange >= 0 ? "#2e7d32" : "#c62828"}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* VOLATILITY */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="h6">Market Volatility</Typography>
                <IconButton size="small" onClick={() => setModal("vol")}>
                  <InfoOutlinedIcon />
                </IconButton>
              </Stack>
              <Typography variant="h3">{num(volatility)}</Typography>
              <Typography variant="body2">Std Dev (last 4 actuals)</Typography>
              <Box sx={{ mt: 1 }}>
                <Sparkline
                  data={chartData.slice(-12).map((d, i, arr) => {
                    if (i === 0) return { v: 0 };
                    const prev = arr[i - 1]?.v ?? d.actual;
                    return { v: Math.abs((d.actual ?? prev) - prev) };
                  })}
                  stroke="#6d4c41"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* FX + COMP SPREAD */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="h6">FX & Spread</Typography>
                <IconButton size="small" onClick={() => setModal("comp")}>
                  <InfoOutlinedIcon />
                </IconButton>
              </Stack>
              <Typography variant="h4">
                {inputs.fx_lkr_per_usd_m} LKR/USD
              </Typography>
              <Typography variant="body2">
                Spread vs 🇰🇪:{" "}
                {compSpread?.vsKenya == null
                  ? "—"
                  : currency(compSpread.vsKenya)}
              </Typography>
              <Typography variant="body2">
                Spread vs 🇮🇳:{" "}
                {compSpread?.vsIndia == null
                  ? "—"
                  : currency(compSpread.vsIndia)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* SECOND ROW: IoT + ALERTS */}
      <Grid container spacing={2} sx={{ mt: 1 }}>
        {/* IoT Supply Pressure */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography variant="h6">Supply Pressure (IoT)</Typography>
                <IconButton size="small" onClick={() => setModal("iot")}>
                  <InfoOutlinedIcon />
                </IconButton>
              </Stack>
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography
                  variant="h3"
                  sx={{
                    color:
                      iotPressure >= 66
                        ? "error.main"
                        : iotPressure >= 33
                        ? "warning.main"
                        : "success.main",
                  }}
                >
                  {iotPressure}
                </Typography>
                <Typography variant="body2">
                  Composite from temperature & humidity (higher = tighter supply
                  risk in 1–2 weeks).
                </Typography>
              </Stack>
              <Divider sx={{ my: 1 }} />
              <Stack direction="row" spacing={2}>
                <Chip label={`Temp ${inputs.temp_mean_c_w}°C`} />
                <Chip label={`Humidity ${inputs.humidity_mean_w}%`} />
                <Chip label={`Rain ${inputs.rain_mm_sum_w} mm`} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Alerts */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography variant="h6">Alerts</Typography>
                <WarningAmberIcon color="warning" />
              </Stack>
              <Stack spacing={1} sx={{ mt: 1 }}>
                {alerts.map((msg, i) => (
                  <Alert
                    key={i}
                    severity={msg.startsWith("No ") ? "success" : "warning"}
                  >
                    {msg}
                  </Alert>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* MAIN CHART */}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">
              Price (Actual vs Forecast) + Competitor References
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Left axis: Sri Lanka (LKR/kg). Right axis: Kenya & India (USD/kg).
              Dotted = reference.
            </Typography>
          </Stack>
          <Box sx={{ height: 420 }}>
            {chartData?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  {/* Left axis for Sri Lanka LKR/kg */}
                  <YAxis yAxisId="left" />
                  {/* Right axis for Kenya/India USD/kg */}
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip
                    formatter={(v, name) => {
                      if (name === "Actual" || name === "Forecast")
                        return [`${Number(v).toFixed(2)} LKR/kg`, name];
                      if (name.includes("Kenya") || name.includes("India"))
                        return [`$${Number(v).toFixed(2)} USD/kg`, name];
                      return [v, name];
                    }}
                  />
                  <Legend />

                  {/* Confidence band (if provided) */}
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="upper"
                    stroke="transparent"
                    fill="rgba(255,0,0,0.12)"
                    dot={false}
                    activeDot={false}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="lower"
                    stroke="transparent"
                    fill="rgba(255,0,0,0.12)"
                    dot={false}
                    activeDot={false}
                  />

                  {/* Sri Lanka lines */}
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="actual"
                    stroke="#2e7d32"
                    name="Actual"
                    dot={false}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="predicted"
                    stroke="#d32f2f"
                    strokeDasharray="6 6"
                    name="Forecast"
                    dot
                  />

                  {/* NEW: Kenya & India dotted reference lines on RIGHT axis */}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="kenya"
                    stroke="#ef6c00"
                    strokeDasharray="3 6"
                    name="Kenya (USD/kg)"
                    dot={false}
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="india"
                    stroke="#1976d2"
                    strokeDasharray="3 6"
                    name="India (USD/kg)"
                    dot={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Typography color="text.secondary">Waiting for data…</Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* INSIGHTS */}
      <Card sx={{ mt: 2, mb: 4 }}>
        <CardContent>
          <Typography variant="h6">📌 Market Insights</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Over the last month, Sri Lanka auction prices changed{" "}
            {pct(trendChange)} and weekly volatility is {num(volatility)}{" "}
            LKR/kg. The rupee currently trades at {inputs.fx_lkr_per_usd_m} per
            USD. Supply pressure from field conditions is scored {iotPressure}
            /100, suggesting{" "}
            {iotPressure >= 66
              ? "elevated"
              : iotPressure >= 33
              ? "moderate"
              : "low"}{" "}
            risk of short-term tightening. Competitive spreads vs Kenya (
            {compSpread?.vsKenya == null ? "n/a" : currency(compSpread.vsKenya)}
            ) and India (
            {compSpread?.vsIndia == null ? "n/a" : currency(compSpread.vsIndia)}
            ) contextualize regional pricing.
          </Typography>
        </CardContent>
      </Card>

      {/* MODALS */}
      <Dialog
        open={modal === "forecast"}
        onClose={() => setModal(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Forecast Details</DialogTitle>
        <DialogContent dividers>
          <Typography>
            Forecast Date: {forecast?.auction_date_start ?? "—"}
          </Typography>
          <Typography>
            Point Forecast:{" "}
            {forecast ? currency(forecast.forecast_price_lkr) : "—"}
          </Typography>
          <Typography>Confidence: {forecast?.confidence ?? "—"}</Typography>
          <Typography sx={{ mt: 1 }}>
            Inputs driving forecast are shown in the What-if panel. Adjust and
            recalc to test sensitivity.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModal("whatif")}>Open What-if</Button>
          <Button onClick={() => setModal(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={modal === "trend"}
        onClose={() => setModal(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Price Trend (4 weeks)</DialogTitle>
        <DialogContent dividers>
          <Typography>
            Change vs 4 weeks ago:{" "}
            <strong style={{ color: trendChange >= 0 ? "#2e7d32" : "#c62828" }}>
              {pct(trendChange)}
            </strong>
          </Typography>
          <Typography sx={{ mt: 1 }}>Recent actuals:</Typography>
          <Stack sx={{ mt: 1 }}>
            {chartData.slice(-5, -1).map((d, i) => (
              <Typography key={i}>
                {d.date}: {currency(d.actual ?? 0)}
              </Typography>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModal(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={modal === "vol"}
        onClose={() => setModal(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Volatility Details</DialogTitle>
        <DialogContent dividers>
          <Typography>
            Std Dev (last 4 weeks): <strong>{num(volatility)}</strong> LKR/kg
          </Typography>
          <Typography sx={{ mt: 1 }}>
            Interpretation:{" "}
            {volatility == null
              ? "—"
              : volatility > 40
              ? "High intra-month movement; hedge and stagger sales."
              : "Moderate; baseline risk."}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModal(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={modal === "comp"}
        onClose={() => setModal(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>FX & Competitor Spread</DialogTitle>
        <DialogContent dividers>
          <Typography>
            FX (USD/LKR): <strong>{inputs.fx_lkr_per_usd_m}</strong>
          </Typography>
          <Divider sx={{ my: 1 }} />
          <Typography>
            Last Kenya:{" "}
            {kenyaHistory.length
              ? kyc(
                  kenyaHistory.slice(-1)[0]?.kenya_bopf_price_usd_w ??
                    kenyaHistory.slice(-1)[0]?.price
                )
              : "—"}
          </Typography>
          <Typography>
            Last India:{" "}
            {indiaHistory.length
              ? kyc(
                  indiaHistory.slice(-1)[0]?.india_bopf_price_usd_w ??
                    indiaHistory.slice(-1)[0]?.price
                )
              : "—"}
          </Typography>
          <Typography sx={{ mt: 1 }}>
            Spread vs 🇰🇪:{" "}
            {compSpread?.vsKenya == null ? "—" : currency(compSpread.vsKenya)}
          </Typography>
          <Typography>
            Spread vs 🇮🇳:{" "}
            {compSpread?.vsIndia == null ? "—" : currency(compSpread.vsIndia)}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModal(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={modal === "iot"}
        onClose={() => setModal(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>IoT Supply Pressure Details</DialogTitle>
        <DialogContent dividers>
          <Typography>
            Composite score (0–100): <strong>{iotPressure}</strong>
          </Typography>
          <Divider sx={{ my: 1 }} />
          <Stack spacing={2}>
            <TextField
              label="Temperature (°C)"
              type="number"
              name="temp_mean_c_w"
              value={inputs.temp_mean_c_w}
              onChange={handleNum}
            />
            <TextField
              label="Humidity (%)"
              type="number"
              name="humidity_mean_w"
              value={inputs.humidity_mean_w}
              onChange={handleNum}
            />
            <TextField
              label="Weekly Rain (mm)"
              type="number"
              name="rain_mm_sum_w"
              value={inputs.rain_mm_sum_w}
              onChange={handleNum}
            />
          </Stack>
          <Typography sx={{ mt: 1 }} variant="body2">
            Adjust and use What-if to see the forecast response.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModal(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* WHAT IF PANEL */}
      <Dialog
        open={modal === "whatif"}
        onClose={() => setModal(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>What-if Sensitivity</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="FX (LKR/USD)"
                type="number"
                name="fx_lkr_per_usd_m"
                value={inputs.fx_lkr_per_usd_m}
                onChange={handleNum}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Kenya USD/kg"
                type="number"
                name="kenya_bopf_price_usd_w"
                value={inputs.kenya_bopf_price_usd_w}
                onChange={handleNum}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="India USD/kg"
                type="number"
                name="india_bopf_price_usd_w"
                value={inputs.india_bopf_price_usd_w}
                onChange={handleNum}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Temperature (°C)"
                type="number"
                name="temp_mean_c_w"
                value={inputs.temp_mean_c_w}
                onChange={handleNum}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Humidity (%)"
                type="number"
                name="humidity_mean_w"
                value={inputs.humidity_mean_w}
                onChange={handleNum}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Rain (mm)"
                type="number"
                name="rain_mm_sum_w"
                value={inputs.rain_mm_sum_w}
                onChange={handleNum}
              />
            </Grid>
          </Grid>
          <Alert icon={<InfoOutlinedIcon />} severity="info" sx={{ mt: 2 }}>
            Adjust drivers and click <strong>Run What-if</strong> to recompute
            the forecast with your scenario. Your original data is untouched.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => getForecast()} color="inherit">
            Reset
          </Button>
          <Button variant="contained" onClick={() => getForecast()}>
            Run What-if
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
