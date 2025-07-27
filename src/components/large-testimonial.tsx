// Images are now referenced directly as strings in src attributes

export default function LargeTestimonial() {
  return (
    <section>
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <div className="py-12 md:py-20">
          <div className="space-y-3 text-center">
            <div className="relative inline-flex">
              <img
                className="rounded-full"
                src="/images/money-back.png"
                width={120}
                height={120}
                alt="Large testimonial"
              />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              “Chúng mình tự tin chất lượng, cam kết hỗ trợ <em className="italic text-gray-500">miễn phí</em> cho đến khi bạn đạt được điểm bạn muốn.{" "}
            </p>
            <div className="text-sm font-medium text-gray-500">
              <span className="text-gray-700">Khánh Nhật</span>{" "}
              <span className="text-gray-400">/</span>{" "}
              <a className="text-orange-500" href="#0">
                CEO at KNI
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
