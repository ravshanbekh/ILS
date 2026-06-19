FROM node:20-alpine

WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build || true

EXPOSE 5000

# Start script: Sync schema and start server (db push is safe - adds new tables, never drops data)
CMD npx prisma db push && npm start
