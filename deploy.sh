#!/usr/bin/env bash
set -euo pipefail

# ========= 你需要修改的配置 =========
APP_NAME="label-system-admin"

LOCAL_DIST="build"                         # 本地打包产物目录
BUILD_CMD="npm run build"                 # 打包命令

REMOTE_HOST="39.107.227.165"             # 服务器地址
REMOTE_PORT="22"                          # SSH 端口
REMOTE_USER="root"                      # 服务器部署用户
REMOTE_DIR="/workspace/nginx/html/label-sys-admin"  # 远程部署目录

SSH_KEY="$HOME/.ssh/id_ed25519_deploy"    # 部署私钥
# ==================================

echo "==> [1/4] 开始构建: $APP_NAME"
$BUILD_CMD

echo "==> [2/4] 检查构建产物目录: $LOCAL_DIST"
if [ ! -d "$LOCAL_DIST" ]; then
  echo "错误：未找到构建目录 $LOCAL_DIST"
  exit 1
fi

echo "==> [3/4] 预检查远程目录是否存在"
ssh -i "$SSH_KEY" -p "$REMOTE_PORT" "$REMOTE_USER@$REMOTE_HOST" "mkdir -p '$REMOTE_DIR'"

echo "==> [4/4] 上传文件到远程目录"
rsync -az --delete \
  -e "ssh -i $SSH_KEY -p $REMOTE_PORT -o IdentitiesOnly=yes" \
  "$LOCAL_DIST"/ \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"

echo "✅ 部署完成: $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR"
