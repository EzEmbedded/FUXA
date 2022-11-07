FROM node:14.21.0-alpine3.16

RUN apk update && apk upgrade
RUN apk add --no-cache git sqlite~=3.38.5-r0

# Create app directory
WORKDIR /usr/src/app



RUN git clone https://github.com/EzEmbedded/FUXA.git
WORKDIR /usr/src/app/FUXA

# Install server
WORKDIR /usr/src/app/FUXA/server
RUN npm install


ADD . /usr/src/app/FUXA

WORKDIR /usr/src/app/FUXA/server
EXPOSE 1881
CMD [ "npm", "start" ]
