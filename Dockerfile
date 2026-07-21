FROM node:22-slim AS base
WORKDIR /app

# Prisma needs openssl to talk to Postgres correctly on slim images
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

# Apply pending migrations then start the compiled API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
