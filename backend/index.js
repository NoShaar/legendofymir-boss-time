import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// Healthcheck
app.get("/api", (req, res) => res.json({ status: "ok" }));

// Buscar token
app.get("/api/token/:id", async (req, res) => {
  try {
    const token = await prisma.token.findUnique({
      where: { id: req.params.id }
    });

    if (!token) return res.status(404).json({ error: "Token not found" });

    res.json(token);
  } catch (err) {
    console.error(err);
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
      update: { states }
    });

    res.json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Porta
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));
