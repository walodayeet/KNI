export default function Footer() {
  return (
    <footer className="bg-white py-8 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 text-center relative">
        {/* Logo */}
        <div className="flex items-center justify-center mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg mr-3 flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z"/>
              <path d="M10 17l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" fill="white"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">KNI Education</h2>
        </div>
        
        {/* Subtitle */}
        <p className="text-gray-600 text-sm mb-6">Khanh Nhat Institute</p>
        
        {/* Copyright */}
        <p className="text-gray-500 text-xs mb-4">
          © KNI.vn - All rights reserved.
        </p>
        
        {/* Large KNI watermark - partially cut off */}
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-3/4 opacity-10 pointer-events-none">
          <div className="text-8xl font-black text-gray-400 tracking-wider filter drop-shadow-2xl">
            KNI
          </div>
        </div>
      </div>
    </footer>
  );
}