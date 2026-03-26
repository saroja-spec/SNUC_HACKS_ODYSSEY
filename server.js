const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// ─── DATABASE SETUP ───
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './cashline_final.sqlite',
  logging: false
});

// ─── DATA MODELS ───
const User = sequelize.define('User', {
  name: DataTypes.STRING,
  passwordHash: DataTypes.STRING,
  profile: DataTypes.STRING, // student, freelancer, custom
  budget: DataTypes.FLOAT,
  hasBills: DataTypes.BOOLEAN,
  examMode: DataTypes.BOOLEAN,
  features: DataTypes.JSON, // Stores your chosen custom tools
  priorityPayments: DataTypes.JSON // For the Smart Triage engine
});

const Transaction = sequelize.define('Transaction', {
  type: DataTypes.STRING, // income, expense
  amount: DataTypes.FLOAT,
  desc: DataTypes.STRING,
  cat: DataTypes.STRING,
  date: DataTypes.DATEONLY,
  isOcrScanned: DataTypes.BOOLEAN // Track if it came from the new scanner
});

User.hasMany(Transaction);
Transaction.belongsTo(User);

// ─── API ROUTES ───

// 1. Authentication (Register)
app.post('/api/auth/register', async (req, res) => {
  const { password, profile } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ passwordHash: hash, profile });
  res.json({ id: user.id, message: "Account created" });
});

// 2. Authentication (Login)
app.post('/api/auth/login', async (req, res) => {
  const { password, id } = req.body;
  const user = await User.findByPk(id);
  if (user && await bcrypt.compare(password, user.passwordHash)) {
    res.json(user);
  } else {
    res.status(401).send('Invalid credentials');
  }
});

// 3. Save Triage Priorities
app.put('/api/user/:id/triage', async (req, res) => {
  const { priorityPayments } = req.body;
  await User.update({ priorityPayments }, { where: { id: req.params.id } });
  res.sendStatus(200);
});

// 4. Handle OCR Transactions
app.post('/api/user/:id/ocr-tx', async (req, res) => {
  const tx = await Transaction.create({
    ...req.body,
    isOcrScanned: true,
    UserId: req.params.id
  });
  res.json(tx);
});

// 5. Standard Data Sync (State Persistence)
app.get('/api/user/:id/full-state', async (req, res) => {
  const user = await User.findByPk(req.params.id, { include: [Transaction] });
  res.json(user);
});

const PORT = 3000;
sequelize.sync().then(() => {
  app.listen(PORT, () => console.log(`Cashline Final running at http://localhost:${PORT}`));
});
