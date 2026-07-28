# ==============================
# Étape 1 : compilation
# ==============================
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npm run build

# Retirer les déclarations et source maps du résultat final
RUN find dist -type f \( \
    -name "*.map" \
    -o -name "*.d.ts" \
    -o -name "*.d.ts.map" \
    \) -delete


# ==============================
# Étape 2 : exécution
# ==============================
FROM node:20-alpine AS runtime

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
