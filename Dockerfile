FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM joseluisq/static-web-server:2-alpine

COPY --from=build /app/dist/froment-software/browser /public

EXPOSE 80
