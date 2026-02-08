import { Model, DataTypes } from 'sequelize';
import sequelize from '../../database/connection.js';

class Supervisor extends Model {

    /**
     * The attributes that should be hidden for arrays.
     */
    toJSON() {
        const values = Object.assign({}, this.get());
        delete values['created_at'];
        return values;
    }

    static associate(models) {
        Supervisor.belongsTo(models.Faculty, { foreignKey: 'faculty_id', targetKey: 'id', as: 'faculty' });
        Supervisor.belongsTo(models.Student, { foreignKey: 'student_id', targetKey: 'roll_no', as: 'student' });
        Supervisor.hasMany(models.IrbNomineeCognate, { foreignKey: 'supervisor_id', as: 'irbNomineeCognates' });
    }
}

Supervisor.init({
    faculty_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    student_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    type: DataTypes.STRING,
}, {
    sequelize,
    modelName: 'Supervisor',
    tableName: 'supervisors',
    underscored: true,
});

export default Supervisor;
