import bcrypt from 'bcrypt';
import User from '../../models/User.js';
import Faculty from '../../models/Faculty.js';

class FacultyImport {
    /*
     * Logic to process the import row
     */
    async model(row) {
        // Ensure proper indices from Excel columns
        const name = row[2];
        const email = row[1];
        const faculty_code = row[1];

        const hashedPassword = await bcrypt.hash('default_password', 10);

        const user = await User.create({
            first_name: name,
            email: email,
            password: hashedPassword,
        });

        // Assuming Sequelize models return the instance with an id property
        return await Faculty.create({
            user_id: user.id,
            faculty_code: faculty_code,
        });
    }
}

export default FacultyImport;
