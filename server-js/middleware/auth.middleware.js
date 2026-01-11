import jwt from "jsonwebtoken";
import {User} from "../models/User.js";

export default async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = user;   // 👈 full DB user now
    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: "Invalid token" });
  }
}
