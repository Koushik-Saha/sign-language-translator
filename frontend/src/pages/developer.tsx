'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { 
  Code2, 
  Key, 
  BookOpen, 
  Zap, 
  Shield, 
  BarChart3, 
  Copy, 
  CheckCircle, 
  ExternalLink,
  Play,
  Settings,
  Users,
  Globe,
  Mic,
  Brain
} from 'lucide-react';
import axios from 'axios';

interface ApiKey {
  keyId: string;
  name: string;
  prefix: string;
  permissions: string[];
  environment: string;
  usage: {
    dailyRequests: number;
    totalRequests: number;
    lastUsed?: string;
  };
  quotas: {
    dailyRequests: number;
    monthlyRequests: number;
  };
  createdAt: string;
}

interface UsageStats {
  totalRequests: number;
  successful: number;
  failed: number;
  rateLimited: number;
  endpoints: Record<string, number>;
}

export default function DeveloperPortal() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchApiKeys();
    fetchUsageStats();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const response = await axios.get('/api/api-keys');
      setApiKeys(response.data.data.apiKeys);
    } catch (error) {
      console.error('Error fetching API keys:', error);
    }
  };

  const fetchUsageStats = async () => {
    try {
      // Mock usage stats for now
      setUsageStats({
        totalRequests: 1247,
        successful: 1189,
        failed: 58,
        rateLimited: 12,
        endpoints: {
          '/translate/text-to-sign': 856,
          '/gestures/search': 234,
          '/models/predict': 157
        }
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const codeExamples = {
    curl: `curl -X POST "https://api.signlanguagetranslator.com/api/public/v1/translate/text-to-sign" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Hello, how are you?",
    "targetLibrary": "BSL"
  }'`,
    
    javascript: `const response = await fetch('https://api.signlanguagetranslator.com/api/public/v1/translate/text-to-sign', {
  method: 'POST',
  headers: {
    'X-API-Key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    text: 'Hello, how are you?',
    targetLibrary: 'BSL'
  })
});

const translation = await response.json();
console.log(translation.data.sequence);`,

    python: `import requests

response = requests.post(
    'https://api.signlanguagetranslator.com/api/public/v1/translate/text-to-sign',
    headers={
        'X-API-Key': 'YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'text': 'Hello, how are you?',
        'targetLibrary': 'BSL'
    }
)

translation = response.json()
print(translation['data']['sequence'])`,

    node: `const axios = require('axios');

const translateText = async (text) => {
  try {
    const response = await axios.post(
      'https://api.signlanguagetranslator.com/api/public/v1/translate/text-to-sign',
      {
        text: text,
        targetLibrary: 'BSL'
      },
      {
        headers: {
          'X-API-Key': 'YOUR_API_KEY',
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.data.sequence;
  } catch (error) {
    console.error('Translation failed:', error.response.data);
  }
};

translateText('Hello world').then(console.log);`
  };

  const features = [
    {
      icon: <Globe className="w-6 h-6" />,
      title: 'Multi-Language Support',
      description: 'Support for ASL, BSL, LSF, ISL, and AUSLAN with detailed gesture data'
    },
    {
      icon: <Brain className="w-6 h-6" />,
      title: 'ML-Powered Translation',
      description: 'Advanced machine learning models for accurate sign language translation'
    },
    {
      icon: <Mic className="w-6 h-6" />,
      title: 'Voice Integration',
      description: 'Speech-to-text processing with multi-language support'
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Real-Time Processing',
      description: 'Fast, efficient API responses with sub-second processing times'
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Enterprise Security',
      description: 'API keys, rate limiting, and comprehensive access controls'
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: 'Analytics & Insights',
      description: 'Detailed usage statistics and performance metrics'
    }
  ];

  const endpoints = [
    {
      method: 'POST',
      path: '/v1/translate/text-to-sign',
      description: 'Translate text to sign language sequence'
    },
    {
      method: 'POST',
      path: '/v1/translate/batch',
      description: 'Batch translate multiple texts'
    },
    {
      method: 'GET',
      path: '/v1/gestures/libraries',
      description: 'Get available sign language libraries'
    },
    {
      method: 'GET',
      path: '/v1/gestures/search',
      description: 'Search for specific gestures'
    },
    {
      method: 'POST',
      path: '/v1/gestures/advanced-search',
      description: 'Advanced gesture search with filters'
    },
    {
      method: 'GET',
      path: '/v1/models/available',
      description: 'Get available ML models'
    },
    {
      method: 'POST',
      path: '/v1/models/predict',
      description: 'Get predictions from ML models'
    },
    {
      method: 'POST',
      path: '/v1/voice/process',
      description: 'Process voice input to text'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-blue-600 hover:text-blue-700 font-semibold">
                ← Back to App
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <h1 className="text-xl font-bold text-gray-900">Developer Portal</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link 
                href="/api/public/docs" 
                target="_blank"
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <BookOpen className="w-4 h-4" />
                <span>API Docs</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
              
              <Link 
                href="/dashboard"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: <BookOpen className="w-4 h-4" /> },
              { id: 'quickstart', label: 'Quick Start', icon: <Play className="w-4 h-4" /> },
              { id: 'api-keys', label: 'API Keys', icon: <Key className="w-4 h-4" /> },
              { id: 'usage', label: 'Usage', icon: <BarChart3 className="w-4 h-4" /> },
              { id: 'examples', label: 'Code Examples', icon: <Code2 className="w-4 h-4" /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Hero Section */}
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Sign Language Translation API
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Build inclusive applications with our comprehensive sign language translation API. 
                Convert text to sign language, search gesture libraries, and leverage ML models 
                for accurate real-time translation.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <div key={index} className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="text-blue-600">{feature.icon}</div>
                    <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
                  </div>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              ))}
            </div>

            {/* API Endpoints Overview */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Available Endpoints</h3>
              <div className="space-y-3">
                {endpoints.map((endpoint, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-md ${
                        endpoint.method === 'GET' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {endpoint.method}
                      </span>
                      <code className="text-sm font-mono text-gray-800">{endpoint.path}</code>
                    </div>
                    <p className="text-sm text-gray-600">{endpoint.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'quickstart' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Start Guide</h2>
              <p className="text-gray-600 mb-6">
                Get started with the Sign Language Translation API in just a few steps.
              </p>
            </div>

            {/* Steps */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
                    1
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Create an API Key</h3>
                    <p className="text-gray-600 mb-4">
                      Generate your first API key to authenticate your requests.
                    </p>
                    <button
                      onClick={() => setActiveTab('api-keys')}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Go to API Keys
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
                    2
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Make Your First Request</h3>
                    <p className="text-gray-600 mb-4">
                      Try translating text to sign language with a simple API call.
                    </p>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-green-400"># Try it now</span>
                        <button
                          onClick={() => copyToClipboard(codeExamples.curl, 'quickstart-curl')}
                          className="text-gray-400 hover:text-white"
                        >
                          {copiedCode === 'quickstart-curl' ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <pre className="whitespace-pre-wrap">{codeExamples.curl}</pre>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
                    3
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Explore More Endpoints</h3>
                    <p className="text-gray-600 mb-4">
                      Check out our comprehensive API documentation for all available features.
                    </p>
                    <div className="flex space-x-4">
                      <a
                        href="/api/public/docs"
                        target="_blank"
                        className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
                      >
                        <BookOpen className="w-4 h-4" />
                        <span>API Documentation</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        onClick={() => setActiveTab('examples')}
                        className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        View Code Examples
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'api-keys' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">API Keys</h2>
                <p className="text-gray-600">Manage your API keys and permissions</p>
              </div>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
                <Key className="w-4 h-4" />
                <span>Create New Key</span>
              </button>
            </div>

            {/* API Keys List */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Loading API keys...</p>
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
                <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No API Keys Yet</h3>
                <p className="text-gray-600 mb-4">Create your first API key to start using the API</p>
                <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                  Create API Key
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {apiKeys.map((apiKey) => (
                  <div key={apiKey.keyId} className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{apiKey.name}</h3>
                        <p className="text-gray-600 font-mono text-sm">{apiKey.prefix}•••••••••••••</p>
                        <div className="flex items-center space-x-4 mt-2">
                          <span className={`px-2 py-1 text-xs rounded-md ${
                            apiKey.environment === 'production' 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {apiKey.environment}
                          </span>
                          <span className="text-sm text-gray-500">
                            Created {new Date(apiKey.createdAt).toLocaleDateString()}
                          </span>
                          {apiKey.usage.lastUsed && (
                            <span className="text-sm text-gray-500">
                              Last used {new Date(apiKey.usage.lastUsed).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm text-gray-500 mb-1">
                          {apiKey.usage.dailyRequests} / {apiKey.quotas.dailyRequests} daily
                        </div>
                        <div className="flex space-x-2">
                          <button className="text-gray-400 hover:text-gray-600">
                            <Settings className="w-4 h-4" />
                          </button>
                          <button className="text-blue-600 hover:text-blue-700">
                            <BarChart3 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <div className="flex flex-wrap gap-2">
                        {apiKey.permissions.map((permission, index) => (
                          <span 
                            key={index}
                            className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md"
                          >
                            {permission}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">API Usage</h2>
              <p className="text-gray-600">Monitor your API usage and performance</p>
            </div>

            {usageStats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <BarChart3 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-gray-600">Total Requests</p>
                      <p className="text-2xl font-semibold text-gray-900">{usageStats.totalRequests.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-gray-600">Successful</p>
                      <p className="text-2xl font-semibold text-gray-900">{usageStats.successful.toLocaleString()}</p>
                      <p className="text-xs text-green-600">
                        {((usageStats.successful / usageStats.totalRequests) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <div className="flex items-center">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Users className="w-6 h-6 text-red-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-gray-600">Failed</p>
                      <p className="text-2xl font-semibold text-gray-900">{usageStats.failed.toLocaleString()}</p>
                      <p className="text-xs text-red-600">
                        {((usageStats.failed / usageStats.totalRequests) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <div className="flex items-center">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Shield className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-gray-600">Rate Limited</p>
                      <p className="text-2xl font-semibold text-gray-900">{usageStats.rateLimited.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Endpoint Usage */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Popular Endpoints</h3>
              <div className="space-y-3">
                {usageStats && Object.entries(usageStats.endpoints).map(([endpoint, count]) => (
                  <div key={endpoint} className="flex items-center justify-between">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">{endpoint}</code>
                    <div className="flex items-center space-x-3">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ 
                            width: `${(count / Math.max(...Object.values(usageStats.endpoints))) * 100}%` 
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-12 text-right">
                        {count.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'examples' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Code Examples</h2>
              <p className="text-gray-600">Ready-to-use code snippets for popular programming languages</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Object.entries(codeExamples).map(([language, code]) => (
                <div key={language} className="bg-white rounded-lg shadow-sm border overflow-hidden">
                  <div className="flex items-center justify-between p-4 bg-gray-50 border-b">
                    <h3 className="font-medium text-gray-900 capitalize">
                      {language === 'javascript' ? 'JavaScript (Fetch)' : 
                       language === 'node' ? 'Node.js (Axios)' : 
                       language.charAt(0).toUpperCase() + language.slice(1)}
                    </h3>
                    <button
                      onClick={() => copyToClipboard(code, `example-${language}`)}
                      className="flex items-center space-x-1 text-gray-500 hover:text-gray-700"
                    >
                      {copiedCode === `example-${language}` ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      <span className="text-sm">
                        {copiedCode === `example-${language}` ? 'Copied!' : 'Copy'}
                      </span>
                    </button>
                  </div>
                  <div className="p-4 bg-gray-900 text-gray-100 overflow-x-auto">
                    <pre className="text-sm font-mono whitespace-pre-wrap">{code}</pre>
                  </div>
                </div>
              ))}
            </div>

            {/* SDK Information */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Official SDKs</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">JavaScript/TypeScript</h4>
                  <code className="text-sm bg-gray-900 text-green-400 px-2 py-1 rounded block mb-2">
                    npm install @slt/api-client
                  </code>
                  <p className="text-sm text-gray-600">Full TypeScript support with auto-completion</p>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Python</h4>
                  <code className="text-sm bg-gray-900 text-green-400 px-2 py-1 rounded block mb-2">
                    pip install slt-api-client
                  </code>
                  <p className="text-sm text-gray-600">Async/await support with type hints</p>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Go</h4>
                  <code className="text-sm bg-gray-900 text-green-400 px-2 py-1 rounded block mb-2">
                    go get github.com/slt/go-client
                  </code>
                  <p className="text-sm text-gray-600">Idiomatic Go with full context support</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}