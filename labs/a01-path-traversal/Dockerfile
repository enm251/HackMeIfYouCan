FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --only=production
COPY . .
RUN cp flag.txt /flag.txt
EXPOSE 3000
CMD ["node", "server.js"]
