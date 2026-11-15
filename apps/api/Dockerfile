FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src/
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma/
COPY --from=builder /app/dist ./dist/

RUN chown -R node:node /app
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "const p=process.env.PORT||process.env.API_PORT||4000;fetch('http://127.0.0.1:'+p+'/health/live').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1));"

CMD ["node", "dist/main.js"]
