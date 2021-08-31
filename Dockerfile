FROM node:16-alpine
WORKDIR /webrtc
COPY . .
RUN npm install
RUN npm install -g cordova
RUN cordova requirements browser
RUN cordova build browser --verbose
EXPOSE 8001
CMD ["cordova", "run", "browser"]