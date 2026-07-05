const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.static(__dirname));

app.post("/save-ifar-database", (req, res) => {
  try {
    const data = req.body;

    if (!data || typeof data !== "object") {
      return res.status(400).json({ success: false, message: "Invalid JSON data." });
    }

    const filePath = path.join(__dirname, "database", "ifar_database.json");

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");

    res.json({
      success: true,
      message: "IFAR database saved successfully.",
      path: "database/ifar_database.json"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});