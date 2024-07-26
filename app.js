const express = require("express");
const accountsRoutes = require("./routes/accountsRoutes");
const userRoutes = require("./routes/userRoutes");

const cors = require("cors");

require("dotenv").config();

const app = express();

// Middleware to parse JSON
app.use(express.json());
app.use(cors());

// Routes
app.use("/api/users", userRoutes);
app.use("/api/accounts", accountsRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
