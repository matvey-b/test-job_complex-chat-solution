FROM node:12-alpine
ENV NODE_ENV dev
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --silent && mv node_modules ../
COPY . .
VOLUME [ "/usr/src/app" ]
EXPOSE 3000
CMD npm start