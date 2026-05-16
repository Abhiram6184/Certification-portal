import React, { useState, useEffect } from "react";
import { EmployeeRegistrationData } from "../types";
import UserIcon from "./icons/UserIcon";
import Logo from "./Logo";
import { motion, AnimatePresence } from "framer-motion";

interface LoginWithEmailProps {
  onLogin: (email: string) => void;
  onRegister: (formData: EmployeeRegistrationData) => void;
  isRegistration: boolean;
  registrationEmail?: string;
  isLoading: boolean;
  error: string | null;
  onAdminLogin: () => void;
  onBackToLogin: () => void;
  // FIX: Add theme prop to satisfy Logo component requirements
  theme: 'light' | 'dark';
}

const LoginWithEmail = ({
  onLogin,
  onRegister,
  isRegistration,
  registrationEmail,
  isLoading,
  error,
  onAdminLogin,
  onBackToLogin,
  theme,
}: LoginWithEmailProps) => {
  const [view, setView] = useState<"login" | "register">(
    isRegistration ? "register" : "login"
  );
  const [email, setEmail] = useState("");
  const [empCode, setEmpCode] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [designation, setDesignation] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setView(isRegistration ? "register" : "login");
    if (isRegistration && registrationEmail) {
      setEmail(registrationEmail);
    }
  }, [isRegistration, registrationEmail]);

  useEffect(() => {
    setLocalError(null);
  }, [view]);

  const validateRegistration = () => {
    if (!empCode.trim() || !employeeName.trim() || !designation.trim() || !email.trim()) {
      setLocalError("All fields are required.");
      return false;
    }
    if (!email.trim().toLowerCase().endsWith('@celebaltech.com')) {
      setLocalError("Please use a valid @celebaltech.com email for registration.");
      return false;
    }
    return true;
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!email.trim() || !email.toLowerCase().endsWith("@celebaltech.com")) {
      setLocalError("Please enter a valid @celebaltech.com email address.");
      return;
    }
    onLogin(email);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (validateRegistration()) {
      onRegister({
        emp_code: empCode.trim(),
        employee_name: employeeName.trim(),
        designation: designation.trim(),
        email: email.trim(),
        profile_url: profileUrl.trim() || undefined,
      });
    }
  };

  const currentError =
    view === "register" && isRegistration
      ? error
      : view === "login" && !isRegistration
      ? error
      : null;

  const formVariants = {
    hiddenLeft: { x: "-100%", opacity: 0 },
    hiddenRight: { x: "100%", opacity: 0 },
    visible: { x: 0, opacity: 1 },
    exitLeft: { x: "-100%", opacity: 0 },
    exitRight: { x: "100%", opacity: 0 },
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-4xl grid lg:grid-cols-2 rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-slate-700">
        {view === "login" ? (
          <>
            {/* Left: Login Form */}
            <div className="p-8 sm:p-12 bg-white dark:bg-slate-800 flex flex-col h-[640px] relative overflow-hidden">
              <div className="mb-8">
                <div className="flex justify-start">
                  {/* FIX: Pass theme prop to Logo component */}
                  <Logo theme={theme} />
                </div>
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-4">
                    Certification Portal
                  </h1>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Please use your official Celebal Technologies email.
                  </p>
                </div>
              </div>

              <div className="relative flex-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key="login"
                    initial="hiddenLeft"
                    animate="visible"
                    exit="exitRight"
                    variants={formVariants}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                    className="absolute inset-0 flex flex-col"
                  >
                    {(currentError || localError) && (
                      <p className="mb-4 text-sm text-center text-red-600 bg-red-50 dark:bg-red-500/20 dark:text-red-300 p-3 rounded-md">
                        {currentError || localError}
                      </p>
                    )}
                    <form
                      onSubmit={handleLoginSubmit}
                      className="space-y-8 flex-grow flex flex-col justify-center"
                    >
                      <div className="relative">
                        <UserIcon className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          id="email-login"
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-8 py-2 border-b-2 border-gray-300 dark:border-slate-600 focus:border-red-500 focus:outline-none transition-colors bg-transparent text-gray-900 dark:text-gray-100"
                          placeholder="Company Email"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isLoading && view === "login"}
                        className="w-full rounded-md bg-gradient-to-r from-red-500 to-red-600 py-3 px-4 text-lg font-bold text-white shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-300 disabled:opacity-50"
                      >
                        {isLoading && view === "login" ? "Verifying..." : "Login"}
                      </button>
                    </form>
                    <p className="text-center text-gray-700 dark:text-gray-300 mt-auto pt-8">
                      Don't have an account?{" "}
                      <button
                        onClick={() => setView("register")}
                        className="font-semibold text-red-600 hover:underline"
                      >
                        Sign Up
                      </button>
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="text-center mt-4">
                <button
                  onClick={onAdminLogin}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:underline"
                >
                  Admin Login
                </button>
              </div>
            </div>

            {/* Right: Welcome Card */}
            <AnimatePresence mode="wait">
              <motion.div
                key="welcome-login"
                initial={{ x: "100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "-100%", opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                className="hidden lg:flex flex-col items-center justify-center bg-gradient-to-br from-red-600 to-red-800 p-12 text-center"
              >
                <div className="max-w-xs">
                  <h2 className="text-4xl font-bold text-white uppercase tracking-wider">
                    WELCOME BACK!
                  </h2>
                  <p className="mt-4 text-white/80">
                    We are happy to have you with us again. If you need anything,
                    we are here to help.
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </>
        ) : (
          <>
            {/* Left: Welcome Card */}
            <AnimatePresence mode="wait">
              <motion.div
                key="welcome-signup"
                initial={{ x: "-100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "100%", opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                className="hidden lg:flex flex-col items-center justify-center bg-gradient-to-br from-red-600 to-red-800 p-12 text-center"
              >
                <div className="max-w-xs">
                  <h2 className="text-4xl font-bold text-white uppercase tracking-wider">
                    JOIN US!
                  </h2>
                  <p className="mt-4 text-white/80">
                    Create your account and start your journey with Celebal
                    Technologies.
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Right: Register Form */}
            <div className="p-8 sm:p-12 bg-white dark:bg-slate-800 flex flex-col h-[640px] relative overflow-hidden">
              <div className="mb-8">
                <div className="flex justify-start">
                  {/* FIX: Pass theme prop to Logo component */}
                  <Logo theme={theme} />
                </div>
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-4">
                    Certification Portal
                  </h1>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Please use your official Celebal Technologies email.
                  </p>
                </div>
              </div>

              <div className="relative flex-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key="register"
                    initial="hiddenRight"
                    animate="visible"
                    exit="exitLeft"
                    variants={formVariants}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                    className="absolute inset-0 flex flex-col"
                  >
                    {(currentError || localError) && (
                      <p className="mb-4 text-sm text-center text-red-600 bg-red-50 dark:bg-red-500/20 dark:text-red-300 p-3 rounded-md">
                        {currentError || localError}
                      </p>
                    )}
                    <form
                      onSubmit={handleRegisterSubmit}
                      className="space-y-6 flex-grow"
                    >
                      <input
                        type="email"
                        placeholder="Company Email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full py-2 border-b-2 border-gray-300 dark:border-slate-600 focus:border-red-500 focus:outline-none transition-colors bg-transparent text-gray-900 dark:text-gray-100"
                      />
                      <input
                        type="text"
                        placeholder="Employee Name"
                        required
                        value={employeeName}
                        onChange={(e) => setEmployeeName(e.target.value)}
                        className="w-full py-2 border-b-2 border-gray-300 dark:border-slate-600 focus:border-red-500 focus:outline-none transition-colors bg-transparent text-gray-900 dark:text-gray-100"
                      />
                      <input
                        type="text"
                        placeholder="Employee Code"
                        required
                        value={empCode}
                        onChange={(e) => setEmpCode(e.target.value)}
                        className="w-full py-2 border-b-2 border-gray-300 dark:border-slate-600 focus:border-red-500 focus:outline-none transition-colors bg-transparent text-gray-900 dark:text-gray-100"
                      />
                      <input
                        type="text"
                        placeholder="Designation"
                        required
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        className="w-full py-2 border-b-2 border-gray-300 dark:border-slate-600 focus:border-red-500 focus:outline-none transition-colors bg-transparent text-gray-900 dark:text-gray-100"
                      />
                      <input
                        type="url"
                        placeholder="Databricks Credential Wallet URL (Optional)"
                        value={profileUrl}
                        onChange={(e) => setProfileUrl(e.target.value)}
                        className="w-full py-2 border-b-2 border-gray-300 dark:border-slate-600 focus:border-red-500 focus:outline-none transition-colors bg-transparent text-gray-900 dark:text-gray-100"
                      />
                      <button
                        type="submit"
                        disabled={isLoading && view === "register"}
                        className="w-full rounded-md bg-gradient-to-r from-red-500 to-red-600 py-3 px-4 text-lg font-bold text-white shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-300 disabled:opacity-50"
                      >
                        {isLoading && view === "register"
                          ? "Creating Account..."
                          : "Create Account"}
                      </button>
                    </form>
                    <p className="text-center text-gray-700 dark:text-gray-300 mt-auto pt-4">
                      Already have an account?{" "}
                      <button
                        onClick={() => {
                          setView("login");
                          onBackToLogin();
                        }}
                        className="font-semibold text-red-600 hover:underline"
                      >
                        Login
                      </button>
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="text-center mt-4">
                <button
                  onClick={onAdminLogin}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:underline"
                >
                  Admin Login
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginWithEmail;
