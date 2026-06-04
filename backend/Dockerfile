FROM node:20-slim

# Install Python 3, pip, and C++ compiler (g++)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    g++ \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

# Set environment variable for C++ compiler (used by cppSyntaxValidator)
ENV CPP_COMPILER=g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only (use npm ci for faster, reproducible installs)
RUN npm ci --only=production

# Verify Python and C++ installations (optional, for debugging)
RUN python3 --version && python --version && g++ --version

# Copy the rest of the application source code
COPY . .

# Expose the port the app runs on
EXPOSE 5000

# Start the application
CMD ["npm", "start"]