import bodyParser from 'body-parser'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { users } from './db'
import { expiration, origin, secret } from './env'

export const app = express()

app.use(cors({ credentials: true, origin }))
app.use(bodyParser.json())
app.use(cookieParser())

app.get('/_ping', (req, res) => {
  res.send('pong')
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
