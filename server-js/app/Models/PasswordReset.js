import { Model, DataTypes } from 'sequelize';
import sequelize from '../../database/connection.js';

class PasswordReset extends Model {}

PasswordReset.init({
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true // Use email as PK to match Laravel's default structure
    },
    token: {
        type: DataTypes.STRING,
        allowNull: false
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    sequelize,
    modelName: 'PasswordReset',
    tableName: 'password_resets',
    timestamps: false // Laravel's password_resets only has created_at
});

export default PasswordReset;
