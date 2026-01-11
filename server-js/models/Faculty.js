import { DataTypes } from "sequelize";
import sequelize from "../database/connection.js";

export const Faculty = sequelize.define("faculty", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: DataTypes.INTEGER,
  faculty_code: DataTypes.STRING,
  designation: DataTypes.STRING,
  supervised_outside: DataTypes.INTEGER,
  supervised_campus: DataTypes.INTEGER,
  department_id: DataTypes.INTEGER,
}, {
  tableName: "faculty",
  timestamps: false,
});
