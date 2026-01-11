import { DataTypes } from "sequelize";
import sequelize from "../database/connection.js";

const Role = sequelize.define(
  "roles",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    role: DataTypes.STRING,
  },
  {
    tableName: "roles",
    timestamps: false,
  }
);

export default Role;
