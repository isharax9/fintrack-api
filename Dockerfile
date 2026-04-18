FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies needed for Prisma
RUN apk add --no-cache openssl

# Copy package and lock files (if available)
COPY package.json package-lock.json* bun.lockb* ./

# Install all dependencies (development + production)
RUN npm install

# Copy source code and prisma schema
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript code
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache openssl

COPY --from=builder /app/package.json ./
# Only install production dependencies
RUN npm install --omit=dev

COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

# Start command
# We use a custom startup script in docker-compose, but provide a default here
CMD ["npm", "run", "start"]
