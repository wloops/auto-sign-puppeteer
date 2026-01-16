# 使用官方 Puppeteer 基础镜像（已包含 Chrome 和所有依赖）
FROM ghcr.io/puppeteer/puppeteer:23.11.1

# 设置工作目录
WORKDIR /app

# 设置时区为中国标准时间
ENV TZ=Asia/Shanghai

# 复制 package.json 和 lock 文件
COPY package.json pnpm-lock.yaml ./

# 安装 pnpm 并安装依赖
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# 复制项目文件（排除 node_modules）
COPY . .

# 创建日志和截图目录
RUN mkdir -p logs screenshots

# 启动应用
CMD ["node", "sign.js"]
