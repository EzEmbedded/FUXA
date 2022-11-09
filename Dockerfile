# Build Stage
FROM node:14.21.0-alpine3.16 AS build
# ENV NODE_ENV production
# RUN apk update && apk upgrade
# RUN apk add --no-cache sqlite~=3.38.5-r0
RUN \
  apk update && \
  apk upgrade && \
  apk add \
    alpine-sdk \
    build-base  \
    python3  \
#    tcl-dev \
#    tk-dev \
#    mesa-dev \
#    jpeg-dev \
    git 
#    libjpeg-turbo-dev

# Create app directory
WORKDIR /usr/src/app

RUN git clone https://github.com/EzEmbedded/FUXA.git
WORKDIR /usr/src/app/FUXA

# Install server
WORKDIR /usr/src/app/FUXA/server
# RUN npm install
RUN npm install --production
ADD . /usr/src/app/FUXA


# main Stage
FROM node:14.21.0-alpine3.16
RUN apk update && apk upgrade
RUN apk add --no-cache sqlite~=3.38.5-r0
WORKDIR /usr/src/app/
COPY --from=build /usr/src/app/FUXA /usr/src/app//FUXA
WORKDIR /usr/src/app/FUXA/server
EXPOSE 1881
CMD [ "npm", "start" ]
