# 使用官方 Puppeteer 基础镜像（已包含 Chrome 和所有依赖）
FROM ghcr.io/puppeteer/puppeteer:23.11.1

# 切换到 root 用户安装全局包
USER root

# 设置工作目录
WORKDIR /app

# 设置时区为中国标准时间
ENV TZ=Asia/Shanghai

# 复制 package.json 和 lock 文件，并设置权限
COPY --chown=pptruser:pptruser package.json pnpm-lock.yaml ./

# 安装 pnpm
RUN npm install -g pnpm

# 切回 pptruser 用户（安全考虑）
USER pptruser

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制项目文件（排除 node_modules）
COPY --chown=pptruser:pptruser . .

# 启动应用
CMD ["node", "sign.js"]
