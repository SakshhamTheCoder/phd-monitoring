import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";

const Courses = sequelize.define(
    "Courses",
    {},
    {
        tableName: "courses", // Auto-inferred would be 'courses' usually, making it explicit or default
        timestamps: true,
        underscored: true,
    }
);

export { Courses };
