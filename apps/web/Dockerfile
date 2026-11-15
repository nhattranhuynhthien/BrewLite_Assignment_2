FROM node:22-alpine AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_API_MOCK=false
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_API_MOCK=${NEXT_PUBLIC_API_MOCK}
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm ci

COPY tsconfig.json next.config.ts ./
COPY public ./public/
COPY src ./src/
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/public ./public/
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static/

RUN chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "const p=process.env.PORT||3000;fetch('http://127.0.0.1:'+p+'/').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1));"

CMD ["node", "server.js"]
