FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npx", "tsx", "src/scrape.ts"]
