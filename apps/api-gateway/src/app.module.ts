import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthController } from './auth/auth.controller';
import { JwtStrategy } from './auth/jwt.strategy';
import { ChatGateway } from './chat/chat.gateway';
import { Message, MessageSchema } from './chat/message.schema';
import { AppService } from './app.service';
import { AppController } from './app.controller';

@Module({
  imports: [
    JwtModule.register({ secret: 'secret123', signOptions: { expiresIn: '1h' } }),
    MongooseModule.forRoot('mongodb://127.0.0.1:27017/chat-app'),
    MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }]),
  ],
  controllers: [AppController, AuthController],
  providers: [AppService, ChatGateway, JwtStrategy],
})
export class AppModule {}
