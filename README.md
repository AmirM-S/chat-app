# 💬 Microservices Chat App
A real-time chat application built with microservices architecture.

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

## 📦 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- Docker and Docker Compose
- npm or yarn

### Installation

1. **Clone the repository**
```bash
   git clone 
   cd chat-app
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
```

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
