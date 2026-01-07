# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build arguments for Azure OpenAI credentials
ARG VITE_AZURE_OPENAI_ENDPOINT
ARG VITE_AZURE_OPENAI_API_KEY
ARG VITE_AZURE_OPENAI_DEPLOYMENT

# Set environment variables for build
ENV VITE_AZURE_OPENAI_ENDPOINT=$VITE_AZURE_OPENAI_ENDPOINT
ENV VITE_AZURE_OPENAI_API_KEY=$VITE_AZURE_OPENAI_API_KEY
ENV VITE_AZURE_OPENAI_DEPLOYMENT=$VITE_AZURE_OPENAI_DEPLOYMENT

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
