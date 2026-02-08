import { Model, DataTypes } from 'sequelize';
import sequelize from '../../database/connection.js';

class StudentStatusChange extends Model {
    /**
     * Get the student associated with the status change.
     */
    async student() {
        return await this.getStudent();
    }

    /*
     * Handle hidden attributes for JSON serialization
     */
    toJSON() {
        const values = Object.assign({}, this.get());

        const hidden = [
            'created_at',
            'updated_at',
        ];

        hidden.forEach(field => {
            delete values[field];
        });

        return values;
    }

    static associate(models) {
        StudentStatusChange.belongsTo(models.Student, { foreignKey: 'student_id', targetKey: 'roll_no', as: 'student' });
    }
}

StudentStatusChange.init({
    student_id: DataTypes.STRING,
    previous_status: DataTypes.STRING,
    new_status: DataTypes.STRING,
    reason: DataTypes.TEXT,
    status: DataTypes.STRING,
    date: DataTypes.DATEONLY,
}, {
    sequelize,
    modelName: 'StudentStatusChange',
    tableName: 'student_status_changes', // Assuming standard plural
    underscored: true,
});

export default StudentStatusChange;
