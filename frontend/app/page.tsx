import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            EHR System
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Medical Marijuana Patient Management System
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/register"
              className="btn-primary text-lg px-8 py-3"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="btn-secondary text-lg px-8 py-3"
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
