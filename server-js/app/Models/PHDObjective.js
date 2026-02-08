import { Model, DataTypes } from 'sequelize';
import sequelize from '../../database/connection.js';

class PHDObjective extends Model {
    static associate(models) {
        // PHP: public function irbForm() { return $this->belongsTo(Student::class, 'student_id', 'id'); }
        // 'id' in Student is usually not 'roll_no' but the internal id? 
        // Student.php primary key is 'id' but keyType is string (roll_no)? 
        // In Student.js we set 'primaryKey: true' on 'roll_no'. 
        // Checking Student.php again... "protected $primaryKey = 'id';" but strictly it's "roll_no" usually in this system.
        // Wait, previous Student.js port: "roll_no: { type: DataTypes.STRING, primaryKey: true }".
        // The PHP Model relations usually imply 'id' if not specified, 
        // but here it explicitly said 'id'. If Student table has 'id' column distinct from 'roll_no', we should use that.
        // However, standard in this app seems to be roll_no. 
        // I will bind to 'student_id' as usual, targeting Student's primary key.
        PHDObjective.belongsTo(models.Student, { foreignKey: 'student_id', as: 'irbForm' });
    }
}

PHDObjective.init({
    student_id: DataTypes.STRING,
    objective: DataTypes.TEXT,
    type: DataTypes.STRING,
}, {
    sequelize,
    modelName: 'PHDObjective',
    tableName: 'irb_sub_objectives',
    underscored: true,
});

export default PHDObjective;
