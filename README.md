# 💬 Microservices Chat App

A real-time chat application built with microservices architecture, demonstrating scalable backend system design and modern Node.js technologies.

## 🏗️ Architecture

This project implements a distributed chat system with the following services:

- **API Gateway** - Request routing and load balancing
- **Authentication Service** - JWT-based user authentication
- **Chat Service** - Message handling with MongoDB and caching
- **WebSocket Service** - Real-time messaging and user presence
- **Message Broker** - Inter-service communication via RabbitMQ

## 🚀 Features

- ✅ Real-time messaging with Socket.IO
- ✅ User authentication and authorization (JWT)
- ✅ Online presence tracking
- ✅ Message persistence with MongoDB
- ✅ Redis caching for performance
- ✅ Service-to-service communication via RabbitMQ
- ✅ Health checks and metrics endpoints
- ✅ Containerized deployment with Docker Compose

## 🛠️ Tech Stack

- **Backend:** NestJS, TypeScript, Node.js
- **Database:** MongoDB (Mongoose)
- **Cache:** Redis
- **Message Broker:** RabbitMQ
- **Real-time:** Socket.IO
- **Authentication:** JWT
- **Containerization:** Docker, Docker Compose

## 📋 Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)

## 🏃‍♂️ Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/microservices-chat-app
   cd microservices-chat-app
   ```

2. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

3. **Access the application**
   - API Gateway: `http://localhost:3000`
   - Health Check: `http://localhost:3000/health`

## 🔧 Development

```bash
# Install dependencies for all services
npm install

# Start in development mode
npm run dev

# Run tests
npm test
```

## 📊 Monitoring

- **Health Endpoints:** `/health` on each service
- **Metrics:** Available at `/metrics`
- **Service Status:** Check Docker Compose logs

## 🏛️ Project Structure

```
├── services/
│   ├── api-gateway/
│   ├── auth-service/
│   ├── chat-service/
│   └── websocket-service/
├── docker-compose.yml
└── README.md
```

## 🤝 Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.
