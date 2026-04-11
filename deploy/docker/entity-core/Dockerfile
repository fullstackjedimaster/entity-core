
# docker/daq-ui/Dockerfile

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /entity-core

COPY  entity-core/package*.json ./
RUN npm ci

COPY  entity-core/ ./

RUN chmod -R a+x node_modules/.bin || true

ARG NEXT_PUBLIC_ENTITY_CORE_API_BASE_URL
ARG NEXT_PUBLIC_AUTH0_DOMAIN
ARG NEXT_PUBLIC_AUTH0_CLIENT_ID
ARG NEXT_PUBLIC_AUTH0_AUDIENCE
ARG NEXT_PUBLIC_AUTH0_NAMESPACE
ARG NEXT_PUBLIC_AUTH0_SCOPE
ARG NEXT_PUBLIC_AUTH0_REDIRECT_URI
ARG NEXT_PUBLIC_DISABLE_AUTH

ENV NEXT_PUBLIC_ENTITY_CORE_API_BASE_URL=$NEXT_PUBLIC_ENTITY_CORE_API_BASE_URL
ENV NEXT_PUBLIC_AUTH0_DOMAIN=$NEXT_PUBLIC_AUTH0_DOMAIN
ENV NEXT_PUBLIC_AUTH0_CLIENT_ID=$NEXT_PUBLIC_AUTH0_CLIENT_ID
ENV NEXT_PUBLIC_AUTH0_AUDIENCE=$NEXT_PUBLIC_AUTH0_AUDIENCE
ENV NEXT_PUBLIC_AUTH0_NAMESPACE=$NEXT_PUBLIC_AUTH0_NAMESPACE
ENV NEXT_PUBLIC_AUTH0_SCOPE=$NEXT_PUBLIC_AUTH0_SCOPE
ENV NEXT_PUBLIC_AUTH0_REDIRECT_URI=$NEXT_PUBLIC_AUTH0_REDIRECT_URI
ENV NEXT_PUBLIC_DISABLE_AUTH=$NEXT_PUBLIC_DISABLE_AUTH

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
