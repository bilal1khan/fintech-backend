const jwt = require("jsonwebtoken");
require("dotenv").config();
const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers["authorization"];

    if (!authHeader) return res.status(403).send("Access denied.");

    const token = authHeader.split(" ")[1];
    //console.log(token);
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) return res.status(401).send("Invalid token.");
      req.id = decoded.id;
      next();
    });
};


module.exports = {
    authMiddleware
};