"use client";

import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import { DocumentIcon, PlayIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Resource {
  id: string;
  title: string;
  description: string;
  type: 'pdf' | 'video';
  url: string;
}

export default function ResourcesPage() {
  const { user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchResources = async () => {
      if (!user?.id) return;
      
      setIsLoading(true);
      setError('');
      
      try {
        const response = await fetch(`/api/resources?userId=${user.id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch resources');
        }
        
        const data = await response.json();
        setResources(data.resources || []);
      } catch (err) {
        setError('Failed to load resources. Please try again later.');
        console.error('Error fetching resources:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResources();
  }, [user]);

  const openResource = (resource: Resource) => {
    setSelectedResource(resource);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedResource(null);
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Study Resources</h1>
            <p className="text-lg text-gray-600">
              Access comprehensive study materials to help you prepare for the TestAS exam.
            </p>
          </div>
        </div>

        {/* Resources Grid */}
        {resources.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
              <DocumentIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">No resources available</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {resources.map((resource) => (
              <div
                key={resource.id}
                className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200 hover:border-blue-300 transform hover:-translate-y-1"
                onClick={() => openResource(resource)}
              >
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    {resource.type === 'pdf' ? (
                      <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mr-4">
                        <DocumentIcon className="h-6 w-6 text-red-600" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
                        <PlayIcon className="h-6 w-6 text-blue-600" />
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-lg uppercase tracking-wide">
                        {resource.type}
                      </span>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {resource.title}
                  </h3>
                  
                  <p className="text-gray-600 text-sm line-clamp-3 mb-4">
                    {resource.description}
                  </p>
                  
                  <div className="flex justify-end">
                    <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center">
                      View {resource.type === 'pdf' ? 'Document' : 'Video'} <span className="ml-1">→</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {isModalOpen && selectedResource && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              {/* Background overlay */}
              <div 
                className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                onClick={closeModal}
              ></div>

              {/* Modal panel */}
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {selectedResource.title}
                    </h3>
                    <button
                      onClick={closeModal}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                  
                  <div className="mt-4">
                    {selectedResource.type === 'pdf' ? (
                      <div className="w-full h-96 border border-gray-300 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <DocumentIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                          <p className="text-gray-500">PDF Viewer</p>
                          <p className="text-sm text-gray-400 mt-2">
                            PDF content would be displayed here using react-pdf
                          </p>
                          {/* Note: In a real implementation, you would use react-pdf here */}
                          <iframe 
                            src={selectedResource.url} 
                            className="w-full h-64 mt-4 border border-gray-300 rounded"
                            title={selectedResource.title}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full">
                        <video 
                          controls 
                          className="w-full h-64 bg-black rounded-lg"
                          src={selectedResource.url}
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4">
                    <p className="text-gray-600 text-sm">
                      {selectedResource.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}