"use client";

import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';

interface Question {
  id: string;
  text: string;
  options: string[];
}

interface Test {
  id: string;
  title: string;
  description: string;
  questions: Question[];
}

export default function MockTestPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [test, setTest] = useState<Test | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchMockTests = async () => {
      if (!user?.id) return;
      
      setIsLoading(true);
      setError('');
      
      try {
        const response = await fetch(`/api/mock-tests?userId=${user.id}&userType=${user.user_type}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch mock tests');
        }
        
        const data = await response.json();
        // For now, just take the first available test
        const availableTests = data.mockTests || [];
        if (availableTests.length > 0) {
          // Transform the first test to match the expected format
          const firstTest = availableTests[0];
          const transformedTest = {
            id: firstTest.id,
            title: firstTest.title,
            description: firstTest.description || '',
            questions: firstTest.mock_test_questions?.map((mq: any, index: number) => ({
              id: mq.question.id,
              text: `Sample question ${index + 1}`, // Placeholder - would need actual question text
              options: ['Option A', 'Option B', 'Option C', 'Option D'] // Placeholder
            })) || []
          };
          setTest(transformedTest);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMockTests();
  }, [user]);

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const goToNextQuestion = () => {
    if (test && currentQuestionIndex < test.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const submitTest = async () => {
    if (!test || !user?.id) return;
    
    setIsSubmitting(true);
    
    try {
      // Convert answers to array format expected by API
      const answersArray = test.questions.map(question => ({
        question_id: question.id,
        answer: answers[question.id] || ''
      }));
      
      const response = await fetch(`/api/mock-tests/${test.id}/attempt`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          answers: answersArray,
          status: 'COMPLETED'
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit test');
      }
      
      const result = await response.json();
      
      // Redirect to result page
      router.push(`/result/${result.attempt.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit test');
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <p className="text-gray-500">No test available</p>
        </div>
      </div>
    );
  }

  const currentQuestion = test.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === test.questions.length - 1;
  const answeredQuestions = Object.keys(answers).length;
  const totalQuestions = test.questions.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">{test.title}</h1>
            <p className="text-lg text-gray-600">{test.description}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold text-gray-800">
                Question {currentQuestionIndex + 1} of {totalQuestions}
              </span>
              <span className="text-sm text-gray-500 bg-blue-50 px-3 py-1 rounded-full">
                {Math.round(((currentQuestionIndex + 1) / totalQuestions) * 100)}% Complete
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500"
                style={{
                  width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%`,
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-gray-200">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              {currentQuestion.text}
            </h2>
            {currentQuestion.image && (
              <img
                src={currentQuestion.image}
                alt="Question illustration"
                className="max-w-full h-auto rounded-xl mb-4 shadow-md"
              />
            )}
          </div>

          <div className="space-y-4">
            {currentQuestion.options.map((option, index) => {
              const optionLetter = String.fromCharCode(65 + index); // A, B, C, D
              const isSelected = answers[currentQuestion.id] === option;
              
              return (
                <button
                  key={index}
                  onClick={() => handleAnswerChange(currentQuestion.id, option)}
                  className={`
                    w-full text-left p-5 rounded-xl border-2 transition-all duration-300 transform hover:scale-[1.02]
                    ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-md'
                        : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-25 hover:shadow-md'
                    }
                  `}
                >
                  <div className="flex items-center">
                    <span className={`
                      inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold mr-4
                      ${
                        isSelected
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }
                    `}>
                      {optionLetter}
                    </span>
                    <span className="text-gray-900 text-lg">{option}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
          <div className="flex justify-between items-center">
            <button
              onClick={goToPreviousQuestion}
              disabled={currentQuestionIndex === 0}
              className="flex items-center px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
            >
              <ChevronLeftIcon className="h-5 w-5 mr-2" />
              Previous
            </button>

            <div className="flex space-x-2">
              {test.questions.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentQuestionIndex(index)}
                  className={`
                    w-12 h-12 rounded-xl text-sm font-bold transition-all duration-200 transform hover:scale-105
                    ${
                      index === currentQuestionIndex
                        ? 'bg-blue-600 text-white shadow-lg'
                        : answers[test.questions[index].id]
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            {isLastQuestion ? (
              <button
                onClick={submitTest}
                disabled={isSubmitting || answeredQuestions < totalQuestions}
                className="flex items-center px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  'Finish & Submit Test'
                )}
              </button>
            ) : (
              <button
                onClick={goToNextQuestion}
                className="flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-medium shadow-lg"
              >
                Next
                <ChevronRightIcon className="h-5 w-5 ml-2" />
              </button>
            )}
          </div>
        </div>

        {/* Submit Warning */}
        {answeredQuestions < totalQuestions && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              Please answer all questions before submitting the test. 
              You have {totalQuestions - answeredQuestions} unanswered question(s).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}