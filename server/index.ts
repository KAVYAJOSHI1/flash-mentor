import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import cors from "cors";

import flashRoutes from "./routes/flash.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/api", flashRoutes);

app.get("/", (req: Request, res: Response) => {
  res.send("Flash backend is running 🎉");
});

app.listen(PORT, () => {
  console.log(`✅ Flash backend is running at http://localhost:${PORT}`);
});