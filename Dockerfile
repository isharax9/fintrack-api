FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies needed for Prisma
RUN apk add --no-cache openssl

# Copy package and lock files
COPY package.json package-lock.json ./

# Install all dependencies for build
RUN npm ci

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

ENV NODE_ENV=production

COPY package.json package-lock.json ./
# Only install production dependencies
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

USER node

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const http=require('http'); const port=process.env.PORT || 5001; const req=http.request({host:'127.0.0.1',port,path:'/health',timeout:4000},res=>process.exit(res.statusCode===200?0:1)); req.on('error',()=>process.exit(1)); req.on('timeout',()=>{req.destroy();process.exit(1)}); req.end();"

CMD ["npm", "run", "start"]
