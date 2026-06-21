FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run prisma:generate
ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "npm run prisma:deploy && npm start"]
