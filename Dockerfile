FROM node:18

WORKDIR /usr/src/app

COPY . .

RUN npm install

RUN npm uninstall  sqlite3
RUN npm install sqlite3 --build-from-source

RUN mkdir -p data && chmod 777 data

EXPOSE 3000

CMD ["node", "server.js"]