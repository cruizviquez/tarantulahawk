import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Plus, ArrowLeft, Target, Activity, Brain, Award, Check, X, MessageSquare } from 'lucide-react';

export default function VynlPlatform() {
  const [screen, setScreen] = useState('landing');
  
  const roiData = [
    { name: 'W1', predicted: 2.8, actual: 3.1 },
    { name: 'W2', predicted: 3.5, actual: 3.8 },
    { name: 'W3', predicted: 4.0, actual: 4.2 },
    { name: 'W4', predicted: 4.2, actual: 4.8 },
  ];

  if (screen === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <nav className="bg-black bg-opacity-30 backdrop-blur-lg border-b border-cyan-500/20">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">VYNL</div>
              <div className="text-xs text-cyan-400">BETA</div>
            </div>
            <button className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-pink-500 rounded-lg text-white font-medium">Start Free Trial</button>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <div className="inline-block px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-400 text-sm mb-6">
            Powered by Reinforcement Learning AI
          </div>
          
          <h1 className="text-6xl font-bold text-white mb-6 leading-tight">
            Test Your Influencer Strategy<br />
            <span className="bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">Before Spending a Dollar</span>
          </h1>
          
          <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto">
            The only platform that predicts ROI, simulates what-if scenarios, and auto-optimizes campaigns in real-time.
          </p>

          <div className="flex justify-center space-x-4 mb-16">
            <button onClick={() => setScreen('dashboard')} className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white font-medium text-lg">
              Brand Dashboard
            </button>
            <button onClick={() => setScreen('comparison')} className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg text-white font-medium text-lg">
              See Comparison
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
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-900/50 border border-cyan-500/20 rounded-xl p-4">
                <div className="text-cyan-400 text-sm mb-1">ROI</div>
                <div className="text-3xl font-bold text-white">4.2x</div>
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
                  <div className="text-gray-300 text-sm mb-2">Viral post detected. Sentiment 92% positive.</div>
                  <div className="bg-green-500/20 border border-green-500/40 rounded-lg p-3 text-sm">
                    <div className="text-green-400 font-medium">Increase budget $2.4K for $9.8K ROI boost</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'dashboard') {
    return (
      <div className="min-h-screen bg-slate-900">
        <nav className="bg-slate-800 border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">VYNL</div>
            <div className="flex items-center space-x-6">
              <button onClick={() => setScreen('landing')} className="text-gray-400 hover:text-white text-sm">Home</button>
              <button onClick={() => setScreen('createCampaign')} className="bg-gradient-to-r from-cyan-500 to-pink-500 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                <Plus size={20} /> New Campaign
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
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 cursor-pointer hover:border-cyan-500/50" onClick={() => setScreen('campaign')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">S</div>
                  <div>
                    <div className="text-white font-medium">Summer Collection 2025</div>
                    <div className="text-gray-400 text-sm">Fashion Campaign</div>
                  </div>
                </div>
                <div className="flex space-x-8">
                  <div>
                    <div className="text-gray-400 text-xs">Budget</div>
                    <div className="text-lg font-bold text-white">$15K</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">ROI</div>
                    <div className="text-lg font-bold text-cyan-400">3.8x</div>
                  </div>
                </div>
                <div className="px-3 py-1 bg-green-500/20 rounded-full text-green-400 text-xs">Active</div>
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

  if (screen === 'createCampaign') {
    return (
      <div className="min-h-screen bg-slate-900">
        <nav className="bg-slate-800 border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">VYNL</div>
            <button onClick={() => setScreen('dashboard')} className="text-gray-400 hover:text-white text-sm">Dashboard</button>
          </div>
        </nav>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <button onClick={() => setScreen('dashboard')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6">
            <ArrowLeft size={20} /> Back
          </button>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8">
            <h2 className="text-3xl font-bold text-white mb-2">Create New Campaign</h2>
            <p className="text-gray-400 mb-8">AI will match optimal influencers</p>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Campaign Name</label>
                <input type="text" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white" placeholder="Summer Collection" />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Budget</label>
                  <input type="number" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white" placeholder="15000" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Duration</label>
                  <select className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white">
                    <option>1 month</option>
                    <option>3 months</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Target Audience</label>
                <input type="text" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white" placeholder="Women 25-35" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Industry</label>
                <select className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white">
                  <option>Fashion</option>
                  <option>Beauty</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Min Engagement Rate</label>
                <input type="number" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white" placeholder="3.5" step="0.1" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Follower Range</label>
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white" placeholder="10000" />
                  <input type="number" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white" placeholder="500000" />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button className="flex-1 bg-gradient-to-r from-cyan-500 to-pink-500 text-white py-3 rounded-lg font-semibold">Find Matching Influencers</button>
                <button onClick={() => setScreen('dashboard')} className="px-6 bg-slate-700 text-white py-3 rounded-lg font-semibold">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'campaign') {
    return (
      <div className="min-h-screen bg-slate-900">
        <nav className="bg-slate-800 border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">VYNL</div>
            <button onClick={() => setScreen('dashboard')} className="text-gray-400 hover:text-white text-sm">Dashboard</button>
          </div>
        </nav>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <button onClick={() => setScreen('dashboard')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6">
            <ArrowLeft size={20} /> Back
          </button>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-white">Summer Collection 2025</h1>
                <p className="text-gray-400">Fashion Campaign</p>
              </div>
              <span className="px-3 py-1 bg-green-500/20 rounded-full text-green-400 text-sm">Active</span>
            </div>
            <div className="grid grid-cols-4 gap-6 mt-6">
              <div>
                <p className="text-gray-400 text-sm">Budget</p>
                <p className="text-2xl font-bold text-white">$15,000</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Spent</p>
                <p className="text-2xl font-bold text-white">$8,400</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Remaining</p>
                <p className="text-2xl font-bold text-white">$6,600</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">ROI</p>
                <p className="text-2xl font-bold text-cyan-400">3.8x</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl">
              <p className="text-gray-400 text-sm">Reach</p>
              <p className="text-3xl font-bold text-white">847K</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl">
              <p className="text-gray-400 text-sm">Engagement</p>
              <p className="text-3xl font-bold text-white">4.2%</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl">
              <p className="text-gray-400 text-sm">Sentiment</p>
              <p className="text-3xl font-bold text-white">92/100</p>
            </div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold text-white">Campaign Influencers</h2>
            </div>
            <div className="p-6">
              <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 cursor-pointer hover:border-cyan-500/50" onClick={() => setScreen('influencerProfile')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">FJ</div>
                    <div>
                      <div className="text-white font-medium">@fashionista_jane</div>
                      <div className="text-gray-400 text-sm">245K followers</div>
                    </div>
                  </div>
                  <div className="flex gap-8">
                    <div>
                      <div className="text-gray-400 text-xs">Cost</div>
                      <div className="text-white font-semibold">$2,100</div>
                    </div>
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-sm">Excellent</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'influencerProfile') {
    return (
      <div className="min-h-screen bg-slate-900">
        <nav className="bg-slate-800 border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">VYNL</div>
            <button onClick={() => setScreen('campaign')} className="text-gray-400 hover:text-white text-sm">Back</button>
          </div>
        </nav>
        <div className="max-w-5xl mx-auto px-4 py-8">
          <button onClick={() => setScreen('campaign')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6">
            <ArrowLeft size={20} /> Back to Campaign
          </button>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8">
            <div className="flex gap-6 mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-pink-400 to-purple-600 rounded-full flex items-center justify-center text-white text-4xl font-bold">FJ</div>
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">@fashionista_jane</h1>
                <p className="text-gray-400 mb-3">Fashion Influencer</p>
                <div className="flex gap-4 text-sm text-gray-300">
                  <span className="font-semibold">245K followers</span>
                  <span>4.8% engagement</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg text-white border-b border-slate-700 pb-2">Profile</h3>
                <div>
                  <p className="text-sm text-gray-400">Platform</p>
                  <p className="font-medium text-white">Instagram</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Location</p>
                  <p className="font-medium text-white">Los Angeles</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Audience</p>
                  <p className="font-medium text-white">Women 25-34</p>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="font-semibold text-lg text-white border-b border-slate-700 pb-2">ML Metrics</h3>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Brand Affinity</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-700 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{width: '92%'}}></div>
                    </div>
                    <span className="text-white text-sm">92</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Historical ROI</p>
                  <p className="font-medium text-green-400">4.2x</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Sentiment</p>
                  <span className="text-green-400">78% Positive</span>
                </div>
              </div>
            </div>
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <MessageSquare className="text-blue-400 mt-1" size={20} />
                <div>
                  <p className="font-semibold text-blue-300 mb-1">AI Sentiment Feature</p>
                  <p className="text-sm text-blue-200">Analyzes comments using NLP to predict campaign success and identify risks in real-time.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'comparison') {
    return (
      <div className="min-h-screen bg-slate-900">
        <nav className="bg-slate-800 border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">VYNL</div>
            <button onClick={() => setScreen('landing')} className="text-gray-400 hover:text-white text-sm">Home</button>
          </div>
        </nav>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-white mb-8">Platform Comparison</h1>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
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
                  <td className="py-4 px-4 text-white">Pricing</td>
                  <td className="py-4 px-4 text-center text-gray-400">$30K+/yr</td>
                  <td className="py-4 px-4 text-center text-gray-400">$35K+/yr</td>
                  <td className="py-4 px-4 text-center text-cyan-400 font-medium">$299/mo</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return null;
}