import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import dbConfig from '../config/database.js';

dotenv.config();

const connectionName = process.env.DB_CONNECTION || dbConfig.default;
const connection = dbConfig.connections[connectionName];

const sequelize = new Sequelize(
  connection.database,
  connection.username,
  connection.password,
  {
    host: connection.host,
    port: connection.port,
    dialect: connection.driver,
    logging: false
  }
);

export default sequelize;