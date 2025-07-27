import Footer from '@/components/ui/footer';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Authentication
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Sign in to your account or create a new one
            </p>
          </div>
          {children}
        </div>
      </div>
      <Footer border={true} />
    </div>
  );
}