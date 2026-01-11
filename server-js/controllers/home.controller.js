import { User } from "../models/User.js";

/**
 * Home endpoint (Protected)
 * 
 * Currently acts as:
 * - Auth validation check
 * - Returns basic user + role info
 * 
 * TODO (Next phase):
 * - Implement role-based dashboard response:
 *   - Student dashboard
 *   - Faculty dashboard
 *   - Admin dashboard
 *   (Port logic from Laravel HomeController)
 */
export const getHome = async (req, res) => {
  try {
    // req.user is set by auth middleware (from JWT)
    const user = await User.findByPk(req.user.id, {
      include: ["current_role"],
      attributes: {
        exclude: ["password"], // never expose password
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      message: "Home API working",
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        role: user.current_role?.role || null,
      },
    });
  } catch (err) {
    console.error("Home API error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
