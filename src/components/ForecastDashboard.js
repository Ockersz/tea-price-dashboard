import React, { useState, useEffect } from "react";
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
} from "@mui/material";

const ForecastDashboard = () => {
  const [inputs, setInputs] = useState({
    fx_lkr_per_usd_m: 300,
    kenya_bopf_price_usd_w: 3.1,
    india_bopf_price_usd_w: 2.8,
    fob_rs_per_kg_wavg_m: 1250,
    rain_mm_sum_w: 60,
    temp_mean_c_w: 22,
    month: new Date().getMonth() + 1,
    bopf_price_lkr_per_kg_lag1: 1220,
    bopf_price_lkr_per_kg_lag4: 1190,
    bopf_price_lkr_per_kg_lag8: 1180,
  });

  const [forecast, setForecast] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [volatility, setVolatility] = useState(null);
  const [trendChange, setTrendChange] = useState(null);
  const [modalOpen, setModalOpen] = useState(null);

  // fetch live USD/LKR rate
  useEffect(() => {
    const fetchFx = async () => {
      try {
        const res = await axios.get(
          "https://api.exchangerate.host/latest?base=USD&symbols=LKR"
        );
        const fxRate = res.data.rates.LKR;
        setInputs((prev) => ({ ...prev, fx_lkr_per_usd_m: fxRate }));
      } catch (err) {
        console.error("Failed to fetch FX rate:", err);
      }
    };
    fetchFx();
  }, []);

  // whenever FX rate changes, auto-run forecast
  useEffect(() => {
    if (inputs.fx_lkr_per_usd_m) {
      getForecast();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.fx_lkr_per_usd_m]);

  const handleChange = (e) => {
    setInputs({ ...inputs, [e.target.name]: parseFloat(e.target.value) });
  };

  const getForecast = async () => {
    try {
      const res = await axios.post("http://127.0.0.1:5000/forecast", inputs, {
        headers: { "Content-Type": "application/json" },
      });

      const { history, forecast } = res.data;
      setForecast(forecast);

      // Chart dataset
      const mergedData = history.map((d) => ({
        date: d.auction_date_start,
        actual: d.bopf_price_lkr_per_kg,
      }));
      mergedData.push({
        date: forecast.auction_date_start,
        predicted: forecast.forecast_price_lkr,
      });

      setChartData(mergedData);

      // Compute volatility (std dev of last 4 weeks)
      const prices = history.slice(-4).map((d) => d.bopf_price_lkr_per_kg);
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      const variance =
        prices.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / prices.length;
      setVolatility(Math.sqrt(variance));

      // Trend change (last price vs 4 weeks ago)
      if (history.length > 4) {
        const change =
          ((history[history.length - 1].bopf_price_lkr_per_kg -
            history[history.length - 4].bopf_price_lkr_per_kg) /
            history[history.length - 4].bopf_price_lkr_per_kg) *
          100;
        setTrendChange(change);
      }
    } catch (err) {
      console.error("Forecast request failed:", err);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        📊 Mid-Country BOPF Tea Price Dashboard
      </Typography>

      {/* KPI Cards */}
      <Grid container spacing={3}>
        {/* Forecast */}
        <Grid item xs={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Forecast</Typography>
              {forecast ? (
                <>
                  <Typography variant="h4" color="primary">
                    {forecast.forecast_price_lkr.toFixed(2)} LKR/kg
                  </Typography>
                  <Typography variant="body2">
                    Confidence: {forecast.confidence}
                  </Typography>
                  <Button onClick={() => setModalOpen("forecast")}>
                    View Details
                  </Button>
                </>
              ) : (
                <Typography>Loading…</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Trend */}
        <Grid item xs={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Price Trend (4w)</Typography>
              <Typography
                variant="h4"
                color={trendChange >= 0 ? "green" : "red"}
              >
                {trendChange ? trendChange.toFixed(1) + "%" : "—"}
              </Typography>
              <Typography variant="body2">vs last month</Typography>
              <Button onClick={() => setModalOpen("trend")}>
                View Details
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Volatility */}
        <Grid item xs={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Market Volatility</Typography>
              <Typography variant="h4">
                {volatility ? volatility.toFixed(2) : "—"}
              </Typography>
              <Typography variant="body2">Std Dev (4w)</Typography>
              <Button onClick={() => setModalOpen("volatility")}>
                View Details
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* FX */}
        <Grid item xs={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">FX (USD/LKR)</Typography>
              <Typography variant="h4">{inputs.fx_lkr_per_usd_m}</Typography>
              <Typography variant="body2">Live rate</Typography>
              <Button onClick={() => setModalOpen("fx")}>View Details</Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Chart */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📉 Price Chart
              </Typography>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="#82ca9d"
                      name="Actual"
                    />
                    <Line
                      type="monotone"
                      dataKey="predicted"
                      stroke="#ff0000"
                      strokeDasharray="5 5"
                      name="Forecast"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Typography>Loading chart…</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Insights */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6">📌 Market Insights</Typography>
          <Typography variant="body2">
            Sri Lanka prices changed {trendChange?.toFixed(2)}% over the last
            month. Current volatility is {volatility?.toFixed(2)} LKR/kg,
            indicating {volatility > 40 ? "high" : "moderate"} market movement.
            The LKR currently trades at {inputs.fx_lkr_per_usd_m} per USD,
            putting additional pressure on auction pricing.
          </Typography>
        </CardContent>
      </Card>

      {/* Detail Modals */}
      <Dialog
        open={modalOpen === "forecast"}
        onClose={() => setModalOpen(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Forecast Details</DialogTitle>
        <DialogContent>
          <Typography>
            Forecast for {forecast?.auction_date_start}:{" "}
            {forecast?.forecast_price_lkr} LKR/kg
          </Typography>
          <Typography>Confidence Level: {forecast?.confidence}</Typography>
        </DialogContent>
      </Dialog>

      <Dialog
        open={modalOpen === "trend"}
        onClose={() => setModalOpen(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Price Trend Details</DialogTitle>
        <DialogContent>
          <Typography>
            Compared to 4 weeks ago, prices changed by {trendChange?.toFixed(2)}%
          </Typography>
        </DialogContent>
      </Dialog>

      <Dialog
        open={modalOpen === "volatility"}
        onClose={() => setModalOpen(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Volatility Details</DialogTitle>
        <DialogContent>
          <Typography>
            Standard deviation of the last 4 weeks of prices is{" "}
            {volatility?.toFixed(2)} LKR/kg. This represents{" "}
            {volatility > 40 ? "high volatility" : "moderate stability"}.
          </Typography>
        </DialogContent>
      </Dialog>

      <Dialog
        open={modalOpen === "fx"}
        onClose={() => setModalOpen(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>FX Rate Details</DialogTitle>
        <DialogContent>
          <Typography>
            Current USD/LKR rate: {inputs.fx_lkr_per_usd_m}
          </Typography>
          <TextField
            label="Adjust FX manually"
            type="number"
            name="fx_lkr_per_usd_m"
            value={inputs.fx_lkr_per_usd_m}
            onChange={handleChange}
            fullWidth
            margin="normal"
          />
          <Button variant="contained" onClick={getForecast}>
            Recalculate Forecast
          </Button>
        </DialogContent>
      </Dialog>
    </Container>
  );
};

export default ForecastDashboard;
