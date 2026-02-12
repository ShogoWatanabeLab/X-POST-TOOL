FROM node:20-alpine

WORKDIR /app

# 依存関係のインストール（キャッシュ活用のため先にコピー）
COPY package.json package-lock.json* ./
RUN npm install

# ソースコードのコピー
COPY . .

# Next.js開発サーバーのポート
EXPOSE 3000

# 開発サーバー起動
CMD ["npm", "run", "dev"]
