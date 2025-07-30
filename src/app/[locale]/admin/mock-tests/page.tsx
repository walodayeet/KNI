'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Button from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Users, 
  BookOpen, 
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Target,
  BarChart3,
  Download,
  RefreshCw
} from 'lucide-react';

interface MockTest {
  id: string;
  title: string;
  description?: string;
  subject_area: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  duration: number;
  total_questions: number;
  passing_score: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  created_at: string;
  updated_at: string;
  _count: {
    mock_test_attempts: number;
  };
}

interface PremiumCode {
  id: string;
  code: string;
  is_used: boolean;
  used_by_user_id?: string;
  used_at?: string;
  created_at: string;
  expires_at?: string;
  user?: {
    name?: string;
    email: string;
  };
}

interface Analytics {
  totalTests: number;
  totalAttempts: number;
  totalUsers: number;
  averageScore: number;
  passRate: number;
  popularSubjects: Array<{ subject: string; count: number }>;
  difficultyDistribution: Array<{ difficulty: string; count: number }>;
  recentActivity: Array<{
    id: string;
    user_email: string;
    test_title: string;
    score: number;
    completed_at: string;
  }>;
}

export default function AdminMockTestsPage() {
  const router = useRouter();
  const [mockTests, setMockTests] = useState<MockTest[]>([]);
  const [premiumCodes, setPremiumCodes] = useState<PremiumCode[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedTab, setSelectedTab] = useState('tests');
  
  // Form states
  const [showCreateTest, setShowCreateTest] = useState(false);
  const [showCreateCodes, setShowCreateCodes] = useState(false);
  const [newTest, setNewTest] = useState({
    title: '',
    description: '',
    subject_area: '',
    difficulty: 'MEDIUM' as const,
    duration: 60,
    passing_score: 70
  });
  const [codeGeneration, setCodeGeneration] = useState({
    count: 10,
    expires_in_days: 30
  });

  useEffect(() => {
    // Check if user is admin
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    const user = JSON.parse(userData);
    if (user.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }

    fetchData();
  }, [router]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch mock tests
      const testsResponse = await fetch('/api/mock-tests?admin=true');
      const testsData = await testsResponse.json();
      if (testsResponse.ok) {
        setMockTests(testsData.mockTests || []);
      }

      // Fetch premium codes
      const codesResponse = await fetch('/api/premium-codes');
      const codesData = await codesResponse.json();
      if (codesResponse.ok) {
        setPremiumCodes(codesData.codes || []);
      }

      // Fetch analytics
      const analyticsResponse = await fetch('/api/analytics/admin');
      const analyticsData = await analyticsResponse.json();
      if (analyticsResponse.ok) {
        setAnalytics(analyticsData);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTest = async () => {
    try {
      setError('');
      setSuccess('');

      const response = await fetch('/api/mock-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTest)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Mock test created successfully!');
        setShowCreateTest(false);
        setNewTest({
          title: '',
          description: '',
          subject_area: '',
          difficulty: 'MEDIUM',
          duration: 60,
          passing_score: 70
        });
        fetchData();
      } else {
        setError(data.error || 'Failed to create test');
      }
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleGenerateCodes = async () => {
    try {
      setError('');
      setSuccess('');

      const response = await fetch('/api/premium-codes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(codeGeneration)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Generated ${codeGeneration.count} premium codes successfully!`);
        setShowCreateCodes(false);
        fetchData();
      } else {
        setError(data.error || 'Failed to generate codes');
      }
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleDeleteTest = async (testId: string) => {
    if (!confirm('Are you sure you want to delete this test?')) {return;}

    try {
      const response = await fetch(`/api/mock-tests/${testId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setSuccess('Test deleted successfully!');
        fetchData();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete test');
      }
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleUpdateTestStatus = async (testId: string, status: string) => {
    try {
      const response = await fetch('/api/mock-tests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, status })
      });

      if (response.ok) {
        setSuccess('Test status updated successfully!');
        fetchData();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update test status');
      }
    } catch (error: any) {
      setError(error.message);
    }
  };

  const exportCodes = () => {
    const unusedCodes = premiumCodes.filter(code => !code.is_used);
    const csvContent = `Code,Created At,Expires At\n${  
      unusedCodes.map(code => 
        `${code.code},${code.created_at},${code.expires_at || 'Never'}`
      ).join('\n')}`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'premium-codes.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'EASY': return 'bg-green-100 text-green-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'HARD': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'DRAFT': return 'bg-yellow-100 text-yellow-800';
      case 'ARCHIVED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mock Test Administration</h1>
            <p className="text-gray-600 mt-1">Manage tests, premium codes, and view analytics</p>
          </div>
          <Button onClick={() => fetchData()} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Analytics Overview */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <BookOpen className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Tests</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.totalTests}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.totalUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Target className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Attempts</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.totalAttempts}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg Score</p>
                  <p className="text-2xl font-bold text-gray-900">{Math.round(analytics.averageScore)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pass Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{Math.round(analytics.passRate)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="tests">Mock Tests</TabsTrigger>
          <TabsTrigger value="codes">Premium Codes</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="tests">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Mock Tests Management</h2>
              <Button onClick={() => setShowCreateTest(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Test
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {mockTests.map((test) => (
                <Card key={test.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{test.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {test.description || `${test.subject_area} • ${test.total_questions} questions`}
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getDifficultyColor(test.difficulty)}>
                          {test.difficulty}
                        </Badge>
                        <Badge className={getStatusColor(test.status)}>
                          {test.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="w-4 h-4 mr-2" />
                        {test.duration} minutes
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Target className="w-4 h-4 mr-2" />
                        {test.passing_score}% to pass
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Users className="w-4 h-4 mr-2" />
                        {test._count.mock_test_attempts} attempts
                      </div>
                      <div className="text-sm text-gray-600">
                        Created: {formatDate(test.created_at)}
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline">
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button size="sm" variant="outline">
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Select onValueChange={(value) => handleUpdateTestStatus(test.id, value)}>
                        <SelectTrigger className="w-32 h-8">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DRAFT">Draft</SelectItem>
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="ARCHIVED">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDeleteTest(test.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="codes">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Premium Codes Management</h2>
              <div className="flex space-x-2">
                <Button onClick={exportCodes} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export Unused
                </Button>
                <Button onClick={() => setShowCreateCodes(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Generate Codes
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {premiumCodes.map((code) => (
                <Card key={code.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4">
                          <code className="bg-gray-100 px-2 py-1 rounded font-mono text-sm">
                            {code.code}
                          </code>
                          <Badge className={code.is_used ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                            {code.is_used ? 'Used' : 'Available'}
                          </Badge>
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                          Created: {formatDate(code.created_at)}
                          {code.expires_at && ` • Expires: ${formatDate(code.expires_at)}`}
                          {code.is_used && code.user && ` • Used by: ${code.user.email}`}
                          {code.used_at && ` • Used on: ${formatDate(code.used_at)}`}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          {analytics && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Detailed Analytics</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Popular Subjects</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.popularSubjects.map((subject, index) => (
                        <div key={index} className="flex justify-between items-center">
                          <span className="font-medium">{subject.subject}</span>
                          <span className="text-gray-600">{subject.count} tests</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Difficulty Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.difficultyDistribution.map((diff, index) => (
                        <div key={index} className="flex justify-between items-center">
                          <Badge className={getDifficultyColor(diff.difficulty)}>
                            {diff.difficulty}
                          </Badge>
                          <span className="text-gray-600">{diff.count} tests</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.recentActivity.map((activity) => (
                      <div key={activity.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{activity.user_email}</p>
                          <p className="text-sm text-gray-600">{activity.test_title}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{activity.score}%</p>
                          <p className="text-sm text-gray-600">{formatDate(activity.completed_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Test Modal */}
      {showCreateTest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Create New Mock Test</CardTitle>
              <CardDescription>
                Create a new mock test template. Questions will be added separately.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Test Title</Label>
                  <Input
                    id="title"
                    value={newTest.title}
                    onChange={(e) => setNewTest(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter test title"
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newTest.description}
                    onChange={(e) => setNewTest(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter test description"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="subject">Subject Area</Label>
                    <Input
                      id="subject"
                      value={newTest.subject_area}
                      onChange={(e) => setNewTest(prev => ({ ...prev, subject_area: e.target.value }))}
                      placeholder="e.g., Mathematics, Science"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="difficulty">Difficulty</Label>
                    <Select onValueChange={(value: any) => setNewTest(prev => ({ ...prev, difficulty: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EASY">Easy</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HARD">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={newTest.duration}
                      onChange={(e) => setNewTest(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="passing_score">Passing Score (%)</Label>
                    <Input
                      id="passing_score"
                      type="number"
                      value={newTest.passing_score}
                      onChange={(e) => setNewTest(prev => ({ ...prev, passing_score: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateTest(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateTest}
                    className="flex-1"
                  >
                    Create Test
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Generate Codes Modal */}
      {showCreateCodes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Generate Premium Codes</CardTitle>
              <CardDescription>
                Generate new premium codes for distribution.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="count">Number of Codes</Label>
                  <Input
                    id="count"
                    type="number"
                    value={codeGeneration.count}
                    onChange={(e) => setCodeGeneration(prev => ({ ...prev, count: parseInt(e.target.value) }))}
                    min="1"
                    max="100"
                  />
                </div>
                
                <div>
                  <Label htmlFor="expires">Expires in (days)</Label>
                  <Input
                    id="expires"
                    type="number"
                    value={codeGeneration.expires_in_days}
                    onChange={(e) => setCodeGeneration(prev => ({ ...prev, expires_in_days: parseInt(e.target.value) }))}
                    min="1"
                    placeholder="Leave empty for no expiration"
                  />
                </div>
                
                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateCodes(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleGenerateCodes}
                    className="flex-1"
                  >
                    Generate
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}