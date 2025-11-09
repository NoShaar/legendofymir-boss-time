import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

// Prisma client
const prisma = new PrismaClient();

// Express app
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Healthcheck
app.get("/api", (req, res) => {
  res.json({ status: "ok" });
});

// Buscar token
app.get("/api/token/:id", async (req, res) => {
  try {
    const tokenData = await prisma.token.findUnique({
      where: { id: req.params.id },
    });

    if (!tokenData) {
      return res.status(404).json({ error: "Token not found" });
    }

    res.json(tokenData);
  } catch (err) {
    console.error("GET /api/token/:id ERROR →", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Salvar / Atualizar token
app.post("/api/token", async (req, res) => {
  try {
    const { id, states } = req.body;

    if (!id) return res.status(400).json({ error: "id required" });

    const saved = await prisma.token.upsert({
      where: { id },
      create: { id, states },
      update: { states },
    });

    res.json(saved);
  } catch (err) {
    console.error("POST /api/token ERROR →", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ EXPORT — necessário para Serverless Vercel
export default app;
