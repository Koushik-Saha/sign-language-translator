'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { format } from 'date-fns';
import axios from 'axios';

interface SystemMetrics {
  timestamp: string;
  cpu: number;
  memory: number;
  activeUsers: number;
  responseTime: number;
  errorRate: number;
}

interface AnalyticsData {
  totalSessions: number;
  uniqueUsers: number;
  featureStats: any[];
  translationStats: any[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function PerformanceDashboard() {
  const [metricsData, setMetricsData] = useState<SystemMetrics[]>([]);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('1h');
  const [healthStatus, setHealthStatus] = useState<any>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [healthResponse, analyticsResponse] = await Promise.all([
        axios.get('/api/health'),
        axios.get(`/api/analytics/system?startDate=${getStartDate()}&endDate=${new Date().toISOString()}`)
      ]);
      
      setHealthStatus(healthResponse.data);
      setAnalyticsData(analyticsResponse.data);
      
      // Simulate metrics data for demonstration
      const mockMetrics = generateMockMetrics();
      setMetricsData(mockMetrics);
      
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStartDate = () => {
    const now = new Date();
    const ranges = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };
    return new Date(now.getTime() - ranges[timeRange as keyof typeof ranges]).toISOString();
  };

  const generateMockMetrics = (): SystemMetrics[] => {
    const data: SystemMetrics[] = [];
    const now = new Date();
    const points = 50;
    
    for (let i = points; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60000);
      data.push({
        timestamp: timestamp.toISOString(),
        cpu: Math.random() * 80 + 10,
        memory: Math.random() * 60 + 30,
        activeUsers: Math.floor(Math.random() * 100 + 50),
        responseTime: Math.random() * 500 + 100,
        errorRate: Math.random() * 5
      });
    }
    
    return data;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Performance Dashboard</h1>
        
        <div className="flex gap-4 mb-6">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className="border rounded-lg px-3 py-2 bg-white"
          >
            <option value="1h">Last Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="1d">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
          
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${healthStatus?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium">System Status: {healthStatus?.status}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Active Users</h3>
            <p className="text-3xl font-bold text-blue-600">{healthStatus?.activeUsers || 0}</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Total Sessions</h3>
            <p className="text-3xl font-bold text-green-600">{analyticsData?.totalSessions || 0}</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Unique Users</h3>
            <p className="text-3xl font-bold text-purple-600">{analyticsData?.uniqueUsers || 0}</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Uptime</h3>
            <p className="text-3xl font-bold text-orange-600">
              {healthStatus ? `${Math.floor(healthStatus.uptime / 3600)}h` : '0h'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">System Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metricsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => format(new Date(value), 'HH:mm')}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(value) => format(new Date(value), 'MMM dd, HH:mm')}
              />
              <Legend />
              <Line type="monotone" dataKey="cpu" stroke="#8884d8" name="CPU %" />
              <Line type="monotone" dataKey="memory" stroke="#82ca9d" name="Memory %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Response Time & Users</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={metricsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => format(new Date(value), 'HH:mm')}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(value) => format(new Date(value), 'MMM dd, HH:mm')}
              />
              <Legend />
              <Area type="monotone" dataKey="activeUsers" stackId="1" stroke="#8884d8" fill="#8884d8" name="Active Users" />
              <Area type="monotone" dataKey="responseTime" stackId="2" stroke="#82ca9d" fill="#82ca9d" name="Response Time (ms)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Feature Usage</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData?.featureStats || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="_id" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Translation Types</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analyticsData?.translationStats || []}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ _id, count }) => `${_id}: ${count}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
                nameKey="_id"
              >
                {(analyticsData?.translationStats || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">System Alerts</h3>
          <div className="space-y-3">
            <div className="flex items-center p-3 bg-green-50 rounded border-l-4 border-green-400">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
              <span className="text-sm">All systems operational</span>
            </div>
            <div className="flex items-center p-3 bg-yellow-50 rounded border-l-4 border-yellow-400">
              <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></div>
              <span className="text-sm">High memory usage detected</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              <span className="font-medium">2 min ago:</span> New user registered
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">5 min ago:</span> Translation completed
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">8 min ago:</span> System backup completed
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Export Analytics
            </button>
            <button className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              Generate Report
            </button>
            <button className="w-full px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700">
              System Maintenance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}