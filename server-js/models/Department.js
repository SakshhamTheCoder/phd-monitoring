import { DataTypes } from "sequelize";
import sequelize from "../database/connection.js";

export const Department = sequelize.define("departments", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: DataTypes.STRING,
}, {
  tableName: "departments",
  timestamps: false,
});
