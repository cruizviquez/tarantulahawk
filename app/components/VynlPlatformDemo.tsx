import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Target, Zap, DollarSign, Award, Check, X, Activity, Brain, Sparkles } from 'lucide-react';

const VynlPlatform = () => {
  const [view, setView] = useState('landing');

  const roiData = [
    { name: 'W1', predicted: 2.8, actual: 3.1 },
    { name: 'W2', predicted: 3.5, actual: 3.8 },
    { name: 'W3', predicted: 4.0, actual: 4.2 },
    { name: 'W4', predicted: 4.2, actual: 4.8 },
  ];

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <nav className="bg-black bg-opacity-30 backdrop-blur-lg border-b border-cyan-500/20">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
                VYNL
              </div>
              <div className="text-xs text-cyan-400">BETA</div>
            </div>
            <button className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-pink-500 rounded-lg text-white font-medium">
              Start Free Trial
            </button>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <div className="inline-block px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-400 text-sm mb-6">
            Powered by Reinforcement Learning AI
          </div>
          
          <h1 className="text-6xl font-bold text-white mb-6 leading-tight">
            Test Your Influencer Strategy<br />
            <span className="bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
              Before Spending a Dollar
            </span>
          </h1>
          
          <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto">
            The only platform that predicts ROI, simulates what-if scenarios, 
            and auto-optimizes campaigns in real-time.
          </p>

          <div className="flex justify-center space-x-4 mb-16">
            <button 
              onClick={() => setView('brand')}
              className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white font-medium text-lg hover:shadow-2xl transition"
            >
              I'm a Brand
            </button>
            <button 
              onClick={() => setView('influencer')}
              className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg text-white font-medium text-lg hover:shadow-2xl transition"
            >
              I'm an Influencer
            </button>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-lg border border-cyan-500/20 rounded-2xl p-8 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">Campaign: Summer Launch 2025</h3>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-400 text-sm">OPTIMIZING</span>
                </div>
              </div>
              <button 
                onClick={() => setView('comparison')}
                className="px-4 py-2 bg-purple-600/30 border border-purple-500/50 rounded-lg text-purple-300"
              >
                vs Competitors
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-900/50 border border-cyan-500/20 rounded-xl p-4">
                <div className="text-cyan-400 text-sm mb-1">ROI</div>
                <div className="text-3xl font-bold text-white">4.2x</div>
                <div className="text-green-400 text-sm">+12%</div>
              </div>
              <div className="bg-slate-900/50 border border-pink-500/20 rounded-xl p-4">
                <div className="text-pink-400 text-sm mb-1">Reach</div>
                <div className="text-3xl font-bold text-white">342K</div>
              </div>
              <div className="bg-slate-900/50 border border-purple-500/20 rounded-xl p-4">
                <div className="text-purple-400 text-sm mb-1">Engagement</div>
                <div className="text-3xl font-bold text-white">4.2%</div>
              </div>
              <div className="bg-slate-900/50 border border-green-500/20 rounded-xl p-4">
                <div className="text-green-400 text-sm mb-1">Conversions</div>
                <div className="text-3xl font-bold text-white">156</div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-cyan-500/10 to-pink-500/10 border border-cyan-500/30 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <Brain className="text-cyan-400 mt-1" size={20} />
                <div>
                  <div className="text-white font-semibold mb-1">AI Opportunity Detected</div>
                  <div className="text-gray-300 text-sm mb-2">
                    @fitness_sarah viral post. Sentiment 92% positive.
                  </div>
                  <div className="bg-green-500/20 border border-green-500/40 rounded-lg p-3 text-sm">
                    <div className="text-green-400 font-medium">ACTION: Budget +$2.4K ROI +$9.8K</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'brand') {
    return (
      <div className="min-h-screen bg-slate-900">
        <nav className="bg-slate-800 border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
              VYNL
            </div>
            <div className="flex space-x-4">
              <button 
                onClick={() => setView('simulator')}
                className="text-gray-400 hover:text-white text-sm"
              >
                What-If Simulator
              </button>
              <button 
                onClick={() => setView('landing')}
                className="text-gray-400 hover:text-white text-sm"
              >
                Home
              </button>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-4 gap-6 mb-8">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex justify-between mb-4">
                <div className="text-gray-400 text-sm">Active</div>
                <Activity className="text-cyan-400" size={20} />
              </div>
              <div className="text-3xl font-bold text-white">12</div>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex justify-between mb-4">
                <div className="text-gray-400 text-sm">Avg ROI</div>
                <TrendingUp className="text-pink-400" size={20} />
              </div>
              <div className="text-3xl font-bold text-white">4.1x</div>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex justify-between mb-4">
                <div className="text-gray-400 text-sm">Spend</div>
                <DollarSign className="text-purple-400" size={20} />
              </div>
              <div className="text-3xl font-bold text-white">$247K</div>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex justify-between mb-4">
                <div className="text-gray-400 text-sm">Accuracy</div>
                <Target className="text-green-400" size={20} />
              </div>
              <div className="text-3xl font-bold text-white">89%</div>
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-6">Active Campaigns</h2>

            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                    F
                  </div>
                  <div>
                    <div className="text-white font-medium">@fitness_sarah</div>
                    <div className="text-gray-400 text-sm">156K reach</div>
                  </div>
                </div>
                <div className="flex space-x-8">
                  <div>
                    <div className="text-gray-400 text-xs">ROI</div>
                    <div className="text-lg font-bold text-cyan-400">6.2x</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Sentiment</div>
                    <div className="text-lg font-bold text-white">92%</div>
                  </div>
                </div>
                <div className="px-3 py-1 bg-green-500/20 rounded-full text-green-400 text-xs">
                  Hot
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                    Y
                  </div>
                  <div>
                    <div className="text-white font-medium">@yoga_wellness</div>
                    <div className="text-gray-400 text-sm">98K reach</div>
                  </div>
                </div>
                <div className="flex space-x-8">
                  <div>
                    <div className="text-gray-400 text-xs">ROI</div>
                    <div className="text-lg font-bold text-cyan-400">4.1x</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Sentiment</div>
                    <div className="text-lg font-bold text-white">85%</div>
                  </div>
                </div>
                <div className="px-3 py-1 bg-cyan-500/20 rounded-full text-cyan-400 text-xs">
                  Good
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">ROI: Predicted vs Actual</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={roiData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569' }} />
                <Legend />
                <Line type="monotone" dataKey="predicted" stroke="#06B6D4" strokeWidth={2} name="Predicted" strokeDasharray="5 5" />
                <Line type="monotone" dataKey="actual" stroke="#EC4899" strokeWidth={2} name="Actual" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'influencer') {
    return (
      <div className="min-h-screen bg-slate-900">
        <nav className="bg-slate-800 border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
              VYNL
            </div>
            <button 
              onClick={() => setView('landing')}
              className="text-gray-400 hover:text-white text-sm"
            >
              Home
            </button>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/30 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Welcome, Sarah!</h2>
                <p className="text-gray-300">Top 5% of fitness creators</p>
              </div>
              <Award className="text-pink-400" size={48} />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Campaigns</div>
                <div className="text-2xl font-bold text-white">24</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Avg ROI</div>
                <div className="text-2xl font-bold text-pink-400">5.8x</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Earnings</div>
                <div className="text-2xl font-bold text-green-400">$18K</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Bonus</div>
                <div className="text-2xl font-bold text-cyan-400">+$2K</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">Campaign Invitations (12 new)</h2>

            <div className="bg-gradient-to-r from-yellow-500/10 to-emerald-500/10 border-2 border-yellow-500/40 rounded-xl p-6">
              <div className="flex justify-between mb-4">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Sparkles className="text-yellow-400" size={20} />
                    <span className="text-yellow-400 font-bold text-sm">PREMIUM</span>
                  </div>
                  <h3 className="text-xl font-bold text-white">Wellness Brand X</h3>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">$15,000</div>
                  <div className="text-gray-400 text-sm">4 weeks</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="text-gray-400 text-xs">Match</div>
                  <div className="text-lg font-bold text-green-400">96%</div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="text-gray-400 text-xs">Bonus</div>
                  <div className="text-lg font-bold text-cyan-400">+40%</div>
                </div>
              </div>

              <button className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg text-white font-medium">
                Accept Proposal
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'simulator') {
    return (
      <div className="min-h-screen bg-slate-900">
        <nav className="bg-slate-800 border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
              VYNL
            </div>
            <button 
              onClick={() => setView('brand')}
              className="text-gray-400 hover:text-white text-sm"
            >
              Dashboard
            </button>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-white mb-2">What-If Simulator</h1>
          <p className="text-gray-400 mb-8">Compare strategies before launch</p>

          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">15 Micro-Influencers</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-gray-400 text-sm">ROI</div>
                  <div className="text-3xl font-bold text-cyan-400">4.2x</div>
                  <div className="text-gray-400 text-xs mt-1">89% confidence</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Reach</div>
                  <div className="text-white">450K-520K</div>
                </div>
              </div>
              <button className="w-full mt-4 px-4 py-2 bg-cyan-600 rounded-lg text-white">
                Select
              </button>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">3 Macro-Influencers</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-gray-400 text-sm">ROI</div>
                  <div className="text-3xl font-bold text-cyan-400">2.8x</div>
                  <div className="text-gray-400 text-xs mt-1">72% confidence</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Reach</div>
                  <div className="text-white">1.2M-1.5M</div>
                </div>
              </div>
              <button className="w-full mt-4 px-4 py-2 bg-cyan-600 rounded-lg text-white">
                Select
              </button>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">8 Micro + 1 Macro</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-gray-400 text-sm">ROI</div>
                  <div className="text-3xl font-bold text-cyan-400">3.8x</div>
                  <div className="text-gray-400 text-xs mt-1">82% confidence</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Reach</div>
                  <div className="text-white">680K-820K</div>
                </div>
              </div>
              <button className="w-full mt-4 px-4 py-2 bg-cyan-600 rounded-lg text-white">
                Select
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-r from-cyan-500/10 to-pink-500/10 border border-cyan-500/30 rounded-xl p-6">
            <div className="flex items-start space-x-3">
              <Brain className="text-cyan-400 mt-1" size={24} />
              <div>
                <div className="text-white font-bold mb-1">AI Recommendation</div>
                <div className="text-gray-300 text-sm">
                  Strategy A offers best ROI with highest confidence. Lower risk and proven performance.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'comparison') {
    return (
      <div className="min-h-screen bg-slate-900">
        <nav className="bg-slate-800 border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
              VYNL
            </div>
            <button 
              onClick={() => setView('landing')}
              className="text-gray-400 hover:text-white text-sm"
            >
              Home
            </button>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-white mb-8">Platform Comparison</h1>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 overflow-x-auto mb-8">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-4 px-4 text-gray-400">Feature</th>
                  <th className="text-center py-4 px-4 text-gray-400">GRIN</th>
                  <th className="text-center py-4 px-4 text-gray-400">CreatorIQ</th>
                  <th className="text-center py-4 px-4 text-cyan-400 font-bold">VYNL</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-700/50">
                  <td className="py-4 px-4 text-white">ROI Prediction</td>
                  <td className="py-4 px-4 text-center"><X className="inline text-gray-600" size={20} /></td>
                  <td className="py-4 px-4 text-center"><X className="inline text-gray-600" size={20} /></td>
                  <td className="py-4 px-4 text-center"><Check className="inline text-cyan-400" size={20} /></td>
                </tr>
                <tr className="border-b border-slate-700/50">
                  <td className="py-4 px-4 text-white">What-If Scenarios</td>
                  <td className="py-4 px-4 text-center"><X className="inline text-gray-600" size={20} /></td>
                  <td className="py-4 px-4 text-center"><X className="inline text-gray-600" size={20} /></td>
                  <td className="py-4 px-4 text-center"><Check className="inline text-cyan-400" size={20} /></td>
                </tr>
                <tr className="border-b border-slate-700/50">
                  <td className="py-4 px-4 text-white">Auto-Optimization</td>
                  <td className="py-4 px-4 text-center"><X className="inline text-gray-600" size={20} /></td>
                  <td className="py-4 px-4 text-center"><X className="inline text-gray-600" size={20} /></td>
                  <td className="py-4 px-4 text-center"><Check className="inline text-cyan-400" size={20} /></td>
                </tr>
                <tr className="border-b border-slate-700/50">
                  <td className="py-4 px-4 text-white">Pricing</td>
                  <td className="py-4 px-4 text-center text-gray-400 text-sm">$30K+/yr</td>
                  <td className="py-4 px-4 text-center text-gray-400 text-sm">$35K+/yr</td>
                  <td className="py-4 px-4 text-center text-cyan-400 font-medium text-sm">$299/mo</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-gradient-to-r from-cyan-500/10 to-pink-500/10 border border-cyan-500/30 rounded-xl p-6 mb-8">
            <h3 className="text-xl font-bold text-white mb-4">Why VYNL</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-start space-x-3">
                <Target className="text-cyan-400 mt-1" size={24} />
                <div>
                  <div className="text-white font-bold">Predictive</div>
                  <div className="text-gray-300 text-sm">87% accuracy before launch</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Zap className="text-pink-400 mt-1" size={24} />
                <div>
                  <div className="text-white font-bold">Auto-Optimize</div>
                  <div className="text-gray-300 text-sm">24/7 RL optimization</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Brain className="text-purple-400 mt-1" size={24} />
                <div>
                  <div className="text-white font-bold">What-If</div>
                  <div className="text-gray-300 text-sm">Test unlimited strategies</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <DollarSign className="text-green-400 mt-1" size={24} />
                <div>
                  <div className="text-white font-bold">Affordable</div>
                  <div className="text-gray-300 text-sm">10x cheaper</div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <button 
              onClick={() => setView('landing')}
              className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-pink-500 rounded-lg text-white font-medium text-lg"
            >
              Start Free Trial
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default VynlPlatform;