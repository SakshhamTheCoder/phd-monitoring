import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";

const Filters = sequelize.define(
    "Filters",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        key_name: {
            type: DataTypes.STRING,
        },
        label: {
            type: DataTypes.STRING,
        },
        data_type: {
            type: DataTypes.STRING,
        },
        function_name: {
            type: DataTypes.STRING,
        },
        applicable_pages: {
            type: DataTypes.JSON,
        },
        operator: {
            type: DataTypes.STRING,
        },
        options: {
            type: DataTypes.JSON,
        },
        api_url: {
            type: DataTypes.STRING,
        },
    },
    {
        tableName: "filters",
        timestamps: true,
        underscored: true,
    }
);

export { Filters };
