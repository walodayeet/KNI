// Images are now referenced directly as strings in src attributes

export default function KNILogo() {
  return (
    <div className="flex items-center space-x-3 pb-4">
      {/* Orange Square (Placeholder for Geometric Pattern) */}
      <img
        src="/images/TestASLogo.png"
        width={48}
        height={48}
        alt="KNI Logo"
        className="hover:opacity-80 transition-opacity"
      />
      {/* Text Section */}
      <div className="flex flex-col">
        <span className="text-2xl font-bold text-gray-800">KNI</span>
        <span className="text-sm text-gray-500">Khanh Nhat Institute</span>
      </div>
    </div>
  );
}