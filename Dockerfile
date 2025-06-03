ARG NODE_VERSION=18.0.0
FROM node:${NODE_VERSION}-alpine as base

WORKDIR /usr/src/app
COPY . .
EXPOSE 5000
RUN npm install
CMD npm start