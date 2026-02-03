import { Model, DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import bcrypt from 'bcryptjs';

class OutsideExpert extends Model {

    /**
     * Get or create faculty for this outside expert
     */
    async getFaculty() {
        // Need to access User and Faculty models. 
        // Using sequelize.models to avoid circular dependency issues at top level imports if possible,
        // or just standard imports if structures allow. Using sequelize.models is safer for dynamic lookups.
        const { User, Faculty } = sequelize.models;

        // Check if faculty exists by email
        let user = await User.findOne({ where: { email: this.email }, include: ['faculty'] });

        if (user && user.faculty) {
            return user.faculty;
        }

        // Create new user if doesn't exist
        if (!user) {
            const hashedPassword = await bcrypt.hash('password123', 10);
            user = await User.create({
                first_name: this.first_name,
                last_name: this.last_name,
                email: this.email,
                phone: this.phone,
                password: hashedPassword, // Default password
                role_id: 1, // Default role
                current_role_id: 1,
                default_role_id: 1,
                status: 'active',
            });
        }

        // Create faculty with arbitrary faculty code
        // PHP: '777' . str_pad($user->id, 6, '0', STR_PAD_LEFT);
        const facultyCode = '777' + String(user.id).padStart(6, '0');

        const faculty = await Faculty.create({
            user_id: user.id,
            faculty_code: facultyCode,
            designation: this.designation,
            department_id: null, // External experts don't belong to a department
        });

        return faculty;
    }

    static associate(models) {
        OutsideExpert.hasMany(models.IrbOutsideExpert, { foreignKey: 'expert_id', as: 'irbOutsideExperts' });

        // Polymorphic relationship: morphMany(IRBCommittee::class, 'member')
        // In Sequelize, polymorphic logic is usually handled by `scope` or `constraints: false`.
        // However, standard simplified mapping often explicitly defines the foreign keys.
        // Assuming IRBCommittee has `member_id` and `member_type`.
        OutsideExpert.hasMany(models.IRBCommittee, {
            foreignKey: 'member_id',
            constraints: false,
            scope: {
                member_type: 'App\\Models\\OutsideExpert' // or 'outside_expert' depending on Convention
            },
            as: 'irbCommittees'
        });
    }
}

OutsideExpert.init({
    first_name: DataTypes.STRING,
    last_name: DataTypes.STRING,
    designation: DataTypes.STRING,
    department: DataTypes.STRING,
    institution: DataTypes.STRING,
    email: DataTypes.STRING,
    phone: DataTypes.STRING,
    area_of_expertise: DataTypes.STRING,
    website: DataTypes.STRING,
}, {
    sequelize,
    modelName: 'OutsideExpert',
    tableName: 'outside_experts',
    underscored: true,
});

export default OutsideExpert;
