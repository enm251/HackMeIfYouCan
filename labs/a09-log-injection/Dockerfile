FROM alpine:3.18
RUN apk add --no-cache php81 php81-session
WORKDIR /app
COPY . .
RUN mkdir -p /app/logs && chmod -R 777 /app/logs
EXPOSE 3000
CMD ["php81", "-S", "0.0.0.0:3000", "-t", "/app"]
