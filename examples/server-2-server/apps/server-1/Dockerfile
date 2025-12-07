# Use the official Bun image
FROM oven/bun:latest

# Set the working directory
WORKDIR /usr/src/app

# Cache dependencies (optional but recommended)
FROM oven/bun:latest AS install

COPY package.json ./

RUN bun install --frozen-lockfile

# Copy application code
COPY . .

RUN bun run build

# Expose port
EXPOSE 3000

# Run the app using Bun
CMD ["bun", "run", "start"]