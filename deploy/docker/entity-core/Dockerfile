
# docker/daq-ui/Dockerfile

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /entity-core

COPY --from=repo entity-core/package*.json ./
RUN npm ci

COPY --from=repo entity-core/ ./

RUN chmod -R a+x node_modules/.bin || true
RUN npm run build

# ---- runtime ----
FROM node:22-alpine AS runtime
WORKDIR /entity-core

ENV NODE_ENV=production
ENV PORT=3006

RUN apk add --no-cache tini

RUN addgroup -g 1001 -S nodejs \
 && adduser  -u 1001 -S nextjs -G nodejs

COPY --from=build /entity-core/package*.json ./
COPY --from=build /entity-core/node_modules ./node_modules
COPY --from=build /entity-core/.next ./.next
COPY --from=build /entity-core/public ./public

RUN chown -R nextjs:nodejs /entity-core

USER nextjs

EXPOSE 3006

ENTRYPOINT ["/sbin/tini","--"]
CMD ["./node_modules/.bin/next","start","-p","3006"]
