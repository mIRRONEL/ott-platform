FROM alpine:3.18

RUN apk add --no-cache bash postgresql-client curl ca-certificates \
    && curl -L -o /tmp/mongosh.tgz https://downloads.mongodb.com/compass/mongosh-2.1.5-linux-x64.tgz \
    && tar -xzf /tmp/mongosh.tgz -C /tmp \
    && mv /tmp/mongosh-*/bin/mongosh /usr/local/bin/mongosh \
    && chmod +x /usr/local/bin/mongosh \
    && rm -rf /tmp/mongosh*

COPY init-databases.sh /init-databases.sh
RUN chmod +x /init-databases.sh

ENTRYPOINT ["/init-databases.sh"]