import { PubSub } from 'apollo-server-express'
import { User } from './db'

export type Context {
  currentUser: User
  pubsub: PubSub
}
