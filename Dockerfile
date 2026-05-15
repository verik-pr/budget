FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl tini \
  && addgroup -g 1001 -S nextjs \
  && adduser -S nextjs -u 1001 -G nextjs

COPY --chown=nextjs:nextjs package.json ./
RUN npm install --ignore-scripts

COPY --chown=nextjs:nextjs . .
RUN npx prisma generate
RUN npm run build

RUN mkdir -p /data && chown -R nextjs:nextjs /app /data

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./entrypoint.sh"]
