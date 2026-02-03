import { Model, DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

class Notifications extends Model {

    static associate(models) {
        Notifications.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
        Notifications.belongsTo(models.Role, { foreignKey: 'role_id', as: 'role' });
    }

    // Scopes are defined in options usually, but can also be static methods.
    static scopeUnread() {
        return { where: { is_read: false } };
    }

    static async getUnread(options = {}) {
        return await Notifications.findAll({
            where: { is_read: false },
            ...options
        });
    }

    static async getEmailNotSent(options = {}) {
        // scopeEmailNotSent logic: email_sent=false, email_req=true
        return await Notifications.findAll({
            where: {
                email_sent: false,
                email_req: true
            },
            ...options
        });
    }
}

Notifications.init({
    user_id: DataTypes.INTEGER,
    title: DataTypes.STRING,
    body: DataTypes.TEXT, // 'body' likely text
    link: DataTypes.STRING,
    is_read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    email_sent: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    email_req: {
        type: DataTypes.BOOLEAN,
        defaultValue: true // Assuming default true based on usage? PHP didn't set default but scope checks it.
    },
    role_id: DataTypes.INTEGER,
}, {
    sequelize,
    modelName: 'Notifications',
    tableName: 'notifications', // inferred standard plural
    underscored: true,
});

export default Notifications;
