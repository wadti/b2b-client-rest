FROM node:17-alpine

WORKDIR /usr/src/app
 
COPY package*.json ./

RUN npm install
 
COPY . .

RUN yarn install

EXPOSE 8080
EXPOSE 3000
EXPOSE 5432

CMD [ "yarn", "start" ]
