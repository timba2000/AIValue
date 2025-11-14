import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import "dotenv/config";
import useCaseRouter from "./routes/useCases";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 5000;

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN?.split(",") ?? ["http://localhost:5173"],
    credentials: true
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/usecases", useCaseRouter);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
