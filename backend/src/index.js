'use strict';

const express = require('express');
const cors = require('cors');

const config = require('./config');
const { errorHandler } = require('./middleware/errors');

const authRoutes = require('./routes/auth');
const organizationRoutes = require('./routes/organizations');
const flagRoutes = require('./routes/flags');

const app = express();

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow non-browser clients (no origin) and whitelisted origins.
      if (!origin || config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/flags', flagRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

app.listen(config.PORT, () => {
  console.log(`Feature-flags backend listening on port ${config.PORT}`);
});

module.exports = app;
