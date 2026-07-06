# ============================================================
# 前端生产构建 Dockerfile (Phase 1.4)
# 多阶段构建: build (node) → serve (nginx)
# ============================================================

# ---- Stage 1: 构建 ----
FROM node:20-alpine AS builder
WORKDIR /app

# ADR-025 P0.3: 用 corepack + pnpm (与 package.json packageManager 字段一致),
# 之前用 npm ci 会让 pnpm-lock.yaml 失效, 破坏可重现构建
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 拷源码并构建
COPY . .
# 构建时注入 API 地址 (生产环境通过 nginx 代理到后端)
ENV VITE_API_BASE_URL=/api
RUN pnpm run build

# ---- Stage 2: 运行 (nginx 静态服务 + API 代理) ----
FROM nginx:alpine AS runner

# 拷贝构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx 配置: SPA 回退 + API 反向代理到后端
RUN cat > /etc/nginx/conf.d/default.conf <<'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA 路由回退
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理到主 API (运行时通过环境变量或默认 9090)
    location /api/ {
        proxy_pass http://api:9090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
        # WebSocket 支持 (指标流)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # gzip 压缩
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
EOF

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
