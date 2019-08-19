FROM node:12-alpine
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN yarn global add --silent knex
RUN yarn install --silent && mv node_modules ../
COPY . .
VOLUME [ "/usr/src/app" ]
EXPOSE 8080
CMD npm start