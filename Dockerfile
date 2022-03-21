FROM node:latest as node

WORKDIR /app

COPY src ./src
COPY angular.json .
COPY package.json .
COPY package-lock.json .
COPY tsconfig.app.json .
COPY tsconfig.json .
COPY tsconfig.spec.json .

RUN npm install
RUN npm run build --prod

FROM nginx:alpine
COPY --from=node /app/dist/angular-build-once-deploy-multiple /usr/share/nginx/html/
EXPOSE 80:80
