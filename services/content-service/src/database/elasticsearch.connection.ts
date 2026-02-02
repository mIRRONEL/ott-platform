import { Client } from '@elastic/elasticsearch';
import { logger } from '../utils/logger';

const node = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

export const elasticsearchClient = new Client({
  node,
  auth: {
    username: process.env.ELASTICSEARCH_USER || 'elastic',
    password: process.env.ELASTICSEARCH_PASSWORD || 'changeme'
  }
});

// Test connection with retry
const connectElasticsearch = () => {
  elasticsearchClient.info()
    .then(() => {
      logger.info('Elasticsearch connected successfully');
      
      // Create index if not exists
      elasticsearchClient.indices.exists({ index: 'videos' })
        .then((exists: boolean) => {
          if (!exists) {
            elasticsearchClient.indices.create({
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
      logger.warn('Elasticsearch connection failed, will retry in 5s...', err);
      setTimeout(connectElasticsearch, 5000);
    });
};

connectElasticsearch();

export const closeElasticsearchConnection = async () => {
  await elasticsearchClient.close();
  logger.info('Elasticsearch connection closed');
};
