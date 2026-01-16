# 使用官方 Puppeteer 基础镜像（已包含 Chrome 和所有依赖）
FROM ghcr.io/puppeteer/puppeteer:23.11.1

# 切换到 root 用户安装全局包和创建目录
USER root

# 设置工作目录并赋予 pptruser 权限
WORKDIR /app
RUN chown -R pptruser:pptruser /app

# 设置时区为中国标准时间
ENV TZ=Asia/Shanghai

# 安装 pnpm
RUN npm install -g pnpm

# 切回 pptruser 用户（安全考虑）
USER pptruser

# 复制 package.json 和 lock 文件
COPY --chown=pptruser:pptruser package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制项目文件（排除 node_modules）
COPY --chown=pptruser:pptruser . .

# 启动应用
CMD ["node", "sign.js"]
