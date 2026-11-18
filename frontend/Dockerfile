# 1) build the React + TypeScript app
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# 2) serve it with Caddy (reverse-proxies /api and /mcp, serves generated sites, automatic HTTPS)
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv/app
