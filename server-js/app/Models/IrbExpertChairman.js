import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import { Faculty } from "./Faculty.js";

const IrbExpertChairman = sequelize.define(
    "IrbExpertChairman",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        irb_form_id: {
            type: DataTypes.INTEGER,
        },
        expert_id: {
            type: DataTypes.STRING,
        },
    },
    {
        tableName: "irb_expert_chairmen",
        timestamps: false,
        underscored: true,
    }
);

IrbExpertChairman.belongsTo(Faculty, {
    foreignKey: "expert_id",
    targetKey: "faculty_code",
    as: "expert",
});

export { IrbExpertChairman };
