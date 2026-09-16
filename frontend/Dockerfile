FROM node:20-alpine

WORKDIR /app

ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
