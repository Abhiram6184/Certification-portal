import React from 'react';
import { User, UserRole } from '../types';
import RockOnIcon from './icons/RockOnIcon';

interface WelcomeBannerProps {
  user: User;
}

const WelcomeBanner: React.FC<WelcomeBannerProps> = ({ user }) => {
  return (
    <div className="bg-red-600 rounded-xl p-8 mb-8 flex flex-col items-center justify-center text-center text-white shadow-lg relative overflow-hidden">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full"></div>
      <div className="absolute -bottom-16 -left-10 w-40 h-40 bg-white/10 rounded-full"></div>
      <div className="bg-white rounded-full p-4 mb-4 shadow-md z-10">
        <RockOnIcon />
      </div>
      <h2 className="text-xl font-light tracking-wider uppercase z-10">Welcome</h2>
      <p className="text-4xl font-bold mt-1 truncate max-w-full z-10">{user.name}</p>
      {user.designation && (
        <p className="text-lg text-white/80 mt-2 z-10">{user.designation}</p>
      )}
      {user.department && (
        <p className="text-md text-white/70 mt-1 z-10">{user.department}</p>
      )}
      {user.id && user.role === UserRole.Employee && (
        <p className="text-sm font-mono bg-white/20 px-2 py-0.5 rounded mt-3 z-10">Emp Code: {user.id}</p>
      )}
    </div>
  );
};

export default WelcomeBanner;