import React from 'react';
import { Link } from 'react-router-dom';
import { Play, TrendingUp } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black">
      {/* Hero Section */}
      <section className="relative h-96 bg-cover bg-center flex items-center justify-center"
        style={{
          backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url("https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=1200&h=600&fit=crop")'
        }}>
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-4">Welcome to OTT Platform</h1>
          <p className="text-xl text-slate-300 mb-8">Stream unlimited movies and shows</p>
          <Link
            to="/browse"
            className="inline-flex items-center gap-2 bg-primary hover:bg-indigo-600 text-white px-8 py-3 rounded-lg font-semibold transition"
          >
            <Play size={20} />
            Start Watching
          </Link>
        </div>
      </section>

      {/* Trending Section */}
      <section className="py-12 px-4 md:px-8">
        <div className="flex items-center gap-2 mb-8">
          <TrendingUp className="text-secondary" />
          <h2 className="text-3xl font-bold">Trending Now</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="group cursor-pointer">
              <div className="relative bg-slate-800 rounded-lg overflow-hidden aspect-video mb-4 hover:scale-105 transition">
                <img
                  src={`https://images.unsplash.com/photo-1557${i}00-a49b5ae8c4f?w=400&h=225&fit=crop`}
                  alt={`Trending ${i}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition flex items-center justify-center">
                  <Play className="text-white opacity-0 group-hover:opacity-100 transition" size={48} />
                </div>
              </div>
              <h3 className="font-semibold text-lg">Trending Show {i}</h3>
              <p className="text-sm text-slate-400">Drama • Action</p>
            </div>
          ))}
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-12 px-4 md:px-8 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to Watch?</h2>
        <p className="text-slate-300 mb-8 text-lg">Join millions watching their favorite content</p>
        <div className="flex gap-4 justify-center">
          <Link
            to="/auth/signup"
            className="bg-primary hover:bg-indigo-600 text-white px-8 py-3 rounded-lg font-semibold transition"
          >
            Sign Up Now
          </Link>
          <Link
            to="/browse"
            className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-3 rounded-lg font-semibold transition"
          >
            Browse Content
          </Link>
        </div>
      </section>
    </div>
  );
}
