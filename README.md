# Judgement Backend

A Node.js backend service for the Judgement Unity game.

## Prerequisites

- Docker

## Running with Docker

1. Clone the repository
2. Navigate to the project directory
3. Run the following command to start the service:

```bash
docker-compose up -d --build
```

The service will be available at `http://localhost:3000`

## Project Structure

- `server.js` - Main application server
- `database.js` - Database configuration and operations
- `data/` - Directory containing sqlite data
- `Dockerfile` - Docker configuration
- `docker-compose.yml` - Docker Compose configuration

## Dependencies

- Express.js
- SQLite3
- bcryptjs
- cors
- body-parser
- cookie-parser
