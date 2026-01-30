/**
 * MongoDB connection using Mongoose
 * Load this in server.js before starting the app
 */

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    let uriToConnect = (process.env.MONGODB_URI || '').trim();
    const atlasHost = '.mongodb.net/';
    if (uriToConnect && uriToConnect.includes(atlasHost)) {
      const afterHost = uriToConnect.split(atlasHost)[1] || '';
      const pathPart = afterHost.split('?')[0];
      if (!pathPart || pathPart.length === 0) {
        const dbName = process.env.MONGODB_DB_NAME || process.env.DB_NAME || 'nexted';
        uriToConnect = uriToConnect.replace(atlasHost, atlasHost + dbName);
      }
    }
    const conn = await mongoose.connect(uriToConnect, {});
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
