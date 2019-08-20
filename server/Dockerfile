FROM node:12-alpine
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm ci --silent && mv node_modules ../
ENV PATH="$PATH:/usr/src/node_modules/.bin"
COPY . .
VOLUME [ "/usr/src/app" ]
EXPOSE 8080
CMD npm start