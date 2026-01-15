import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import crypto from "crypto";

const Approval = sequelize.define(
    "Approval",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        key: {
            type: DataTypes.STRING,
        },
        email: {
            type: DataTypes.STRING,
        },
        action: {
            type: DataTypes.STRING,
        },
        model_type: {
            type: DataTypes.STRING,
        },
        model_id: {
            type: DataTypes.INTEGER,
        },
        approved: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "approvals",
        timestamps: true,
        underscored: true,
    }
);

Approval.generateKey = function () {
    return crypto.randomBytes(32).toString("hex");
};

// Polymorphic relationship would be defined here if the target models were known/imported.
// Equivalent to: return $this->morphTo();

export { Approval };
