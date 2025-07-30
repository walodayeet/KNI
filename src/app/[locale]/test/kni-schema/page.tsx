'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Loading from '@/components/ui/Loading';

interface SchemaTestResult {
  success: boolean;
  message: string;
  timestamp: string;
  schema?: {
    name: string;
    exists: boolean;
    tableCount: number;
    tables: string[];
  };
  coreTableCounts?: {
    users: number;
    sessions: number;
    test_questions: number;
    test_templates: number;
    test_results: number;
  };
  sampleData?: {
    question: any;
  };
  prismaClient?: {
    connected: boolean;
    multiSchemaEnabled: boolean;
  };
  error?: string;
}

interface CreateQuestionData {
  question: string;
  options: string[];
  correct_answer: string;
  subject_area: string;
  difficulty: string;
}

export default function KNISchemaTestPage() {
  const [testResult, setTestResult] = useState<SchemaTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newQuestion, setNewQuestion] = useState<CreateQuestionData>({
    question: 'What is 2 + 2?',
    options: ['3', '4', '5', '6'],
    correct_answer: '4',
    subject_area: 'MATHEMATICS',
    difficulty: 'easy'
  });

  const testKNISchema = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test/kni-schema');
      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Failed to test KNI schema',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const createSampleQuestion = async () => {
    setCreating(true);
    try {
      const response = await fetch('/api/test/kni-schema', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newQuestion),
      });
      const data = await response.json();
      
      if (data.success) {
        // Refresh the test results to show the new question
        await testKNISchema();
      } else {
        // Failed to create question
      }
    } catch (error) {
      // Error creating question
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    testKNISchema();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-orange-50 to-red-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-block mb-4 px-6 py-2 bg-orange-100 text-orange-600 text-sm font-semibold rounded-full uppercase tracking-wider">
            Database Testing
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            KNI Schema Connection Test<span className="text-orange-500">.</span>
          </h1>
          <p className="text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
            Testing the connection to the KNI database schema to ensure optimal TestAS preparation experience.
          </p>
        </div>
        
        <div className="bg-white shadow-2xl rounded-3xl overflow-hidden border border-gray-100">

          <div className="p-8">
            <div className="flex gap-6 mb-8">
              <Button
                onClick={testKNISchema}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold text-base shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {loading ? <Loading size="sm" /> : '🔄'} Test Schema Connection
              </Button>
            </div>

            {testResult && (
              <div className="space-y-8">
                {/* Status Card */}
                <div className={`p-6 rounded-2xl border-l-8 shadow-lg transition-all duration-200 hover:shadow-xl ${
                  testResult.success 
                    ? 'bg-green-50 border-green-500' 
                    : 'bg-red-50 border-red-500'
                }`}>
                  <div className="flex items-center">
                    <span className="text-4xl mr-4">
                      {testResult.success ? '✅' : '❌'}
                    </span>
                    <div>
                      <h3 className={`font-bold text-xl ${
                        testResult.success ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {testResult.message}
                      </h3>
                      <p className="text-base text-gray-600 mt-1">
                        {new Date(testResult.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {testResult.error && (
                    <div className="mt-4 p-4 bg-red-100 rounded-lg text-red-700 text-base border border-red-200">
                      <strong>Error:</strong> {testResult.error}
                    </div>
                  )}
                </div>

                {testResult.success && testResult.schema && (
                  <>
                    {/* Schema Information */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-200 shadow-lg">
                      <h3 className="font-bold text-xl text-gray-800 mb-4">📊 Schema Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <p className="text-base"><strong className="text-blue-700">Schema Name:</strong> <span className="font-mono bg-white px-2 py-1 rounded">{testResult.schema.name}</span></p>
                          <p className="text-base"><strong className="text-blue-700">Exists:</strong> <span className={`font-semibold ${testResult.schema.exists ? 'text-green-600' : 'text-red-600'}`}>{(() => {
                            if (testResult.schema.exists) {return 'Yes';}
                            return 'No';
                          })()}</span></p>
                          <p className="text-base"><strong className="text-blue-700">Total Tables:</strong> <span className="font-semibold text-indigo-600">{testResult.schema.tableCount}</span></p>
                        </div>
                        <div className="space-y-3">
                          <p className="text-base"><strong className="text-blue-700">Prisma Connected:</strong> <span className={`font-semibold ${testResult.prismaClient?.connected ? 'text-green-600' : 'text-red-600'}`}>{(() => {
                            if (testResult.prismaClient?.connected) {return 'Yes';}
                            return 'No';
                          })()}</span></p>
                          <p className="text-base"><strong className="text-blue-700">Multi-Schema:</strong> <span className={`font-semibold ${testResult.prismaClient?.multiSchemaEnabled ? 'text-green-600' : 'text-orange-600'}`}>{(() => {
                            if (testResult.prismaClient?.multiSchemaEnabled) {return 'Enabled';}
                            return 'Disabled';
                          })()}</span></p>
                        </div>
                      </div>
                    </div>

                    {/* Core Tables */}
                    {testResult.coreTableCounts && (
                      <div className="bg-gradient-to-r from-orange-50 to-red-50 p-6 rounded-2xl border border-orange-200 shadow-lg">
                        <h3 className="font-bold text-xl text-gray-800 mb-4">🎯 Core KNI Tables</h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          {Object.entries(testResult.coreTableCounts).map(([table, count]) => (
                            <div key={table} className="text-center p-4 bg-white rounded-xl border-2 border-orange-100 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105">
                              <div className="text-3xl font-bold text-orange-600 mb-2">{count}</div>
                              <div className="text-sm font-semibold text-gray-700 capitalize">{table.replace('_', ' ')}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* All Tables */}
                    {testResult.schema.tables && testResult.schema.tables.length > 0 && (
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-semibold text-gray-800 mb-3">📋 All Tables in KNI Schema</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {testResult.schema.tables.map((table) => (
                            <div key={table} className="p-2 bg-white rounded border text-sm">
                              {table}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sample Data */}
                    {testResult.sampleData?.question && (
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-semibold text-gray-800 mb-3">📝 Sample Question Data</h3>
                        <div className="bg-white p-4 rounded border">
                          <p><strong>ID:</strong> {testResult.sampleData.question.id}</p>
                          <p><strong>Question:</strong> {testResult.sampleData.question.question}</p>
                          <p><strong>Subject Area:</strong> {testResult.sampleData.question.subject_area}</p>
                          <p><strong>Difficulty:</strong> {testResult.sampleData.question.difficulty}</p>
                          <p><strong>Created:</strong> {new Date(testResult.sampleData.question.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    )}

                    {/* Create Sample Question */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-2xl border border-green-200 shadow-lg">
                      <h3 className="font-bold text-xl text-gray-800 mb-4">➕ Create Sample Question</h3>
                      <div className="space-y-6">
                        <div>
                          <label className="block text-base font-semibold text-gray-700 mb-2">
                            Question
                          </label>
                          <input
                            type="text"
                            value={newQuestion.question}
                            onChange={(e) => setNewQuestion({...newQuestion, question: e.target.value})}
                            className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="block text-base font-semibold text-gray-700 mb-2">
                              Subject Area
                            </label>
                            <select
                              value={newQuestion.subject_area}
                              onChange={(e) => setNewQuestion({...newQuestion, subject_area: e.target.value})}
                              className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200"
                            >
                              <option value="MATHEMATICS">Mathematics</option>
                              <option value="LOGIC">Logic</option>
                              <option value="LANGUAGE">Language</option>
                              <option value="SCIENCE">Science</option>
                              <option value="GENERAL">General</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-base font-semibold text-gray-700 mb-2">
                              Difficulty
                            </label>
                            <select
                              value={newQuestion.difficulty}
                              onChange={(e) => setNewQuestion({...newQuestion, difficulty: e.target.value})}
                              className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200"
                            >
                              <option value="easy">Easy</option>
                              <option value="medium">Medium</option>
                              <option value="hard">Hard</option>
                            </select>
                          </div>
                        </div>
                        <Button
                          onClick={createSampleQuestion}
                          disabled={creating}
                          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold text-base shadow-lg hover:shadow-xl transition-all duration-200"
                        >
                          {creating ? <Loading size="sm" /> : '➕'} Create Sample Question
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}