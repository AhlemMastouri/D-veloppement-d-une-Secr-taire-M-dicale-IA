# ---- Étape 1 : build ----
FROM node:18-alpine AS builder

WORKDIR /app

# Installation des dépendances (mise en cache des layers)
COPY package*.json ./
RUN npm ci

# Copie du code source
COPY . .

# Génère le client Prisma (requis avant la compilation TS et à l'exécution)
RUN npx prisma generate

# Compilation TypeScript -> dist/
RUN npm run build

# ---- Étape 2 : production ----
FROM node:18-alpine AS production

ENV NODE_ENV=production

WORKDIR /app

# Installation des dépendances de production uniquement
COPY package*.json ./
RUN npm ci --omit=dev

# Récupération du code compilé depuis l'étape builder
COPY --from=builder /app/dist ./dist

# Récupération du client Prisma généré (le dossier .prisma dans node_modules)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/prisma ./prisma

EXPOSE 3001

CMD ["node", "dist/server.js"]