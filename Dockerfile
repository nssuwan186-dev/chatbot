FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* /app/
RUN npm install --no-fund --no-audit
COPY . /app
EXPOSE 8080
CMD ["npm", "start"]

