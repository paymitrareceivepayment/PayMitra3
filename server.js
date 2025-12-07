const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + "-" + file.originalname);
  }
});

const upload = multer({ storage });

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// Upload handler (photo + qr + location)
app.post(
  "/upload",
  upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "qr", maxCount: 1 }
  ]),
  (req, res) => {
    console.log("Received form data:", req.body);

    const latitude = req.body.latitude;
    const longitude = req.body.longitude;

    console.log("Location received -> lat:", latitude, "lng:", longitude);
    console.log("Files received:", req.files);

    res.json({
      ok: true,
      message: "Data received successfully",
      receivedLocation: { latitude, longitude }
    });
  }
);

// Port
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log("Server running on port", PORT));