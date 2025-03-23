FROM node:18-alpine

WORKDIR /app

# Copy the entire project first
COPY . .

# Navigate to the API directory and install dependencies
WORKDIR /app/apps/api
RUN npm install

# Build the application
RUN npm run build

# Set environment variables
ENV NODE_ENV=production

# Expose the port
EXPOSE 5001

# Start the application
CMD ["npm", "start"]