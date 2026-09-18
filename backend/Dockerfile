FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npx prisma generate

EXPOSE 4000

CMD sh -c "npx prisma db push --accept-data-loss && npm run seed && npm run dev"
