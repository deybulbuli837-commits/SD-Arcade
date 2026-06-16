'use client';

import Link from 'next/link';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../features/authSlice';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const router = useRouter();

  const handleLogout = async () => {
    await dispatch(logout());
    router.push('/');
  };

  if (!isAuthenticated) return null;

  return (
    <nav className="glass-card border-x-0 border-t-0 rounded-none px-3 sm:px-6 py-4 mb-8 flex justify-between items-center gap-2">
      <Link href="/dashboard" className="shrink-0">
        <h1 
          className="text-2xl sm:text-4xl font-black tracking-tighter whitespace-nowrap neon-text text-white"
          style={{ textShadow: "2px 2px 0px #bc13fe, 4px 4px 0px #00f3ff" }}
        >
          SD-Arcade
        </h1>
      </Link>
      
      <div className="flex items-center gap-2 sm:gap-6">
        <span className="text-gray-300 font-medium text-xs sm:text-base hidden min-[400px]:inline whitespace-nowrap">
          Player: <span className="text-[#00f3ff]">{user?.username}</span>
        </span>
        <Link href="/settings" className="px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm border border-white/20 rounded-lg hover:bg-white/10 transition-colors whitespace-nowrap">
          Settings
        </Link>
        <button 
          onClick={handleLogout}
          className="px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm border border-white/20 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-colors whitespace-nowrap"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
