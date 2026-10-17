import { Client } from '@elastic/elasticsearch';
import { logger } from '../utils/logger';
import { mongoClient } from './mongodb.connection';

const node = process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200';

export const elasticsearchClient = new Client({
  node,
  auth: {
    username: process.env.ELASTICSEARCH_USER || 'elastic',
    password: process.env.ELASTICSEARCH_PASSWORD || 'changeme'
  }
});

export const syncMongoDBToElasticsearch = async () => {
  try {
    const mongoDb = mongoClient.db('ott_platform');
    const videosCollection = mongoDb.collection('videos');
    const videos = await videosCollection.find({}).toArray();

    logger.info(`[Elasticsearch] Syncing ${videos.length} videos from MongoDB...`);

    for (const v of videos) {
      const vidId = String(v.id || v._id);
      await elasticsearchClient.index({
        index: 'videos',
        id: vidId,
        document: {
          id: vidId,
          videoId: vidId,
          title: v.title || 'Untitled',
          description: v.description || '',
          category: v.category || 'Movies',
          subCategory: v.subCategory || 'Other',
          cast: v.cast || [],
          director: v.director || '',
          tags: v.tags || [],
          imdbRating: Number(v.imdbRating || v.rating || 8.5),
          releaseDate: v.releaseDate || v.created_at || new Date(),
          thumbnail: v.thumbnail || `/api/stream/${vidId}/thumbnail`,
          posterImage: v.posterImage || v.thumbnail || `/api/stream/${vidId}/thumbnail`,
          duration: Number(v.duration || 0),
          status: v.status || 'ready'
        }
      });
    }

    await elasticsearchClient.indices.refresh({ index: 'videos' });
    logger.info(`[Elasticsearch] Successfully indexed ${videos.length} videos into 'videos' index.`);
  } catch (err) {
    logger.warn('[Elasticsearch] Sync from MongoDB warning:', err);
  }
};

// Test connection with retry
const connectElasticsearch = () => {
  elasticsearchClient.info()
    .then(async () => {
      logger.info('Elasticsearch connected successfully');
      
      // Create index if not exists
      try {
        const exists = await elasticsearchClient.indices.exists({ index: 'videos' });
        if (!exists) {
          await elasticsearchClient.indices.create({
            index: 'videos',
            body: {
              settings: {
                number_of_shards: 1,
                number_of_replicas: 0
              },
              mappings: {
                properties: {
                  id: { type: 'keyword' },
                  videoId: { type: 'keyword' },
                  title: { type: 'text', analyzer: 'standard' },
                  description: { type: 'text', analyzer: 'standard' },
                  category: { type: 'keyword' },
                  subCategory: { type: 'keyword' },
                  cast: { type: 'keyword' },
                  director: { type: 'keyword' },
                  tags: { type: 'keyword' },
                  imdbRating: { type: 'float' },
                  releaseDate: { type: 'date' },
                  thumbnail: { type: 'keyword' },
                  posterImage: { type: 'keyword' },
                  duration: { type: 'integer' },
                  status: { type: 'keyword' }
                }
              }
            }
          });
        }
        await syncMongoDBToElasticsearch();
      } catch (idxErr) {
        logger.warn('Elasticsearch index check error:', idxErr);
      }
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
