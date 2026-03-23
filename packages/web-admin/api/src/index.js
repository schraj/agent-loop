const express = require('express');
const cors = require('cors');
const db = require('./db');
const authRouter = require('./routes/auth');
const rolesRouter = require('./routes/roles');
const usersRouter = require('./routes/users');
const widgetsRouter = require('./routes/widgets');
const statusRouter = require('./routes/status');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/healthz', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/users', usersRouter);
app.use('/api', widgetsRouter);
app.use('/api/status', statusRouter);

app.listen(PORT, () => {
  console.log(`Admin Portal API running on http://localhost:${PORT}`);
});
