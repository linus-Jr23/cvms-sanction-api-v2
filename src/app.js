const express = require("express");
const cors = require("cors");

const violationRoutes = require("./routes/violations.routes");
const sanctionRoutes = require("./routes/sanctions.routes");//sanction routes

const app = express();

// Allow Railway health check hostname
app.use(cors({
  origin: ['healthcheck.railway.app', '*'],
  credentials: true
}));
app.use(express.json());

app.use("/api/violations", violationRoutes);
app.use("/api/sanctions", sanctionRoutes);//sanction routes


// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = app;
