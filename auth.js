import bcrypt from 'bcryptjs'
import { Sequelize, DataTypes } from 'sequelize'
import session from 'express-session'
import SequelizeStore from 'connect-session-sequelize'

const SessionStore = SequelizeStore(session.Store)

// Initialize SQLite database
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false
})

// Define User model
const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true
  }
})

// Initialize session store
const sessionStore = new SessionStore({
  db: sequelize
})

// Sync database
sequelize.sync()

// Hash password
export async function hashPassword(password) {
  return await bcrypt.hash(password, 10)
}

// Verify password
export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash)
}

// Create user
export async function createUser(username, password, email = null) {
  const hashedPassword = await hashPassword(password)
  return await User.create({
    username,
    password: hashedPassword,
    email
  })
}

// Find user by username
export async function findUserByUsername(username) {
  return await User.findOne({ where: { username } })
}

// Find user by ID
export async function findUserById(id) {
  return await User.findByPk(id)
}

// Authentication middleware
export function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next()
  }
  res.status(401).json({ error: 'Unauthorized' })
}

// Session configuration
export function getSessionConfig(secret) {
  return session({
    store: sessionStore,
    secret: secret || 'unicron-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
}

// Initialize session store
sessionStore.sync()

export { User, sequelize }
