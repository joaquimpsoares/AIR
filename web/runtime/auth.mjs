/**
 * Non-production / development authentication adapter for demo exercises.
 * Authenticates against deterministic fixture user identities and handles
 * the complete standard authentication & account lifecycle.
 */
export class DemoAuthAdapter {
  constructor(options = {}) {
    this.demoMode = options.demoMode ?? true;
    this.users = options.users ?? [
      {
        id: "u_admin",
        name: "Alex Admin",
        email: "alex@example.com",
        password: "password123",
        roles: ["admin"],
        actor: "users",
        verified: true,
        active: true
      },
      {
        id: "u_manager",
        name: "Sam Manager",
        email: "sam@example.com",
        password: "password123",
        roles: ["manager"],
        actor: "users",
        verified: true,
        active: true
      },
      {
        id: "u_member",
        name: "Morgan Member",
        email: "morgan@example.com",
        password: "password123",
        roles: ["member"],
        actor: "users",
        verified: true,
        active: true
      }
    ];

    // Map of email -> verification code
    this.pendingVerifications = new Map();
    // Map of token -> { email, used: boolean }
    this.resetTokens = new Map();
    // Map of sessionId -> session object
    this.sessions = new Map([
      ["sess_admin_1", { id: "sess_admin_1", userId: "u_admin", device: "Desktop Chrome (Demo)", createdAt: new Date().toISOString(), current: true }],
      ["sess_admin_2", { id: "sess_admin_2", userId: "u_admin", device: "Mobile Safari (Demo)", createdAt: new Date().toISOString(), current: false }],
      ["sess_member_1", { id: "sess_member_1", userId: "u_member", device: "Desktop Firefox (Demo)", createdAt: new Date().toISOString(), current: true }]
    ]);

    this.currentSessionId = "sess_admin_1";
  }

  /**
   * Logs out the current session.
   */
  async logout() {
    if (this.currentSessionId) {
      this.sessions.delete(this.currentSessionId);
      this.currentSessionId = null;
    }
    return { ok: true };
  }

  /**
   * Authenticates identity credentials against demo fixtures.
   */
  async authenticate(identity, password) {
    const normalizedIdentity = String(identity ?? "").trim().toLowerCase();
    const user = this.users.find((u) => u.email.toLowerCase() === normalizedIdentity);
    if (!user || user.password !== password) {
      return { ok: false, error: "Invalid email or password." };
    }
    if (!user.active) {
      return { ok: false, error: "This account has been deactivated." };
    }
    if (!user.verified) {
      return { ok: false, error: "Identity verification required.", unverified: true, email: user.email };
    }

    const sessionId = `sess_${user.id}_${Date.now().toString(36)}`;
    this.sessions.set(sessionId, {
      id: sessionId,
      userId: user.id,
      device: "Current Browser (Demo)",
      createdAt: new Date().toISOString(),
      current: true
    });
    this.currentSessionId = sessionId;

    return {
      ok: true,
      sessionId,
      principal: {
        actor: user.actor ?? "users",
        id: user.id,
        roles: [...(user.roles ?? [])]
      }
    };
  }

  /**
   * Registers a new user account in unverified status.
   */
  async register(name, email, password, confirmPassword) {
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    if (!name || !normalizedEmail || !password) {
      return { ok: false, error: "All fields are required." };
    }
    if (password !== confirmPassword) {
      return { ok: false, error: "Passwords do not match." };
    }
    if (this.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      return { ok: false, error: "An account with this email already exists." };
    }

    const id = `u_${Date.now().toString(36)}`;
    const newUser = {
      id,
      name: String(name).trim(),
      email: normalizedEmail,
      password,
      roles: ["member"], // Never allow self-registration as admin
      actor: "users",
      verified: false,
      active: true
    };
    this.users.push(newUser);

    const verificationCode = "123456"; // Deterministic demo verification code
    this.pendingVerifications.set(normalizedEmail, verificationCode);

    return {
      ok: true,
      email: normalizedEmail,
      verificationRequired: true,
      demoVerificationCode: verificationCode
    };
  }

  /**
   * Verifies an unverified account using demo verification code.
   */
  async verifyIdentity(email, code) {
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const expected = this.pendingVerifications.get(normalizedEmail);
    if (!expected || String(code).trim() !== expected) {
      return { ok: false, error: "Invalid or expired verification code." };
    }

    const user = this.users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (!user) {
      return { ok: false, error: "User not found." };
    }

    user.verified = true;
    this.pendingVerifications.delete(normalizedEmail);

    return {
      ok: true,
      principal: {
        actor: user.actor ?? "users",
        id: user.id,
        roles: [...(user.roles ?? [])]
      }
    };
  }

  /**
   * Initiates password recovery. Always returns generic success to prevent identity enumeration.
   */
  async requestPasswordReset(email) {
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const user = this.users.find((u) => u.email.toLowerCase() === normalizedEmail);
    let resetToken = null;

    if (user) {
      resetToken = `rst_${Date.now().toString(36)}`;
      this.resetTokens.set(resetToken, { email: normalizedEmail, used: false });
    }

    return {
      ok: true,
      message: "If an account exists for this email, password reset instructions have been sent.",
      demoResetToken: resetToken // Exposed only in demo adapter for automated tests & inspection
    };
  }

  /**
   * Resets password using single-use reset token.
   */
  async resetPassword(token, newPassword, confirmPassword) {
    if (newPassword !== confirmPassword) {
      return { ok: false, error: "Passwords do not match." };
    }
    const tokenRecord = this.resetTokens.get(token);
    if (!tokenRecord || tokenRecord.used) {
      return { ok: false, error: "Invalid or already-used reset token." };
    }

    const user = this.users.find((u) => u.email === tokenRecord.email);
    if (!user) {
      return { ok: false, error: "Account not found." };
    }

    user.password = newPassword;
    tokenRecord.used = true; // Invalidate single-use token

    return {
      ok: true,
      message: "Password reset successfully. You can now sign in with your new password."
    };
  }

  /**
   * Changes password for currently authenticated user.
   */
  async changePassword(userId, currentPassword, newPassword, confirmPassword) {
    const user = this.users.find((u) => u.id === userId);
    if (!user || user.password !== currentPassword) {
      return { ok: false, error: "Current password is incorrect." };
    }
    if (newPassword !== confirmPassword) {
      return { ok: false, error: "New passwords do not match." };
    }
    user.password = newPassword;
    return { ok: true, message: "Password changed successfully." };
  }

  /**
   * Returns active sessions for a user.
   */
  async listSessions(userId) {
    return [...this.sessions.values()]
      .filter((s) => s.userId === userId)
      .map((s) => ({ ...s, current: s.id === this.currentSessionId }));
  }

  /**
   * Revokes a specific session.
   */
  async revokeSession(sessionId) {
    this.sessions.delete(sessionId);
    return { ok: true };
  }

  /**
   * Revokes all other sessions for a user.
   */
  async revokeOtherSessions(userId) {
    for (const [id, s] of this.sessions.entries()) {
      if (s.userId === userId && id !== this.currentSessionId) {
        this.sessions.delete(id);
      }
    }
    return { ok: true };
  }

  /**
   * Switches active principal in demo mode only.
   */
  async switchUser(userId) {
    if (!this.demoMode) {
      return { ok: false, error: "Switch user is only available in development/demo mode." };
    }
    const user = this.users.find((u) => u.id === userId);
    if (!user || !user.active) {
      return { ok: false, error: "Target demo user not found or deactivated." };
    }
    return {
      ok: true,
      principal: {
        actor: user.actor ?? "users",
        id: user.id,
        roles: [...(user.roles ?? [])]
      }
    };
  }

  /**
   * Returns a user by ID (redacting sensitive data).
   */
  async getUser(userId) {
    const user = this.users.find((u) => u.id === userId);
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: [...(user.roles ?? [])],
      actor: user.actor ?? "users",
      verified: Boolean(user.verified),
      active: Boolean(user.active)
    };
  }

  /**
   * Updates user profile (name).
   */
  async updateProfile(userId, updates) {
    const user = this.users.find((u) => u.id === userId);
    if (!user) {
      return { ok: false, error: "User not found." };
    }
    if (updates.name) {
      user.name = String(updates.name).trim();
    }
    return {
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: [...(user.roles ?? [])],
        actor: user.actor ?? "users",
        verified: user.verified,
        active: user.active
      }
    };
  }

  /**
   * Admin: lists all users in the system.
   */
  async listUsers(currentPrincipal) {
    if (!currentPrincipal?.roles?.includes("admin")) {
      return { ok: false, error: "Unauthorized: administrator authority required." };
    }
    return {
      ok: true,
      users: this.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        roles: [...(u.roles ?? [])],
        actor: u.actor ?? "users",
        verified: Boolean(u.verified),
        active: Boolean(u.active)
      }))
    };
  }

  /**
   * Admin user management: updates roles and active status.
   */
  async adminUpdateUser(currentPrincipal, targetUserId, updates) {
    if (!currentPrincipal?.roles?.includes("admin")) {
      return { ok: false, error: "Unauthorized: administrator authority required." };
    }
    const user = this.users.find((u) => u.id === targetUserId);
    if (!user) {
      return { ok: false, error: "User not found." };
    }
    if (updates.roles) user.roles = [...updates.roles];
    if (typeof updates.active === "boolean") user.active = updates.active;
    if (updates.name) user.name = updates.name;

    return {
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: [...(user.roles ?? [])],
        actor: user.actor ?? "users",
        verified: user.verified,
        active: user.active
      }
    };
  }
}
