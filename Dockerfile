FROM node:16-alpine
WORKDIR /webrtc
COPY . .
RUN npm install
EXPOSE 8001
CMD ["cordova", "run", "browser"]