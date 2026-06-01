FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --silent
COPY server.js .
COPY flag.txt .
COPY public public
EXPOSE 3000
CMD ["node", "server.js"]

