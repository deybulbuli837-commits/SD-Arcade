'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Gamepad2, Library, Cloud, Users, AlertTriangle } from 'lucide-react';
import { useSelector } from 'react-redux';

export default function LandingPage() {
  const { isAuthenticated } = useSelector((state) => state.auth);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center max-w-4xl mx-auto mb-16"
      >
        <h1 
          className="text-6xl sm:text-8xl font-black mb-6 neon-text tracking-tighter"
          style={{ textShadow: "4px 4px 0px #bc13fe, 8px 8px 0px #00f3ff" }}
        >
          SD-Arcade
        </h1>
        <p className="text-2xl sm:text-3xl text-gray-300 font-medium mb-10">
          Upload. Play. Continue.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
          <Link href={isAuthenticated ? "/dashboard" : "/register"}>
            <button className="px-8 py-4 bg-transparent neon-border text-white rounded-full font-bold text-lg hover:bg-[#bc13fe] hover:text-white transition-all shadow-[0_0_15px_rgba(188,19,254,0.5)]">
              {isAuthenticated ? 'Go to Dashboard' : 'Get Started'}
            </button>
          </Link>
          {!isAuthenticated && (
            <Link href="/login">
              <button className="px-8 py-4 bg-transparent border border-white/20 text-white rounded-full font-bold text-lg hover:bg-white/10 transition-all">
                Login
              </button>
            </Link>
          )}
        </div>
      </motion.div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl w-full mb-20">
        {[
          { icon: Gamepad2, title: "Browser-Based Retro Gaming", desc: "Play your favorite classics directly in the browser with no downloads required." },
          { icon: Library, title: "Personal Game Library", desc: "Build and organize your personal retro game collection effortlessly." },
          { icon: Cloud, title: "Continue Anywhere", desc: "Your save states and library metadata sync across all your devices seamlessly." },
          { icon: Users, title: "Future Multiplayer Support", desc: "Architecture prepared for upcoming netplay and multiplayer lobbies." }
        ].map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            viewport={{ once: true }}
            className="glass-card p-6 flex flex-col items-center text-center"
          >
            <feature.icon className="w-12 h-12 mb-4 text-[#00f3ff]" />
            <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
            <p className="text-gray-400 text-sm">{feature.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Legal Notice */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="max-w-2xl text-center glass-card p-6 border-yellow-500/30 flex items-center gap-4"
      >
        <AlertTriangle className="w-8 h-8 text-yellow-500 flex-shrink-0" />
        <p className="text-gray-300 text-sm text-left">
          <strong>Legal Notice:</strong> Upload only ROMs you legally own. SD-Arcade does not provide copyrighted game files. All ROMs are stored locally on your device.
        </p>
      </motion.div>
    </div>
  );
}
