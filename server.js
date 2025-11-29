const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./config/db");

// Route’ları import et
const authRoutes = require("./routes/auth");
const taskRoutes = require("./routes/tasks");

// Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB bağlantısı
connectDB();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("Backend çalışıyor!");
});

// Server başlat
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server çalışıyor: http://localhost:${PORT}`);
});
