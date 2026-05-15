import React, { useState, useEffect } from 'react';
import Logo from './Logo';

interface LoginProps {
    onLogin: (username: string) => void;
    isLoading: boolean;
    error: string | null;
    onAdminLogin: () => void;
    onSwitchToEmail: () => void;
    // FIX: Add theme prop to satisfy Logo component requirements
    theme: 'light' | 'dark';
}

const Login: React.FC<LoginProps> = ({ onLogin, isLoading, error, onAdminLogin, onSwitchToEmail, theme }) => {
    const [username, setUsername] = useState('');
    const [localError, setLocalError] = useState('');
    const [isSignInLoading, setIsSignInLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    // Load saved username when component mounts
    useEffect(() => {
        const savedUsername = localStorage.getItem('rememberedUsername');
        if (savedUsername) {
            setUsername(savedUsername);
            setRememberMe(true);
        }
    }, []);

    useEffect(() => {
        if (error) {
            setLocalError(error);
        }
    }, [error]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim()) {
            setLocalError('Please enter a username.');
            return;
        }
        setIsSignInLoading(true);
        try {
            await onLogin(username.trim());
            
            // Store username if "Remember me" is checked
            if (rememberMe) {
                localStorage.setItem('rememberedUsername', username.trim());
            } else {
                localStorage.removeItem('rememberedUsername');
            }
        } finally {
            setIsSignInLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="w-full max-w-md p-8 space-y-4 bg-white rounded-2xl shadow-2xl border border-gray-200">
                <div className="flex flex-col items-center">
                    {/* FIX: Pass theme prop to Logo component */}
                    <Logo theme={theme} />
                    <h1 className="text-2xl font-bold text-center text-gray-900 mt-4">
                        Certification Portal
                    </h1>
                    <p className="mt-1 text-center text-sm text-gray-500">
                        Sign In with your Databricks Credentials
                    </p>
                </div>

                <form className="space-y-4" onSubmit={handleLogin}>
                    <div>
                        <label htmlFor="username" className="text-sm font-medium text-gray-700">
                            Databricks Username
                        </label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            autoComplete="username"
                            required
                            value={username}
                            onChange={(e) => {
                                setUsername(e.target.value);
                                if (localError) setLocalError('');
                            }}
                            className="mt-1 block w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500 sm:text-sm"
                            placeholder="Enter Accridible Username"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSignInLoading}
                        className="flex w-full justify-center rounded-md border border-transparent bg-red-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {isSignInLoading ? 'Signing In...' : 'Sign In'}
                    </button>

                    <div className="flex items-center">
                        <input
                            id="remember-me"
                            name="remember-me"
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                            Remember me
                        </label>
                    </div>

                    <div className="flex justify-between">
                        <a href="#" className="text-sm text-red-600 hover:text-red-800 hover:underline">
                            Forgot username?
                        </a>
                        <a 
                            href="#" 
                            onClick={(e) => {
                                e.preventDefault();
                                onAdminLogin();
                            }}
                            className="text-sm text-red-600 hover:text-red-800 hover:underline"
                        >
                            Admin Login
                        </a>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">or</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onSwitchToEmail}
                        className="flex w-full justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >
                        Log In with Company Email
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
