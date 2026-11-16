// Picks where data is kept: Postgres when DATABASE_URL is set, otherwise a
// JSON file in data/. Both expose the same functions, so server.js doesn't care.

module.exports = process.env.DATABASE_URL ? require('./postgres') : require('./file');
