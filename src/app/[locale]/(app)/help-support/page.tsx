'use client';

import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, QuestionMarkCircleIcon, ChatBubbleLeftRightIcon, EnvelopeIcon, PhoneIcon } from '@heroicons/react/24/outline';

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: 'general' | 'technical' | 'billing' | 'tests';
}

const faqs: FAQItem[] = [
  {
    id: 1,
    question: "How do I start taking mock tests?",
    answer: "To start taking mock tests, navigate to your dashboard and click on any available test. You can see the duration and number of questions before starting. Simply click 'Start Test' to begin.",
    category: "tests"
  },
  {
    id: 2,
    question: "What's the difference between free and premium accounts?",
    answer: "Free accounts have limited access to mock tests and basic features. Premium accounts get unlimited access to all tests, detailed analytics, priority support, and exclusive study materials.",
    category: "general"
  },
  {
    id: 3,
    question: "How do I activate my premium course?",
    answer: "Go to the 'Activate Course' page from your profile dropdown and enter your activation code. If you don't have a code, you can purchase the full course or contact support.",
    category: "billing"
  },
  {
    id: 4,
    question: "Can I retake a mock test?",
    answer: "Yes! You can retake any mock test as many times as you want. Premium users have unlimited attempts, while free users may have some limitations.",
    category: "tests"
  },
  {
    id: 5,
    question: "How are my test results calculated?",
    answer: "Your test results are calculated based on correct answers, time taken, and difficulty level of questions. You'll see detailed breakdowns in your results page.",
    category: "tests"
  },
  {
    id: 6,
    question: "I'm having trouble logging in. What should I do?",
    answer: "If you're having login issues, try resetting your password first. If the problem persists, clear your browser cache or try a different browser. Contact support if you still can't access your account.",
    category: "technical"
  },
  {
    id: 7,
    question: "How do I change my account settings?",
    answer: "Go to the Settings page from your profile dropdown. There you can update your personal information, notification preferences, language, and theme settings.",
    category: "general"
  },
  {
    id: 8,
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards, PayPal, and bank transfers. All payments are processed securely through our payment partners.",
    category: "billing"
  }
];

export default function HelpSupportPage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'general', label: 'General' },
    { value: 'technical', label: 'Technical' },
    { value: 'billing', label: 'Billing' },
    { value: 'tests', label: 'Tests' }
  ];

  const filteredFAQs = selectedCategory === 'all' 
    ? faqs 
    : faqs.filter(faq => faq.category === selectedCategory);

  const toggleFAQ = (id: number) => {
    setOpenFAQ(openFAQ === id ? null : id);
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    alert('Thank you for your message! We\'ll get back to you within 24 hours.');
    setContactForm({ name: '', email: '', subject: '', message: '' });
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-24 h-24 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <QuestionMarkCircleIcon className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Help & Support
          </h1>
          <p className="text-xl text-gray-600">
            Find answers to common questions or get in touch with our support team
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* FAQ Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-2xl p-8 border border-orange-100">
              <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
                Frequently Asked Questions
              </h2>
              
              {/* Category Filter */}
              <div className="mb-8">
                <label className="block text-lg font-semibold text-gray-700 mb-3">
                  Filter by Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-3 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg"
                >
                  {categories.map(category => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* FAQ Items */}
              <div className="space-y-4">
                {filteredFAQs.map((faq) => (
                  <div key={faq.id} className="border border-orange-200 rounded-2xl overflow-hidden">
                    <button
                      onClick={() => toggleFAQ(faq.id)}
                      className="w-full px-6 py-4 text-left bg-gradient-to-r from-orange-50 to-red-50 hover:from-orange-100 hover:to-red-100 transition-all duration-200 flex items-center justify-between"
                    >
                      <span className="text-lg font-semibold text-gray-900">
                        {faq.question}
                      </span>
                      {openFAQ === faq.id ? (
                        <ChevronUpIcon className="h-6 w-6 text-orange-500" />
                      ) : (
                        <ChevronDownIcon className="h-6 w-6 text-orange-500" />
                      )}
                    </button>
                    
                    <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                      openFAQ === faq.id ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}>
                      <div className="px-6 py-4 bg-white">
                        <p className="text-gray-700 leading-relaxed text-lg">
                          {faq.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Contact Section */}
          <div className="space-y-8">
            {/* Quick Contact */}
            <div className="bg-white rounded-3xl shadow-2xl p-8 border border-orange-100">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                Quick Contact
              </h3>
              
              <div className="space-y-6">
                <div className="flex items-center space-x-4 p-4 bg-orange-50 rounded-xl">
                  <EnvelopeIcon className="h-8 w-8 text-orange-500" />
                  <div>
                    <p className="font-semibold text-gray-900">Email Support</p>
                    <p className="text-gray-600">support@testas.com</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4 p-4 bg-orange-50 rounded-xl">
                  <PhoneIcon className="h-8 w-8 text-orange-500" />
                  <div>
                    <p className="font-semibold text-gray-900">Phone Support</p>
                    <p className="text-gray-600">+1 (555) 123-4567</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4 p-4 bg-orange-50 rounded-xl">
                  <ChatBubbleLeftRightIcon className="h-8 w-8 text-orange-500" />
                  <div>
                    <p className="font-semibold text-gray-900">Live Chat</p>
                    <p className="text-gray-600">Available 9 AM - 6 PM</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-white rounded-3xl shadow-2xl p-8 border border-orange-100">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                Send us a Message
              </h3>
              
              <form onSubmit={handleContactSubmit} className="space-y-6">
                <div>
                  <label className="block text-lg font-semibold text-gray-700 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={contactForm.name}
                    onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                    className="w-full px-4 py-3 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Your full name"
                  />
                </div>
                
                <div>
                  <label className="block text-lg font-semibold text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                    required
                    className="w-full px-4 py-3 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="your.email@example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-lg font-semibold text-gray-700 mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={contactForm.subject}
                    onChange={(e) => setContactForm(prev => ({ ...prev, subject: e.target.value }))}
                    required
                    className="w-full px-4 py-3 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Brief description of your issue"
                  />
                </div>
                
                <div>
                  <label className="block text-lg font-semibold text-gray-700 mb-2">
                    Message
                  </label>
                  <textarea
                    value={contactForm.message}
                    onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                    required
                    rows={4}
                    className="w-full px-4 py-3 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                    placeholder="Please describe your issue in detail..."
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {submitting ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Sending...</span>
                    </div>
                  ) : (
                    'Send Message'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}