FROM node:20

ARG SERVICE
ENV SERVICE ${SERVICE}

WORKDIR /home/usr/app

COPY . .

RUN npm ci --force

EXPOSE 3000

CMD npx nx serve ${SERVICE}
