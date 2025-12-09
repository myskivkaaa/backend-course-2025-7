# Dockerfile
FROM node:18

WORKDIR /app

# Копіюємо файли конфігурації (включаючи devDependencies, куди входить nodemon)
COPY package.json package-lock.json ./

# Встановлюємо залежності
RUN npm install 

# Копіюємо увесь код
COPY . .

EXPOSE 3000

# Команда для запуску, яка має використовувати nodemon                                  (переконайтеся, що ваш package.json має "dev" скрипт)
#CMD ["npm", "run", "dev"]
CMD ["npm", "run", "debug"]