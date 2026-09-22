import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import LoadingOverlay from '../components/loadingOverlay';
import useHospitalSettings from '../hooks/useHospitalSettings';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const { settings } = useHospitalSettings();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const result = await login(email, password);
        setLoading(false);
        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.message);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 sm:p-8">
            {loading && <LoadingOverlay />}


            <div className="max-w-5xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row transform transition-all duration-500 hover:shadow-3xl">
                {/* Left Side: CareFlow EMR Branding (Hidden on small screens) */}
                <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-green-600 via-emerald-700 to-teal-900 p-12 flex-col justify-between relative overflow-hidden text-white">
                    {/* Decorative Background Elements */}
                    <div className="absolute top-0 left-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute bottom-0 right-0 w-80 h-80 bg-green-400 opacity-10 rounded-full translate-x-1/3 translate-y-1/3"></div>

                    {/* Animated gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-green-600/20 via-transparent to-teal-900/20 animate-pulse"></div>

                    <div className="relative z-10 animate-fade-in-up">
                        <h2 className="text-4xl font-extrabold tracking-tight mb-2">
                            MedKare360
                        </h2>
                        <div className="w-16 h-1 bg-green-300 rounded mb-6"></div>
                        <p className="text-lg text-green-100 font-medium leading-relaxed italic">
                            “Connecting Every Point of Patient Care.”
                        </p>
                    </div>

                    <div className="relative z-10 flex justify-center my-8">
                        <img
                            src="/emrlogo.png"
                            alt="EMR Logo"
                            className="h-48 w-auto object-contain drop-shadow-2xl filter brightness-110 contrast-125"
                        />
                    </div>

                    <div className="relative z-10 mt-auto">
                        <p className="text-sm text-green-200 opacity-80">
                            Empowering healthcare professionals with an intuitive, seamless, and secure digital experience.
                        </p>
                    </div>
                </div>

                {/* Right Side: Login Form */}
                <div className="w-full md:w-1/2 p-8 sm:p-12 flex flex-col justify-center bg-white relative">
                    {/* Decorative top border */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-600 via-emerald-500 to-teal-600"></div>

                    <div className="mb-8 text-center">
                        {/* Hospital Branding */}
                        {settings.hospitalLogo ? (
                            <img
                                src={settings.hospitalLogo}
                                alt="Hospital Logo"
                                className="h-20 w-auto mx-auto mb-4 object-contain transition-transform duration-300 hover:scale-105"
                            />
                        ) : (
                            <div className="h-20 w-20 bg-gradient-to-br from-green-100 to-emerald-100 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner transform transition-transform duration-300 hover:scale-105 hover:rotate-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                        )}
                        <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
                            {settings.reportHeader || 'Welcome Back'}
                        </h1>
                        <p className="text-sm text-gray-500 mt-2">Please sign in to your account</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-md animate-pulse">
                            <p className="text-sm text-red-700 font-medium">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-300 shadow-sm hover:shadow-md"
                                placeholder="Enter your email"
                                required
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-semibold text-gray-700">Password</label>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-300 shadow-sm hover:shadow-md"
                                    placeholder="Enter your password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(prev => !prev)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-green-600 transition-colors duration-200"
                                    tabIndex={-1}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3 px-4 flex justify-center items-center rounded-lg text-white font-semibold text-lg transition-all duration-300 shadow-md transform
                        ${loading ? 'bg-green-400 cursor-not-allowed' : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0'}
                    `}
                        >
                            {loading ? (
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                "Sign In"
                            )}
                        </button>
                    </form>

                    {/* Mobile Branding - Centered */}
                    <div className="mt-8 text-center md:hidden">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200"></div>
                            </div>
                            <div className="relative flex justify-center">
                                <span className="px-3 bg-white text-xs text-gray-400 font-medium">
                                    CareFlow<sup>360</sup>
                                </span>
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 font-medium italic mt-4 mb-3">“Connecting Every Point of Patient Care.”</p>
                        <img
                            src="/emrlogo.png"
                            alt="EMR Logo"
                            className="h-14 w-auto mx-auto object-contain opacity-80"
                        />
                    </div>
                </div>
            </div>
        </div>

    );
};

export default Login;
