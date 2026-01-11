import { DataTypes } from "sequelize";
import sequelize from "../database/connection.js";
import Role from "./Role.js";

const User = sequelize.define(
  "users",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    first_name: DataTypes.STRING,
    last_name: DataTypes.STRING,
    email: DataTypes.STRING,
    password: DataTypes.STRING,
    phone: DataTypes.STRING,
    gender: DataTypes.STRING,
    role_id: DataTypes.INTEGER,
    current_role_id: DataTypes.INTEGER,
    default_role_id: DataTypes.INTEGER,
  },
  {
    tableName: "users",
    timestamps: false,
  }
);

// Relations
User.belongsTo(Role, { foreignKey: "current_role_id", as: "current_role" });

export { User };
