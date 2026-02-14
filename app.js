import express from "express";
import peopleRoutes from "./routes/peopleRoutes.js";
import cors from "cors"; // 1. Import CORS
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());
// Link your routes
app.use("/api", peopleRoutes);

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
