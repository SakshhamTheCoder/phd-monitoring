import { User } from "../../../models/User.js";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Google Auth Controller
 * Handles Google OAuth authentication
 */

/**
 * Redirect to Google OAuth
 * Note: For Express.js, you typically handle the redirect on the frontend
 * This is here for reference/compatibility
 */
export const redirectToGoogle = (req, res) => {
  const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&response_type=code&scope=openid%20email%20profile`;
  return res.redirect(redirectUrl);
};

/**
 * Handle Google OAuth callback
 */
export const handleGoogleCallback = async (req, res) => {
  try {
    // In a full implementation, you'd exchange the code for tokens here
    // For now, this is a placeholder that redirects to the frontend

    const frontendUrl = process.env.FRONTEND_URL || "https://phdportal.thapar.edu";
    const error = "Google OAuth callback not fully implemented yet";

    return res.redirect(
      `${frontendUrl}/google/callback?error=${encodeURIComponent(error)}`
    );
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    const frontendUrl = process.env.FRONTEND_URL || "https://phdportal.thapar.edu";
    return res.redirect(
      `${frontendUrl}/google/callback?error=${encodeURIComponent(
        "Failed to authenticate with Google: " + error.message
      )}`
    );
  }
};

/**
 * Login with Google token (for mobile/SPA)
 * Client sends the Google ID token (JWT), we verify it and log the user in
 */
export const loginWithGoogleToken = async (req, res) => {
  try {
    const { access_token } = req.body;

    if (!access_token) {
      return res.status(422).json({
        success: false,
        error: "Access token is required",
      });
    }

    // Verify the Google token
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: access_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: "Invalid Google token",
      });
    }

    if (!payload || !payload.email) {
      return res.status(401).json({
        success: false,
        error: "Invalid Google token payload",
      });
    }

    // Check if user exists by email
    const user = await User.findOne({
      where: { email: payload.email },
      include: ["current_role"],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "No account found with this email. Please contact administrator.",
      });
    }

    // Set up user roles if not already set
    if (!user.current_role_id) {
      if (!user.default_role_id) {
        user.current_role_id = user.role_id;
        user.default_role_id = user.role_id;
      } else {
        user.current_role_id = user.default_role_id;
      }
      await user.save();
    }

    // Create JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET || "secret123",
      { expiresIn: "10d" }
    );

    // Get available roles
    // TODO: Implement availableRoles() method on User model
    const availableRoles = []; // Placeholder

    // Prepare user data
    const userData = {
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      role: {
        role: user.current_role?.role || null,
      },
    };

    return res.json({
      success: true,
      user: userData,
      available_roles: availableRoles,
      token: token,
    });
  } catch (error) {
    console.error("Error in loginWithGoogleToken:", error);
    return res.status(401).json({
      success: false,
      error: "Failed to authenticate with Google: " + error.message,
    });
  }
};
