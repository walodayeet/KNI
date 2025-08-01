'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Trophy, 
  Clock, 
  Target, 
  CheckCircle, 
  XCircle, 
  ArrowLeft,
  BarChart3,
  BookOpen,
  TrendingUp,
  AlertCircle,
  Star,
  RotateCcw
} from 'lucide-react';

interface Question {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
  category?: string;
  tags?: string[];
}

interface MockTest {
  id: string;
  title: string;
  description?: string;
  subject_area: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  duration: number;
  total_questions: number;
  passing_score: number;
  questions: Question[];
}

interface TestAttempt {
  id: string;
  user_id: string;
  mock_test_id: string;
  started_at: string;
  completed_at: string;
  answers: Record<string, string>;
  score: number;
  percentage: number;
  time_taken: number;
  passed: boolean;
  flagged_questions: string[];
}

interface TestEvaluation {
  id: string;
  attempt_id: string;
  overall_feedback: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  category_breakdown: Record<string, { correct: number; total: number; percentage: number }>;
  difficulty_analysis: Record<string, { correct: number; total: number; percentage: number }>;
}

export default function TestResultsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const testId = params.id as string;
  const attemptId = searchParams.get('attemptId');
  
  const [mockTest, setMockTest] = useState<MockTest | null>(null);
  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [evaluation, setEvaluation] = useState<TestEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    if (!attemptId) {
      setError('No attempt ID provided');
      setLoading(false);
      return;
    }

    fetchResults();
  }, [testId, attemptId]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch test attempt details
      const attemptResponse = await fetch(`/api/mock-tests/${testId}/attempt?attemptId=${attemptId}`);
      const attemptData = await attemptResponse.json();

      if (!attemptResponse.ok) {
        throw new Error(attemptData.error || 'Failed to fetch test results');
      }

      setMockTest(attemptData.mockTest);
      setAttempt(attemptData.attempt);

      // Fetch evaluation if available
      try {
        const evaluationResponse = await fetch(`/api/evaluations?attemptId=${attemptId}`);
        if (evaluationResponse.ok) {
          const evaluationData = await evaluationResponse.json();
          setEvaluation(evaluationData.evaluation);
        }
      } catch (evalError) {
        // No evaluation available yet
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) {return 'text-green-600';}
    if (percentage >= 60) {return 'text-yellow-600';}
    return 'text-red-600';
  };

  const getScoreBadgeColor = (percentage: number) => {
    if (percentage >= 80) {return 'bg-green-100 text-green-800';}
    if (percentage >= 60) {return 'bg-yellow-100 text-yellow-800';}
    return 'bg-red-100 text-red-800';
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'EASY': return 'bg-green-100 text-green-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'HARD': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getQuestionResult = (question: Question) => {
    const userAnswer = attempt?.answers[question.id];
    const isCorrect = userAnswer === question.correct_answer;
    const isFlagged = attempt?.flagged_questions.includes(question.id);
    
    return {
      userAnswer,
      isCorrect,
      isFlagged,
      correctAnswer: question.correct_answer
    };
  };

  const getAnswerText = (question: Question, answer: string) => {
    return question[`option_${answer.toLowerCase()}` as keyof Question] as string;
  };

  const retakeTest = () => {
    router.push(`/test/${testId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/dashboard')} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (!mockTest || !attempt) {
    return null;
  }

  const correctAnswers = Object.entries(attempt.answers).filter(([questionId, answer]) => {
    const question = mockTest.questions.find(q => q.id === questionId);
    return question && answer === question.correct_answer;
  }).length;

  const totalAnswered = Object.keys(attempt.answers).length;
  const unanswered = mockTest.total_questions - totalAnswered;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                onClick={() => router.push('/dashboard')}
                className="p-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Test Results</h1>
                <p className="text-gray-600">{mockTest.title}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Badge className={getDifficultyColor(mockTest.difficulty)}>
                {mockTest.difficulty}
              </Badge>
              <Button onClick={retakeTest} variant="outline">
                <RotateCcw className="w-4 h-4 mr-2" />
                Retake Test
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Score Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2">
            <Card className="text-center">
              <CardHeader>
                <div className="flex items-center justify-center mb-4">
                  {attempt.passed ? (
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                      <Trophy className="w-8 h-8 text-green-600" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                      <Target className="w-8 h-8 text-red-600" />
                    </div>
                  )}
                </div>
                <CardTitle className="text-3xl">
                  <span className={getScoreColor(attempt.percentage)}>
                    {attempt.percentage}%
                  </span>
                </CardTitle>
                <CardDescription className="text-lg">
                  {attempt.passed ? 'Congratulations! You passed!' : 'Keep practicing to improve!'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Your Score</span>
                      <span>{attempt.score} / {mockTest.total_questions}</span>
                    </div>
                    <Progress value={attempt.percentage} className="h-3" />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-green-600">{correctAnswers}</p>
                      <p className="text-sm text-gray-600">Correct</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">{totalAnswered - correctAnswers}</p>
                      <p className="text-sm text-gray-600">Incorrect</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-600">{unanswered}</p>
                      <p className="text-sm text-gray-600">Unanswered</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Time Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Time Taken:</span>
                  <span className="font-medium">{formatTime(attempt.time_taken)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Time Limit:</span>
                  <span className="font-medium">{mockTest.duration} minutes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Completed:</span>
                  <span className="font-medium">{formatDate(attempt.completed_at)}</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="w-5 h-5 mr-2" />
                  Test Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subject:</span>
                  <span className="font-medium">{mockTest.subject_area}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Passing Score:</span>
                  <span className="font-medium">{mockTest.passing_score}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Questions:</span>
                  <span className="font-medium">{mockTest.total_questions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Result:</span>
                  <Badge className={getScoreBadgeColor(attempt.percentage)}>
                    {attempt.passed ? 'PASSED' : 'FAILED'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="questions">Question Review</TabsTrigger>
            {evaluation && <TabsTrigger value="analysis">Detailed Analysis</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {evaluation?.category_breakdown && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2" />
                      Performance by Category
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(evaluation.category_breakdown).map(([category, stats]) => (
                        <div key={category}>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="font-medium">{category}</span>
                            <span>{stats.correct}/{stats.total} ({Math.round(stats.percentage)}%)</span>
                          </div>
                          <Progress value={stats.percentage} className="h-2" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {evaluation?.difficulty_analysis && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <TrendingUp className="w-5 h-5 mr-2" />
                      Performance by Difficulty
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(evaluation.difficulty_analysis).map(([difficulty, stats]) => (
                        <div key={difficulty}>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="font-medium capitalize">{difficulty}</span>
                            <span>{stats.correct}/{stats.total} ({Math.round(stats.percentage)}%)</span>
                          </div>
                          <Progress value={stats.percentage} className="h-2" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="questions">
            <div className="space-y-6">
              {mockTest.questions.map((question, index) => {
                const result = getQuestionResult(question);
                
                return (
                  <Card key={question.id} className={`border-l-4 ${
                    result.isCorrect ? 'border-l-green-500' : 
                    result.userAnswer ? 'border-l-red-500' : 'border-l-gray-300'
                  }`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center">
                            Question {index + 1}
                            {result.isCorrect ? (
                              <CheckCircle className="w-5 h-5 ml-2 text-green-600" />
                            ) : result.userAnswer ? (
                              <XCircle className="w-5 h-5 ml-2 text-red-600" />
                            ) : (
                              <AlertCircle className="w-5 h-5 ml-2 text-gray-400" />
                            )}
                            {result.isFlagged && (
                              <Star className="w-4 h-4 ml-1 text-yellow-500 fill-current" />
                            )}
                          </CardTitle>
                          {question.category && (
                            <CardDescription>Category: {question.category}</CardDescription>
                          )}
                        </div>
                        <Badge className={getScoreBadgeColor(result.isCorrect ? 100 : 0)}>
                          {(() => {
                            if (result.isCorrect) {return 'Correct';}
                            if (result.userAnswer) {return 'Incorrect';}
                            return 'Unanswered';
                          })()}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <p className="text-lg leading-relaxed">{question.question_text}</p>
                        
                        <div className="grid grid-cols-1 gap-3">
                          {['A', 'B', 'C', 'D'].map((option) => {
                            const optionText = getAnswerText(question, option);
                            const isUserAnswer = result.userAnswer === option;
                            const isCorrectAnswer = question.correct_answer === option;
                            
                            let className = 'p-3 border rounded-lg ';
                            if (isCorrectAnswer) {
                              className += 'border-green-500 bg-green-50 text-green-800';
                            } else if (isUserAnswer && !isCorrectAnswer) {
                              className += 'border-red-500 bg-red-50 text-red-800';
                            } else {
                              className += 'border-gray-200 bg-gray-50';
                            }
                            
                            return (
                              <div key={option} className={className}>
                                <div className="flex items-start space-x-3">
                                  <span className="font-medium">{option}.</span>
                                  <span className="flex-1">{optionText}</span>
                                  {isCorrectAnswer && (
                                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                  )}
                                  {isUserAnswer && !isCorrectAnswer && (
                                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {question.explanation && (
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h4 className="font-medium text-blue-900 mb-2">Explanation:</h4>
                            <p className="text-blue-800">{question.explanation}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {evaluation && (
            <TabsContent value="analysis">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Overall Feedback</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 leading-relaxed">{evaluation.overall_feedback}</p>
                  </CardContent>
                </Card>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-green-700">Strengths</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {evaluation.strengths.map((strength, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span>{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-red-700">Areas for Improvement</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {evaluation.weaknesses.map((weakness, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <span>{weakness}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <BookOpen className="w-5 h-5 mr-2" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {evaluation.recommendations.map((recommendation, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-blue-600 text-sm font-medium">{index + 1}</span>
                          </div>
                          <span>{recommendation}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}