FROM node:14.21.0-alpine3.16

# Create app directory
WORKDIR /usr/src/app

RUN git clone https://github.com/EzEmbedded/FUXA.git
WORKDIR /usr/src/app/FUXA

# Install server
WORKDIR /usr/src/app/FUXA/server
RUN npm install

RUN \
  apk update && \
  apk upgrade && \
  apk add \
    alpine-sdk \
    build-base  \
    tcl-dev \
    tk-dev \
    mesa-dev \
    jpeg-dev \
    git \
    libjpeg-turbo-dev


# Workaround for sqlite3 https://stackoverflow.com/questions/71894884/sqlite3-err-dlopen-failed-version-glibc-2-29-not-found
RUN apk update && apk install -y sqlite3 libsqlite3-dev && \
  npm install --build-from-source --sqlite=/usr/bin sqlite3

ADD . /usr/src/app/FUXA

WORKDIR /usr/src/app/FUXA/server
EXPOSE 1881
CMD [ "npm", "start" ]
