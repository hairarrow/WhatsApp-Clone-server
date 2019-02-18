import { Injectable, ProviderScope } from '@graphql-modules/di'
import { Connection } from 'typeorm'
import { MessageProvider } from '../../message/providers/message.provider';
import { Chat } from '../models/Chat';
import { Message } from '../models/Message';
import { Recipient } from '../models/Recipient';
import { UserProvider } from '../../user/providers/user.provider';
import { User } from '../models/User';

@Injectable({
  scope: ProviderScope.Session,
})
export class RecipientProvider {
  constructor(
    private userProvider: UserProvider,
    private connection: Connection,
    private messageProvider: MessageProvider,
  ) { }

  public repository = this.connection.getRepository(Recipient);
  public currentUser = this.userProvider.currentUser;

  createQueryBuilder() {
    return this.connection.createQueryBuilder(Recipient, 'recipient');
  }

  getChatUnreadMessagesCount(chat: Chat) {
    return this.messageProvider
      .createQueryBuilder()
      .innerJoin('message.chat', 'chat', 'chat.id = :chatId', { chatId: chat.id })
      .innerJoin('message.recipients', 'recipients', 'recipients.user.id = :userId AND recipients.readAt IS NULL', {
        userId: this.currentUser.id
      })
      .getCount();
  }

  getMessageRecipients(message: Message) {
    return this.createQueryBuilder()
      .innerJoinAndSelect('recipient.message', 'message', 'message.id = :messageId', {
        messageId: message.id,
      })
      .innerJoinAndSelect('recipient.user', 'user')
      .getMany();
  }

  async getRecipientChat(recipient: Recipient) {
    const message = await recipient.message;
    if (await message.chat) {
      return await message.chat;
    }

    return this.messageProvider.getMessageChat(message);
  }

  async removeChat(chatId: string) {
    const messages = await this.messageProvider._removeChatGetMessages(chatId);

    for (let message of messages) {
      if (message.holders.length === 0) {
        const recipients = await this.createQueryBuilder()
          .innerJoinAndSelect('recipient.message', 'message', 'message.id = :messageId', { messageId: message.id })
          .innerJoinAndSelect('recipient.user', 'user')
          .getMany();

        for (let recipient of recipients) {
          await this.repository.remove(recipient);
        }
      }
    }

    return await this.messageProvider.removeChat(chatId, messages);
  }

  async addMessage(chatId: string, content: string) {
    const message = await this.messageProvider.addMessage(chatId, content) as Message;

    for (let user of message.holders as User[]) {
      if (user.id !== this.currentUser.id) {
        await this.repository.save(new Recipient({ user, message }));
      }
    }

    return message;
  }

  async removeMessages(
    chatId: string,
    {
      messageIds,
      all,
    }: {
      messageIds?: string[]
      all?: boolean
    } = {},
  ) {
    const { deletedIds, removedMessages } = await this.messageProvider._removeMessages(chatId, { messageIds, all });

    for (let message of removedMessages) {
      const recipients = await this.createQueryBuilder()
        .innerJoinAndSelect('recipient.message', 'message', 'message.id = :messageId', { messageId: message.id })
        .innerJoinAndSelect('recipient.user', 'user')
        .getMany();

      for (let recipient of recipients) {
        await this.repository.remove(recipient);
      }

      await this.messageProvider.repository.remove(message);
    }

    return deletedIds;
  }
}