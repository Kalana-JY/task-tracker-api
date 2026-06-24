# Build dependencies
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Production image
FROM node:24-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Bring in only the installed node_modules from the build stage
COPY --from=builder /app/node_modules ./node_modules

# Copy rest of the application code
COPY . .

# Ensure the non-root user owns the app files
RUN chown -R appuser:appgroup /app
USER appuser

# Expose the port the app runs on
EXPOSE 3000

# Docker health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run the app
CMD ["node", "src/index.js"]