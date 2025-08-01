"use client";

import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CloudArrowUpIcon,
  DocumentIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ClockIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

interface FileUpload {
  id: string;
  filename: string;
  file_size: number;
  upload_status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  mock_test_id?: string;
  created_at: string;
  updated_at: string;
  error_message?: string;
}

export default function UploadPage() {
  const { user } = useAuth();
  // @ts-ignore
  const t = useTranslations('Upload');
  const router = useRouter();
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Redirect non-premium users
  useEffect(() => {
    if (user && user.role !== 'ADMIN' && user.role !== 'TEACHER') {
      router.push('/dashboard');
    }
  }, [user, router]);

  const fetchUploads = useCallback(async () => {
    if (!user) {return;}
    
    try {
      const response = await fetch(`/api/mock-tests/upload?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setUploads(data.uploads || []);
      }
    } catch (error) {
      console.error('Error fetching uploads:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!user) {return;}
    
    // Validate file type
    const allowedTypes = ['.pdf', '.docx', '.txt', '.json'];
    const fileExtension = `.${  file.name.split('.').pop()?.toLowerCase()}`;
    
    if (!allowedTypes.includes(fileExtension)) {
      // Please upload a PDF, DOCX, TXT, or JSON file.
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      // File size must be less than 10MB.
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);
      
      const response = await fetch('/api/mock-tests/upload', {
        method: 'POST',
        body: formData
      });
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (response.ok) {
        // @ts-ignore
        const result = await response.json();
        await fetchUploads(); // Refresh the uploads list
        setTimeout(() => {
          setUploadProgress(0);
          setIsUploading(false);
        }, 1000);
      } else {
        await response.json();
        // Upload failed. Please try again.
        setIsUploading(false);
        setUploadProgress(0);
      }
    } catch (error) {
      console.error('Upload error:', error);
      // Upload failed. Please try again.
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteUpload = async (uploadId: string) => {
    if (!confirm('Are you sure you want to delete this upload?')) {return;}
    
    try {
      const response = await fetch(`/api/mock-tests/upload?uploadId=${uploadId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await fetchUploads(); // Refresh the uploads list
      } else {
        await response.json();
        // Failed to delete upload.
      }
    } catch (error) {
      console.error('Delete error:', error);
      // Failed to delete upload.
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'PROCESSING':
        return <ClockIcon className="h-5 w-5 text-yellow-500 animate-spin" />;
      case 'FAILED':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ExclamationTriangleIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'PROCESSING': return 'bg-yellow-100 text-yellow-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!user || (user.role !== 'ADMIN' && user.role !== 'TEACHER')) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            📁 Mock Test File Upload
          </h1>
          <p className="text-xl text-gray-600">
            Upload your test files and let our AI convert them into interactive mock tests
          </p>
        </div>

        {/* Upload Area */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div
            className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
              dragActive
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="file-upload"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileSelect}
              accept=".pdf,.docx,.txt,.json"
              disabled={isUploading}
            />
            
            {isUploading ? (
              <div className="space-y-4">
                <CloudArrowUpIcon className="h-16 w-16 text-purple-500 mx-auto animate-bounce" />
                <div className="space-y-2">
                  <p className="text-lg font-medium text-gray-900">Uploading...</p>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-indigo-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600">{uploadProgress}% complete</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <CloudArrowUpIcon className="h-16 w-16 text-purple-500 mx-auto" />
                <div>
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    Drag and drop your file here, or click to browse
                  </p>
                  <p className="text-sm text-gray-600">
                    Supported formats: PDF, DOCX, TXT, JSON (Max 10MB)
                  </p>
                </div>
                <button
                  type="button"
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-medium rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  Choose File
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Upload History */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <DocumentIcon className="h-6 w-6 mr-2 text-purple-600" />
            Upload History
          </h2>
          
          {uploads.length === 0 ? (
            <div className="text-center py-12">
              <DocumentIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg text-gray-600">No uploads yet</p>
              <p className="text-sm text-gray-500">Upload your first file to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {uploads.map((upload) => (
                <div
                  key={upload.id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        {getStatusIcon(upload.upload_status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          {upload.filename}
                        </h3>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-sm text-gray-500">
                            {(upload.file_size / 1024 / 1024).toFixed(2)} MB
                          </span>
                          <span className="text-sm text-gray-500">
                            {new Date(upload.created_at).toLocaleDateString()}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(upload.upload_status)}`}>
                            {upload.upload_status}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {upload.mock_test_id && upload.upload_status === 'COMPLETED' && (
                        <a
                          href={`/test/${upload.mock_test_id}`}
                          className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 text-sm"
                        >
                          Take Test
                        </a>
                      )}
                      
                      {upload.upload_status !== 'PROCESSING' && (
                        <button
                          onClick={() => handleDeleteUpload(upload.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                          title="Delete upload"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {upload.error_message && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700">{upload.error_message}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}