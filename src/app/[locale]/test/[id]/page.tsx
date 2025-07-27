'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  ArrowLeft, 
  ArrowRight,
  Flag,
  BookOpen,
  Timer
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
  started_at: string;
  answers: Record<string, string>;
  flagged_questions: string[];
  time_remaining: number;
}

export default function TestPage() {
  const router = useRouter();
  const params = useParams();
  const testId = params.id as string;
  
  // Check if this is a daily test
  const [isDailyTest, setIsDailyTest] = useState(false);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      setIsDailyTest(urlParams.get('daily') === 'true');
    }
  }, []);
  
  const [user, setUser] = useState<any>(null);
  const [mockTest, setMockTest] = useState<MockTest | null>(null);
  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  // Timer effect
  useEffect(() => {
    if (timeRemaining > 0 && !submitting) {
      const timer = setTimeout(() => {
        setTimeRemaining(prev => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            handleSubmitTest(true); // Auto-submit when time runs out
            return 0;
          }
          return newTime;
        });
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [timeRemaining, submitting]);

  // Save progress periodically
  useEffect(() => {
    if (attempt && Object.keys(answers).length > 0) {
      const saveInterval = setInterval(() => {
        saveProgress();
      }, 30000); // Save every 30 seconds
      
      return () => clearInterval(saveInterval);
    }
  }, [attempt, answers]);

  useEffect(() => {
    // Get user from localStorage
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    initializeTest(parsedUser.id);
  }, [testId, router]);

  const initializeTest = async (userId: string) => {
    try {
      setLoading(true);
      setError('');

      // Start or resume test attempt
      const response = await fetch(`/api/mock-tests/${testId}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start test');
      }

      setMockTest(data.mockTest);
      setAttempt(data.attempt);
      setAnswers(data.attempt.answers || {});
      setFlaggedQuestions(new Set(data.attempt.flagged_questions || []));
      setTimeRemaining(data.attempt.time_remaining);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const saveProgress = async () => {
    if (!attempt || !user) return;

    try {
      await fetch(`/api/mock-tests/${testId}/attempt`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: attempt.id,
          answers,
          flaggedQuestions: Array.from(flaggedQuestions),
          timeRemaining
        })
      });
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const toggleFlag = (questionId: string) => {
    setFlaggedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const handleSubmitTest = async (autoSubmit = false) => {
    if (!attempt || !user || submitting) return;

    try {
      setSubmitting(true);
      
      const response = await fetch(`/api/mock-tests/${testId}/attempt`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: attempt.id,
          answers,
          flaggedQuestions: Array.from(flaggedQuestions),
          timeRemaining,
          submit: true,
          autoSubmit,
          isDailyTest
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit test');
      }

      // If this is a daily test, update the daily streak
      if (isDailyTest) {
        try {
          await fetch('/api/daily-mock-test', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              attemptId: attempt.id
            })
          });
        } catch (streakError) {
          console.error('Failed to update daily streak:', streakError);
        }
      }

      // Redirect to results page
      router.push(`/test/${testId}/results?attemptId=${attempt.id}${isDailyTest ? '&daily=true' : ''}`);
    } catch (error: any) {
      setError(error.message);
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeColor = () => {
    const totalTime = mockTest ? mockTest.duration * 60 : 0;
    const percentage = (timeRemaining / totalTime) * 100;
    
    if (percentage <= 10) return 'text-red-600';
    if (percentage <= 25) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressPercentage = () => {
    if (!mockTest) return 0;
    return (Object.keys(answers).length / mockTest.total_questions) * 100;
  };

  const getAnsweredCount = () => {
    return Object.keys(answers).length;
  };

  const getFlaggedCount = () => {
    return flaggedQuestions.size;
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

  const currentQuestion = mockTest.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === mockTest.questions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                onClick={() => router.push('/dashboard')}
                className="p-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{mockTest.title}</h1>
                <p className="text-sm text-gray-600">
                  Question {currentQuestionIndex + 1} of {mockTest.total_questions}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Timer className={`w-5 h-5 ${getTimeColor()}`} />
                <span className={`text-lg font-mono font-bold ${getTimeColor()}`}>
                  {formatTime(timeRemaining)}
                </span>
              </div>
              
              <div className="text-sm text-gray-600">
                <span className="font-medium">{getAnsweredCount()}</span> answered
              </div>
              
              {getFlaggedCount() > 0 && (
                <div className="text-sm text-yellow-600">
                  <span className="font-medium">{getFlaggedCount()}</span> flagged
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-4">
            <Progress value={getProgressPercentage()} className="h-2" />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Question Panel */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">
                      Question {currentQuestionIndex + 1}
                    </CardTitle>
                    {currentQuestion.category && (
                      <CardDescription className="mt-1">
                        Category: {currentQuestion.category}
                      </CardDescription>
                    )}
                  </div>
                  <Button
                    variant={flaggedQuestions.has(currentQuestion.id) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleFlag(currentQuestion.id)}
                  >
                    <Flag className="w-4 h-4 mr-1" />
                    {flaggedQuestions.has(currentQuestion.id) ? 'Flagged' : 'Flag'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-lg leading-relaxed">
                    {currentQuestion.question_text}
                  </div>
                  
                  <RadioGroup
                    value={answers[currentQuestion.id] || ''}
                    onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                    className="space-y-4"
                  >
                    {['A', 'B', 'C', 'D'].map((option) => {
                      const optionText = currentQuestion[`option_${option.toLowerCase()}` as keyof Question] as string;
                      return (
                        <div key={option} className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                          <RadioGroupItem value={option} id={`option-${option}`} className="mt-1" />
                          <Label htmlFor={`option-${option}`} className="flex-1 cursor-pointer text-base leading-relaxed">
                            <span className="font-medium mr-2">{option}.</span>
                            {optionText}
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>
            
            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              <Button
                variant="outline"
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                disabled={isFirstQuestion}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
              
              <div className="flex space-x-4">
                {!isLastQuestion ? (
                  <Button
                    onClick={() => setCurrentQuestionIndex(prev => Math.min(mockTest.questions.length - 1, prev + 1))}
                  >
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => setShowConfirmSubmit(true)}
                    className="bg-green-600 hover:bg-green-700"
                    disabled={submitting}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {submitting ? 'Submitting...' : 'Submit Test'}
                  </Button>
                )}
              </div>
            </div>
          </div>
          
          {/* Question Navigator */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-base">Question Navigator</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2">
                  {mockTest.questions.map((question, index) => {
                    const isAnswered = answers[question.id];
                    const isFlagged = flaggedQuestions.has(question.id);
                    const isCurrent = index === currentQuestionIndex;
                    
                    return (
                      <button
                        key={question.id}
                        onClick={() => setCurrentQuestionIndex(index)}
                        className={`
                          w-10 h-10 text-sm font-medium rounded-lg border-2 transition-colors relative
                          ${isCurrent 
                            ? 'border-blue-500 bg-blue-500 text-white' 
                            : isAnswered 
                              ? 'border-green-500 bg-green-100 text-green-700 hover:bg-green-200' 
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          }
                        `}
                      >
                        {index + 1}
                        {isFlagged && (
                          <Flag className="w-3 h-3 absolute -top-1 -right-1 text-yellow-500 fill-current" />
                        )}
                      </button>
                    );
                  })}
                </div>
                
                <div className="mt-6 space-y-3 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-green-100 border-2 border-green-500 rounded"></div>
                    <span>Answered</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-blue-500 border-2 border-blue-500 rounded"></div>
                    <span>Current</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-white border-2 border-gray-300 rounded"></div>
                    <span>Not answered</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Flag className="w-4 h-4 text-yellow-500" />
                    <span>Flagged</span>
                  </div>
                </div>
                
                <Button
                  onClick={() => setShowConfirmSubmit(true)}
                  className="w-full mt-6 bg-green-600 hover:bg-green-700"
                  disabled={submitting}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Submit Test
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Confirm Submit Modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Submit Test</CardTitle>
              <CardDescription>
                Are you sure you want to submit your test? You won't be able to change your answers after submission.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p>Answered: {getAnsweredCount()} of {mockTest.total_questions} questions</p>
                  <p>Time remaining: {formatTime(timeRemaining)}</p>
                  {getFlaggedCount() > 0 && (
                    <p className="text-yellow-600">Flagged questions: {getFlaggedCount()}</p>
                  )}
                </div>
                
                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowConfirmSubmit(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      setShowConfirmSubmit(false);
                      handleSubmitTest();
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting...' : 'Submit'}
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