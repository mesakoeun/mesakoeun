import express from "express";
import peopleRoutes from "./routes/peopleRoutes.js";

const app = express();
const port = 3000;

app.use(express.json());

// Link your routes
app.use("/api", peopleRoutes);

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
