import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OTT Platform API Documentation',
      version: '1.0.0',
      description: 'API documentation for OTT Platform microservices',
      contact: {
        name: 'OTT Platform Team',
        email: 'support@ottplatform.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'API Gateway',
      },
      {
        url: 'http://localhost:3001',
        description: 'Auth Service',
      },
      {
        url: 'http://localhost:3002',
        description: 'User Service',
      },
      {
        url: 'http://localhost:3003',
        description: 'Content Service',
      },
      {
        url: 'http://localhost:3004',
        description: 'Streaming Service',
      },
      {
        url: 'http://localhost:3005',
        description: 'Payment Service',
      },
      {
        url: 'http://localhost:3006',
        description: 'Notification Service',
      },
      {
        url: 'http://localhost:3007',
        description: 'Analytics Service',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'], // Path to API docs
};

export const swaggerSpec = swaggerJsdoc(options);
