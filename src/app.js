// src/app.js
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const { errorHandler } = require("./middleware/errorHandler");
const productsRouter = require("./routes/products.routes");
const authRouter = require("./routes/auth.routes");
const categoriesRouter = require("./routes/categories.routes");
const productVariantsRouter = require("./routes/productVariants.routes");
const addonsRouter = require("./routes/addons.routes");
const ingredientsRouter = require("./routes/ingredients.routes");
const recipesRouter = require("./routes/recipes.routes");
const inventoryTransactionsRouter = require("./routes/inventoryTransactions.routes");
const ordersRouter = require("./routes/orders.routes");
const orderItemsRouter = require("./routes/orderItems.routes");
const orderItemAddonsRouter = require("./routes/orderItemAddons.routes");
const profilesRouter = require("./routes/profiles.routes");

const app = express();

// --- Security & parsing middleware ---
app.use(helmet());
app.use(express.json({ limit: "1mb" })); // caps request body size

// CORS: only allow the frontend origin(s) listed in .env
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
  }),
);

// General rate limiter for the whole API — generous, just to blunt abuse.
// Auth routes will get a stricter, dedicated limiter when we build auth.routes.js.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});
app.use(generalLimiter);

// --- Health check (useful for uptime monitoring / free-tier host pings) ---
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// --- Routes ---
app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/product-variants", productVariantsRouter);
app.use("/api/addons", addonsRouter);
app.use("/api/ingredients", ingredientsRouter);
app.use("/api/recipes", recipesRouter);
app.use("/api/inventory-transactions", inventoryTransactionsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/order-items", orderItemsRouter);
app.use("/api/order-item-addons", orderItemAddonsRouter);
app.use("/api/profiles", profilesRouter);

// --- 404 fallback ---
app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// --- Centralized error handler (must be last) ---
app.use(errorHandler);

module.exports = app;
