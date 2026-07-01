import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { toast } from "@/components/ui/sonner";

export type UserRole = "admin" | "member";

type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

type AuthContextType = {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (
    email: string,
    password: string,
    name: string,
    role?: UserRole
  ) => Promise<boolean>;
  changePassword: (
    oldPassword: string,
    newPassword: string
  ) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
};

// API Configuration
// const API_BASE_URL = "http://localhost:3000/api"; // Update with your backend URL
const API_BASE_URL = import.meta.env.VITE_API_URL; 

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Decode the JWT payload (no dependency) and return its `exp` in seconds, or null
// if the token is malformed / has no expiry.
const getTokenExpiry = (token: string): number | null => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    );
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
};

// Read the persisted session, but only trust it while the token is still valid.
// The backend issues a 7-day JWT, so a login keeps the user signed in for a week.
// Once the token expires we clear it and return null, so the user is cleanly sent
// back to login instead of lingering in a broken "logged in" state whose API
// calls all 401.
const readValidSession = (): User | null => {
  try {
    if (typeof window === "undefined") return null;
    const token = localStorage.getItem("authToken");
    const stored = localStorage.getItem("user");
    if (!token || !stored) return null;

    const exp = getTokenExpiry(token);
    if (exp !== null && exp * 1000 <= Date.now()) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      return null;
    }

    return JSON.parse(stored) as User;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Initialise user synchronously from localStorage to avoid a flash redirect
  // (ProtectedRoute or other consumers often read `isAuthenticated` on first render;
  // loading it in `useEffect` is async and causes an initial `false` -> redirect).
  const [user, setUser] = useState<User | null>(() => readValidSession());

  // Re-check the persisted session on mount (e.g. the token expired while the tab
  // was closed) and keep state in sync if another tab changed it.
  useEffect(() => {
    const valid = readValidSession();
    if ((valid?.id ?? null) !== (user?.id ?? null)) {
      setUser(valid);
    }
    // We intentionally run this only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || "Invalid email or password");
        return false;
      }

      const data = await response.json();

      // Store token and user data
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);

      toast.success("Login successful!");
      return true;
    } catch (error) {
      console.error("Login error:", error);
      toast.error("An error occurred during login");
      return false;
    }

    // MOCK IMPLEMENTATION (Remove when backend is ready)
    // const foundUser = mockUsers.find(
    //   (u) => u.email === email && u.password === password
    // );

    // if (foundUser) {
    //   const { password, ...userWithoutPassword } = foundUser;
    //   localStorage.setItem("user", JSON.stringify(userWithoutPassword));
    //   setUser(userWithoutPassword);
    //   toast.success("Login successful!");
    //   return true;
    // }

    // toast.error("Invalid email or password");
    // return false;
  };

  const signup = async (
    email: string,
    password: string,
    name: string
  ): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || "Failed to create account");
        return false;
      }

      const data = await response.json();

      // Store token and user data
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);

      toast.success("Account created successfully!");
      return true;
    } catch (error) {
      console.error("Signup error:", error);
      toast.error("An error occurred during signup");
      return false;
    }

    // MOCK IMPLEMENTATION (Remove when backend is ready)
    // if (mockUsers.some((u) => u.email === email)) {
    //   toast.error("User already exists with this email");
    //   return false;
    // }

    // const newUser = {
    //   id: `${mockUsers.length + 1}`,
    //   email,
    //   password,
    //   name,
    //   country,
    //   role,
    // };

    // mockUsers.push(newUser);

    // const { password: _, ...userWithoutPassword } = newUser;
    // localStorage.setItem("user", JSON.stringify(userWithoutPassword));
    // setUser(userWithoutPassword);

    // toast.success("Account created successfully!");
    // return true;
  };

  const changePassword = async (
    oldPassword: string,
    newPassword: string
  ): Promise<boolean> => {
    if (!user) {
      toast.error("You must be logged in");
      return false;
    }

    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || "Failed to change password");
        return false;
      }

      toast.success("Password changed successfully!");
      return true;
    } catch (error) {
      console.error("Change password error:", error);
      toast.error("An error occurred while changing password");
      return false;
    }

    // MOCK IMPLEMENTATION (Remove when backend is ready)
    // In a real app, verify old password and update to new one
    // const mockUser = mockUsers.find(u => u.email === user.email);
    // if (mockUser && mockUser.password === oldPassword) {
    //   mockUser.password = newPassword;
    //   toast.success("Password changed successfully!");
    //   return true;
    // }

    // toast.error("Current password is incorrect");
    // return false;
  };

  const logout = () => {
    /* ============================================
       BACKEND API CALL (Uncomment when backend is ready)
       ============================================
    // Optional: Call backend logout endpoint if you want to invalidate tokens server-side
    // const token = localStorage.getItem("authToken");
    // if (token) {
    //   fetch(`${API_BASE_URL}/auth/logout`, {
    //     method: "POST",
    //     headers: {
    //       "Authorization": `Bearer ${token}`,
    //     },
    //   }).catch(console.error);
    // }
    ============================================ */

    // Clear local storage
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    setUser(null);
    toast.success("Logged out successfully!");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signup,
        changePassword,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
