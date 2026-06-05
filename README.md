# Mis Finanzas — Deploy en Vercel

Tracker de finanzas personales con IA (Claude Haiku), PostgreSQL y React.

## Requisitos previos

- Cuenta en [GitHub](https://github.com)
- Cuenta en [Vercel](https://vercel.com) (gratis)
- Base de datos PostgreSQL — recomendado: [Neon](https://neon.tech) (gratis)
- API key de [Anthropic](https://console.anthropic.com) (para clasificación IA)

---

## Paso 1 — Base de datos en Neon

1. Ve a [neon.tech](https://neon.tech) → **New Project**
2. Pon nombre: `mis-finanzas`
3. Copia la **Connection string** (empieza por `postgresql://...`)
4. En el SQL editor de Neon, ejecuta:

```sql
CREATE TABLE IF NOT EXISTS transactions (
  id         SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  amount     NUMERIC(12, 2) NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category   TEXT NOT NULL,
  date       DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Paso 2 — Subir a GitHub

1. Crea un repositorio nuevo en GitHub (privado o público)
2. Sube **solo el contenido de esta carpeta** (`vercel-deploy/`) como raíz:

```bash
git init
git add .
git commit -m "Mis Finanzas - initial commit"
git remote add origin https://github.com/TU_USUARIO/mis-finanzas.git
git push -u origin main
```

---

## Paso 3 — Conectar con Vercel

1. Ve a [vercel.com/new](https://vercel.com/new)
2. Importa el repositorio de GitHub
3. **Framework Preset**: `Vite`
4. **Root Directory**: `/` (la raíz del repo)
5. **Build Command**: `vite build`
6. **Output Directory**: `dist`

### Variables de entorno (obligatorias)

En Vercel → Settings → Environment Variables, añade:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | La connection string de Neon |
| `ANTHROPIC_API_KEY` | Tu API key de Anthropic |

6. Haz clic en **Deploy** ✓

---

## Estructura del proyecto

```
├── api/
│   ├── transactions.ts   # Serverless Function — CRUD transacciones
│   ├── classify.ts       # Serverless Function — clasificación IA
│   └── healthz.ts        # Serverless Function — health check
├── src/
│   ├── App.tsx           # App React principal
│   ├── Logo.tsx          # Logo SVG
│   └── main.tsx          # Entry point
├── index.html
├── vite.config.ts
├── vercel.json           # Rutas y config de funciones
└── package.json
```

---

## Desarrollo local

```bash
npm install
# Crea un .env con DATABASE_URL y ANTHROPIC_API_KEY
npm run dev
```
