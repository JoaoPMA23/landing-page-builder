FROM node:20-alpine
WORKDIR /app

COPY package.json ./
RUN npm i

COPY . .
RUN chmod +x docker-entrypoint.sh
RUN npx prisma generate

EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]
