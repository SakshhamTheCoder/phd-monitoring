import { Model, DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import bcrypt from 'bcrypt';
import CustomResetPassword from '../Notifications/CustomResetPassword.js';
import EmailService from '../Services/EmailService.js';

class User extends Model {
    /*
     * Helper to get full name (appended attribute)
     */
    get name() {
        return `${this.first_name} ${this.last_name}`;
    }

    /*
     * Check if user is authorized for a role
     */
    /*
     * Check if user is authorized for a role
     */
    async isAuthorized(role) {
        const roles = await this.availableRoles();
        return roles.includes(role);
    }

    /*
     * Get available roles logic
     */
    /*
     * Get available roles logic
     */
    async availableRoles() {
        if (this.available_roles) {
            return this.available_roles;
        }

        let roles = [];

        // Match Laravel lazy loading behavior:
        // In Laravel, $this->role would trigger a DB query if not loaded.
        // In Sequelize, we must manually reload if association is missing.
        if (!this.role) {
            await this.reload({ include: ['role'] });
        }

        // Now we can safely access this.role
        const roleName = this.role ? this.role.role : null;

        if (roleName === 'student') {
            roles.push('student');
        }
        if (roleName === 'faculty') {
            roles.push('doctoral');
            roles.push('faculty');
        }
        if (roleName === 'phd_coordinator') {
            roles.push('doctoral');
            roles.push('faculty');
            roles.push('phd_coordinator');
        }
        if (roleName === 'hod') {
            roles.push('doctoral');
            roles.push('faculty');
            roles.push('hod');
        }
        if (roleName === 'external') {
            roles.push('doctoral');
            roles.push('external');
        }
        if (roleName === 'dra') {
            roles.push('doctoral');
            roles.push('faculty');
            roles.push('dra');
        }
        if (roleName === 'dordc') {
            roles.push('doctoral');
            roles.push('faculty');
            roles.push('dordc');
        }
        if (roleName === 'adordc') {
            roles.push('doctoral');
            roles.push('faculty');
            roles.push('adordc');
        }
        if (roleName === 'director') {
            roles.push('director');
        }

        this.available_roles = roles;
        await this.save();

        return roles;
    }

    /*
     * Send password reset notification
     * Uses real EmailService.
     */
    /*
     * Send password reset notification
     * Uses real EmailService.
     */
    async sendPasswordResetNotification(token) {
        const notification = new CustomResetPassword(token);

        // CustomResetPassword.js has a toMail method that returns { subject, view, data }
        if (notification.toMail) {
            const mailData = notification.toMail(this);

            // Send email using the ported EmailService
            await EmailService.sendHtmlEmail(
                this.email,
                mailData.subject,
                mailData.view, // Template name
                mailData.data
            );
        }

        // Persist notification data to match Laravel's database notification behavior
        // Assuming 'Notifications' model is available via association or import
        // We use the association defined in associate()

        try {
            await this.createNotification({
                title: 'Reset Password Notification', // Or subject from mailData
                body: JSON.stringify({ token: token }), // Store relevant data
                // link: ... if applicable
                is_read: false,
                email_sent: true, // We just sent it above
                email_req: true,
                role_id: this.current_role_id // context
            });
        } catch (error) {
            console.error("Failed to persist notification:", error);
            // Don't block flow? Laravel might throw, but let's log for safety in migration.
        }
    }

    /*
     * Handle hidden attributes and appended 'name' for JSON serialization
     */
    toJSON() {
        const values = Object.assign({}, this.get());

        const hidden = [
            'password',
            'remember_token',
            'email_verified_at',
            'created_at',
            'updated_at'
        ];

        hidden.forEach(field => {
            delete values[field];
        });

        // Add 'name' appends
        values.name = this.name;

        return values;
    }

    /*
     * Association definitions
     */
    static associate(models) {
        User.belongsTo(models.Role, { foreignKey: 'role_id', as: 'role' });
        User.belongsTo(models.Role, { foreignKey: 'current_role_id', as: 'current_role' });
        User.belongsTo(models.Role, { foreignKey: 'default_role_id', as: 'default_role' });
        User.hasOne(models.Student, { foreignKey: 'user_id', as: 'student' });
        User.hasOne(models.Faculty, { foreignKey: 'user_id', as: 'faculty' });
        User.hasMany(models.Notifications, { foreignKey: 'user_id', as: 'notifications' });
    }
}

User.init({
    first_name: DataTypes.STRING,
    last_name: DataTypes.STRING,
    phone: DataTypes.STRING,
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    gender: DataTypes.STRING,
    role_id: DataTypes.INTEGER,
    current_role_id: DataTypes.INTEGER,
    default_role_id: DataTypes.INTEGER,
    profile_picture: DataTypes.STRING,
    address: DataTypes.TEXT,
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    remember_token: DataTypes.STRING,
    email_verified_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    first_activation: DataTypes.BOOLEAN,
    available_roles: {
        type: DataTypes.JSON,
        defaultValue: null
    },
    status: DataTypes.STRING,
}, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    underscored: true,
    hooks: {
        /*
         * Hash password on creation and update if changed.
         */
        beforeCreate: async (user) => {
            if (user.password) {
                user.password = await bcrypt.hash(user.password, 10);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                user.password = await bcrypt.hash(user.password, 10);
            }
        }
    }
});

export default User;
