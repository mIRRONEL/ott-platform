"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeElasticsearchConnection = exports.elasticsearchClient = void 0;
const elasticsearch_1 = require("@elastic/elasticsearch");
const logger_1 = require("../utils/logger");
const node = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
exports.elasticsearchClient = new elasticsearch_1.Client({
    node,
    auth: {
        username: process.env.ELASTICSEARCH_USER || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'changeme'
    }
});
// Test connection with retry
const connectElasticsearch = () => {
    exports.elasticsearchClient.info()
        .then(() => {
        logger_1.logger.info('Elasticsearch connected successfully');
        // Create index if not exists
        exports.elasticsearchClient.indices.exists({ index: 'videos' })
            .then((exists) => {
            if (!exists) {
                exports.elasticsearchClient.indices.create({
                    index: 'videos',
                    body: {
                        settings: {
                            number_of_shards: 1,
                            number_of_replicas: 0
                        },
                        mappings: {
                            properties: {
                                videoId: { type: 'keyword' },
                                title: { type: 'text', analyzer: 'standard' },
                                description: { type: 'text', analyzer: 'standard' },
                                category: { type: 'keyword' },
                                subCategory: { type: 'keyword' },
                                cast: { type: 'keyword' },
                                director: { type: 'keyword' },
                                tags: { type: 'keyword' },
                                imdbRating: { type: 'float' },
                                releaseDate: { type: 'date' }
                            }
                        }
                    }
                });
            }
        });
    })
        .catch((err) => {
        logger_1.logger.warn('Elasticsearch connection failed, will retry in 5s...', err);
        setTimeout(connectElasticsearch, 5000);
    });
};
connectElasticsearch();
const closeElasticsearchConnection = async () => {
    await exports.elasticsearchClient.close();
    logger_1.logger.info('Elasticsearch connection closed');
};
exports.closeElasticsearchConnection = closeElasticsearchConnection;
//# sourceMappingURL=elasticsearch.connection.js.map