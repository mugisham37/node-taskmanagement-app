import { appConfig } from '@/config/app'
import { ArrowRightIcon, CheckIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

const features = [
  'Intuitive task management',
  'Real-time collaboration',
  'Project organization',
  'Team productivity insights',
  'Mobile and desktop apps',
  'Secure and reliable',
]

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="relative">
        <nav className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8">
          <div className="flex lg:flex-1">
            <Link href="/" className="-m-1.5 p-1.5">
              <span className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                {appConfig.name}
              </span>
            </Link>
          </div>
          
          <div className="flex lg:flex-1 lg:justify-end gap-4">
            <Link
              href="/login"
              className="text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="btn btn-primary"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main>
        <div className="relative isolate px-6 pt-14 lg:px-8">
          <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
            <div
              className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-brand-400 to-brand-600 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
              style={{
                clipPath:
                  'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
              }}
            />
          </div>
          
          <div className="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
            <div className="text-center">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-6xl">
                Streamline your workflow with modern task management
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400">
                Organize projects, collaborate with teams, and boost productivity with our 
                intuitive task management platform. Built for modern teams who value efficiency.
              </p>
              
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <Link href="/register" className="btn btn-primary btn-lg">
                  Get started for free
                  <ArrowRightIcon className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                >
                  Sign in <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
          
          <div className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]">
            <div
              className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-brand-400 to-brand-600 opacity-20 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]"
              style={{
                clipPath:
                  'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
              }}
            />
          </div>
        </div>

        {/* Features Section */}
        <div className="py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl lg:text-center">
              <h2 className="text-base font-semibold leading-7 text-brand-600 dark:text-brand-400">
                Everything you need
              </h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-4xl">
                Powerful features for modern teams
              </p>
              <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400">
                Our platform provides all the tools you need to manage tasks, 
                collaborate effectively, and deliver projects on time.
              </p>
            </div>
            
            <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24">
              <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
                {features.map((feature) => (
                  <div key={feature} className="relative pl-16">
                    <dt className="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
                      <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600">
                        <CheckIcon className="h-6 w-6 text-white" aria-hidden="true" />
                      </div>
                      {feature}
                    </dt>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-brand-600 dark:bg-brand-700">
          <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Ready to boost your productivity?
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-brand-100">
                Join thousands of teams who trust our platform to manage their projects 
                and collaborate effectively.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <Link
                  href="/register"
                  className="rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-brand-600 shadow-sm hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors"
                >
                  Get started
                </Link>
                <Link
                  href="/login"
                  className="text-sm font-semibold leading-6 text-white hover:text-brand-100 transition-colors"
                >
                  Learn more <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-6 py-12 md:flex md:items-center md:justify-between lg:px-8">
          <div className="flex justify-center space-x-6 md:order-2">
            <Link
              href="/privacy"
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
            >
              Terms
            </Link>
          </div>
          <div className="mt-8 md:order-1 md:mt-0">
            <p className="text-center text-xs leading-5 text-gray-500 dark:text-gray-400">
              &copy; 2024 {appConfig.name}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}