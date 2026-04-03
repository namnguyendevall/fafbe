const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FAF Backend API',
      version: '1.0.0',
      description: 'API Documentation for Freelance Application Framework',
      contact: {
        name: 'FAF Developer',
      },
    },
    servers: [
        {
            url: 'https://fafbe-production.up.railway.app',
            description: 'Railway Production Server'
        },
        {
            url: 'http://localhost:5000',
            description: 'Local development server',
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
      schemas: {
        Error: {
            type: 'object',
            properties: {
                message: { type: 'string' },
            }
        }
      }
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/modules/**/*.route.js', './src/modules/**/*.js'], // Path to the API docs
};

const specs = swaggerJsdoc(options);

module.exports = specs;
