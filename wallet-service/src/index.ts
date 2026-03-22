import dotenv from "dotenv";
dotenv.config({ path: __dirname + "/../src/.env" });
import express from "express";
import cors from "cors";
import { router } from "./routes/wallet.routes";
import { startBackgroundSettler } from "./services/settlement.service";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use("/wallet", router);

app.listen(PORT, async () => {
  console.log(`The server is running on http://localhost:${PORT}`);
  await startBackgroundSettler();
  console.log("Background settler started");
});
