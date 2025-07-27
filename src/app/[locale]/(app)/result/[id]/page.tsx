"use client";

import { useAuth } from '@/context/AuthContext';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ArrowLeftIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';
import {routing} from '@/i18n/routing';

interface EvaluationDetail {
  question: string;
  student_answer: string;
  correct_answer: string;
  is_correct: boolean;
  feedback: string;
}

interface TestResult {
  id: string;
  test: {
    title: string;
    description: string;
  };
  score: number;
  overall_feedback: string;
  evaluation_details: EvaluationDetail[];
  submitted_at: string;
}

export default function TestResultPage() {
  const { user } = useAuth();
  const params = useParams();
  const resultId = params.id as string;
  const [result, setResult] = useState<TestResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchResult = async () => {
      const token = localStorage.getItem('testas_token');
      if (!token || !resultId) return;
      
      try {
        const response = await fetch(`https://n8n.phunhuan-ai.com/webhook/testas/results/${resultId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch test result');
        }
        
        const data = await response.json();
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchResult();
  }, [resultId]);

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

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <p className="text-gray-500">Test result not found</p>
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const correctAnswers = result.evaluation_details.filter(detail => detail.is_correct).length;
  const totalQuestions = result.evaluation_details.length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back Button */}
      <div className="mb-6">
        <Link
          href="/my-results"
          className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to My Results
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{result.test.title}</h1>
        <p className="mt-2 text-gray-600">
          Completed on {new Date(result.submitted_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>

      {/* Score Card */}
      <div className={`rounded-lg p-6 mb-8 ${getScoreBgColor(result.score)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <TrophyIcon className={`h-12 w-12 ${getScoreColor(result.score)} mr-4`} />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Your Score</h2>
              <p className="text-gray-600">
                {correctAnswers} out of {totalQuestions} questions correct
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${getScoreColor(result.score)}`}>
              {result.score}%
            </div>
          </div>
        </div>
      </div>

      {/* Overall Feedback */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Feedback</h3>
        <p className="text-gray-700 leading-relaxed">{result.overall_feedback}</p>
      </div>

      {/* Question Details */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">Question-by-Question Review</h3>
        
        {result.evaluation_details.map((detail, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0 mr-3">
                {detail.is_correct ? (
                  <CheckCircleIcon className="h-6 w-6 text-green-500" />
                ) : (
                  <XCircleIcon className="h-6 w-6 text-red-500" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="text-base font-medium text-gray-900 mb-2">
                  Question {index + 1}
                </h4>
                <p className="text-gray-700 mb-4">{detail.question}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <h5 className="text-sm font-medium text-gray-900 mb-1">Your Answer:</h5>
                <p className={`text-sm p-2 rounded ${
                  detail.is_correct 
                    ? 'bg-green-50 text-green-800' 
                    : 'bg-red-50 text-red-800'
                }`}>
                  {detail.student_answer}
                </p>
              </div>
              
              <div>
                <h5 className="text-sm font-medium text-gray-900 mb-1">Correct Answer:</h5>
                <p className="text-sm p-2 rounded bg-green-50 text-green-800">
                  {detail.correct_answer}
                </p>
              </div>
            </div>
            
            {detail.feedback && (
              <div className="border-t border-gray-200 pt-4">
                <h5 className="text-sm font-medium text-gray-900 mb-2">Feedback:</h5>
                <p className="text-sm text-gray-700">{detail.feedback}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-col sm:flex-row gap-4">
        <Link
          href="/mock-test"
          className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Take Another Test
        </Link>
        
        <Link
          href="/resources"
          className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Study Resources
        </Link>
      </div>
    </div>
  );
}