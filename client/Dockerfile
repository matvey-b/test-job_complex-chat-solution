FROM node:12-alpine
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN yarn global add --silent react-scripts && yarn install --silent && mv node_modules ../
COPY . .
VOLUME [ "/usr/src/app" ]
EXPOSE 3000
CMD npm start