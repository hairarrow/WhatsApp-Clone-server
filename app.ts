import bcrypt from 'bcrypt'
import bodyParser from 'body-parser'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import jwt from 'jsonwebtoken'
import passport from 'passport'
import { Strategy as LocalStrategy } from 'passport-local'
import { users, User } from './db'
import { origin, secret, expiration } from './env'
import { validateLength, validatePassword } from './validators'

export const app = express()

app.use(cors({ credentials: true, origin }))
app.use(bodyParser.json())
app.use(cookieParser())

app.get('/_ping', (req, res) => {
  res.send('pong')
})

app.post('/sign-up', (req, res) => {
  const { name, username, password, passwordConfirm } = req.body

  try {
    validateLength('req.name', name, 3, 50)
    validateLength('req.username', name, 3, 18)
    validatePassword('req.password', password)

    if (password !== passwordConfirm) {
      throw Error("req.password and req.passwordConfirm don't match")
    }

    if (users.some(u => u.username === username)) {
      throw Error("username already exists")
    }
  } catch (e) {
    return res.status(400).send(e.message)
  }

  const passwordHash = bcrypt.hashSync(password, bcrypt.genSaltSync(8))

  const user: User = {
    id: String(users.length + 1),
    password: passwordHash,
    picture: '',
    username,
    name,
  }

  users.push(user)

  res.status(200).send({ id: user.id })
})

app.post('/sign-in', (req, res) => {
  const { username, password } = req.body

  const user = users.find(u => u.username === username)

  if (!user) {
    return res.status(404).send('user not found')
  }

  const passwordsMatch = bcrypt.compareSync(password, user.password)

  if (!passwordsMatch) {
    return res.status(400).send('password is incorrect')
  }

  const authToken = jwt.sign(username, secret)

  res.cookie('authToken', authToken, { maxAge: expiration })
  res.status(200).send({ id: user.id })
})
