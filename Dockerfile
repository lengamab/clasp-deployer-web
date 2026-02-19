# Use official Node.js LTS image
FROM node:22-slim

# Install Python for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create directory for SQLite database if it doesn't exist
RUN mkdir -p /app/data

# Expose the port Cloud Run will use
EXPOSE 8080

# Set environment variable for port
ENV PORT=8080

# Start the server
CMD ["node", "server.js"]


