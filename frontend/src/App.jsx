// frontend/src/App.jsx
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Skull,
  Sparkles,
  Copy,
  Download,
  Upload,
  Clock,
  Shield,
} from "lucide-react";
import "./App.css";

// ======================
// CONFIG
// ======================
const RESPAWN_TIME = 90 * 60 * 1000; // 1h30m em ms

// API_URL automático: em produção (Vercel) import.meta.env.PROD === true, usamos "/api"
// em desenvolvimento, usa http://localhost:3001/api (ajuste porta se seu backend rodar em outra porta)
const API_URL = import.meta.env.PROD ? "/api" : "http://localhost:3001/api";

const CATEGORIES = {
  COMUM: { name: "COMUM", rooms: ["P1", "P2"] },
  UNIVERSAL: { name: "UNIVERSAL", rooms: ["P1", "P2"] },
};

const BOSSES = ["MAGO", "BARDO", "LANCEIRO", "BERSERKER"];

function App() {
  const [token, setToken] = useState(null);
  const [bossStates, setBossStates] = useState({});
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [copiedToken, setCopiedToken] = useState(false);

  // Atualiza o tempo atual a cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-revive bosses quando o tempo acabar
  useEffect(() => {
    if (!token) return;

    const updatedStates = { ...bossStates };
    let hasChanges = false;

    Object.keys(updatedStates).forEach((key) => {
      const boss = updatedStates[key];
      if (boss?.status === "MORTO" && boss?.deathTime) {
        const timeElapsed = currentTime - boss.deathTime;
        if (timeElapsed >= RESPAWN_TIME) {
          updatedStates[key] = { status: "VIVO", deathTime: null };
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      setBossStates(updatedStates);
      // opcional: salvar automaticamente - aqui não salvamos para evitar muitas requisições
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, bossStates, token]);

  // ======================
  // BACKEND INTEGRATION
  // ======================

  // Gera um ID de token (UUID quando possível, fallback)
  const makeId = () => {
    try {
      if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    } catch (e) {
      // ignore
    }
    return Math.random().toString(36).slice(2, 10);
  };

  // Cria token no servidor (states inicial vazio)
  const createToken = async () => {
    const id = makeId();
    setToken(id);
    setBossStates({});

    try {
      await fetch(`${API_URL}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, states: {} }),
      });
    } catch (e) {
      console.error("Erro ao criar token no servidor:", e);
      alert("Não foi possível criar token no servidor. Verifique se o backend está rodando.");
    }

    return id;
  };

  // Importa token (busca no servidor)
  const importToken = async (tokenStr) => {
    if (!tokenStr) return alert("Cole um token para importar.");
    try {
      const res = await fetch(`${API_URL}/token/${encodeURIComponent(tokenStr)}`);
      if (res.status === 404) {
        alert("Token não encontrado!");
        return;
      }
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Erro ao buscar token");
      }
      const data = await res.json();
      setBossStates(data.states || {});
      setToken(tokenStr);
      setShowTokenModal(false);
      setTokenInput("");
    } catch (e) {
      console.error(e);
      alert("Erro ao importar token. Veja o console para detalhes.");
    }
  };

  // Salva token (upsert)
  const saveTokenToDB = async (id, newState) => {
    try {
      await fetch(`${API_URL}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, states: newState }),
      });
    } catch (e) {
      console.error("Erro ao salvar no servidor", e);
    }
  };

  const copyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  // Toggle status e salva no servidor
  const toggleBossStatus = async (category, room, boss) => {
    if (!token) {
      alert("Você precisa criar/importar um token primeiro.");
      return;
    }

    const key = `${category}-${room}-${boss}`;
    const currentStatus = bossStates[key]?.status || "VIVO";

    const updated = {
      ...bossStates,
      [key]: {
        status: currentStatus === "VIVO" ? "MORTO" : "VIVO",
        deathTime: currentStatus === "VIVO" ? Date.now() : null,
      },
    };

    setBossStates(updated);
    await saveTokenToDB(token, updated);
  };

  const getBossState = (category, room, boss) => {
    const key = `${category}-${room}-${boss}`;
    return bossStates[key] || { status: "VIVO", deathTime: null };
  };

  const getTimeRemaining = (deathTime) => {
    if (!deathTime) return { minutes: 0, seconds: 0, progress: 0 };

    const elapsed = currentTime - deathTime;
    const remaining = Math.max(0, RESPAWN_TIME - elapsed);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    const progress = (elapsed / RESPAWN_TIME) * 100;

    return { minutes, seconds, progress: Math.min(progress, 100) };
  };

  // ======================
  // UI
  // ======================
  const BossCard = ({ category, room, boss }) => {
    const state = getBossState(category, room, boss);
    const { minutes, seconds, progress } =
      state.status === "MORTO" ? getTimeRemaining(state.deathTime) : { minutes: 0, seconds: 0, progress: 0 };
    const isAlive = state.status === "VIVO";

    return (
      <div className={`boss-card ${isAlive ? "boss-card--alive" : "boss-card--dead"}`}>
        <div className="boss-card__header">
          <div>
            <h4 className="boss-card__name">{boss}</h4>
            <div className="boss-card__status">
              {isAlive ? <Sparkles className="boss-card__icon boss-card__icon--alive" /> : <Skull className="boss-card__icon boss-card__icon--dead" />}
              <span className={`boss-card__status-text ${isAlive ? "boss-card__status-text--alive" : "boss-card__status-text--dead"}`}>{state.status}</span>
            </div>
          </div>
          <Shield className="boss-card__shield" />
        </div>

        <div className="boss-card__timer-container">
          {!isAlive && (
            <>
              <div className="boss-card__timer">
                <Clock className="boss-card__clock" />
                <span className="boss-card__time">
                  {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                </span>
              </div>
              <div className="boss-card__progress-bar">
                <div className="boss-card__progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => toggleBossStatus(category, room, boss)}
          disabled={!token}
          className={`boss-card__button ${!token ? "boss-card__button--disabled" : isAlive ? "boss-card__button--kill" : "boss-card__button--revive"}`}
        >
          {!token ? "🔒 Token necessário" : isAlive ? "Marcar como Morto" : "Marcar como Vivo"}
        </button>
      </div>
    );
  };

  return (
    <div className="app">
      <div className="app__container">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="app__header">
          <h1 className="app__title">Boss Respawn Tracker</h1>
          <p className="app__subtitle">Controle os respawns dos bosses em tempo real</p>
        </motion.div>

        {/* Token Controls */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="app__controls">
          {!token ? (
            <>
              <button onClick={() => createToken()} className="app__button app__button--create">
                <Download className="app__button-icon" />
                Criar Token
              </button>
              <button onClick={() => setShowTokenModal(true)} className="app__button app__button--import">
                <Upload className="app__button-icon" />
                Importar Token
              </button>
            </>
          ) : (
            <>
              <button onClick={copyToken} className="app__button app__button--copy">
                <Copy className="app__button-icon" />
                {copiedToken ? "✓ Copiado!" : "Copiar Token"}
              </button>
              <button
                onClick={() => {
                  setToken(null);
                  setBossStates({});
                }}
                className="app__button app__button--clear"
              >
                Limpar Token
              </button>
            </>
          )}
        </motion.div>

        {/* Boss Grid */}
        {Object.entries(CATEGORIES).map(([catKey, catData]) => (
          <motion.div key={catKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="category">
            <h2 className="category__title">
              <Sparkles className="category__icon" />
              {catData.name}
            </h2>

            {catData.rooms.map((room) => (
              <div key={room} className="room">
                <h3 className="room__title">Sala {room}</h3>
                <div className="room__grid">{BOSSES.map((boss) => <BossCard key={boss} category={catKey} room={room} boss={boss} />)}</div>
              </div>
            ))}
          </motion.div>
        ))}
      </div>

      {/* Token Import Modal */}
      <AnimatePresence>
        {showTokenModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal" onClick={() => setShowTokenModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="modal__content" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal__title">Importar Token</h3>
              <textarea value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="Cole seu token aqui..." className="modal__textarea" />
              <div className="modal__buttons">
                <button onClick={() => importToken(tokenInput)} className="modal__button modal__button--import">
                  Importar
                </button>
                <button onClick={() => setShowTokenModal(false)} className="modal__button modal__button--cancel">
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
