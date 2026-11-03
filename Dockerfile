FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN VITE_RENTKEEP_MODE=railway npm run build
FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY backend ./backend
COPY netlify/functions ./netlify/functions
COPY src/domain.js ./src/domain.js
COPY scripts ./scripts
COPY railway-server.mjs ./
USER node
CMD ["node","railway-server.mjs"]
