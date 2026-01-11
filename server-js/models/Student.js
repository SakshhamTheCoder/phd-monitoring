import { DataTypes } from "sequelize";
import sequelize from "../database/connection.js";

export const Student = sequelize.define("students", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: DataTypes.INTEGER,
  roll_no: DataTypes.STRING,
  phd_title: DataTypes.STRING,
  overall_progress: DataTypes.INTEGER,
  cgpa: DataTypes.FLOAT,
  current_status: DataTypes.STRING,
  fathers_name: DataTypes.STRING,
  address: DataTypes.TEXT,
  date_of_registration: DataTypes.DATE,
  date_of_irb: DataTypes.DATE,
  date_of_synopsis: DataTypes.DATE,
  department_id: DataTypes.INTEGER,
}, {
  tableName: "students",
  timestamps: false,
});
