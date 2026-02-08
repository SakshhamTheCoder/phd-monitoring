import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import { Faculty } from "./Faculty.js";

const IrbNomineeCognate = sequelize.define(
    "IrbNomineeCognate",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        irb_form_id: {
            type: DataTypes.INTEGER,
        },
        supervisor_id: {
            type: DataTypes.INTEGER,
        },
        nominee_id: {
            type: DataTypes.STRING,
        },
        status: {
            type: DataTypes.STRING,
        },
    },
    {
        tableName: "irb_nominee_cognates",
        timestamps: true,
        underscored: true,
    }
);

IrbNomineeCognate.belongsTo(Faculty, {
    foreignKey: "supervisor_id",
    as: "supervisor",
});

// Nominee relation defined in server-js/models/relations.js

export { IrbNomineeCognate };
