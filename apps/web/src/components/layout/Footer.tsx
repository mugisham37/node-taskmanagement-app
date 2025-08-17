import { cn } from '@/utils/cn';
import Link from 'next/link';

interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={cn(
      'bg-white border-t border-gray-200 px-4 py-6 sm:px-6 lg:px-8',
      className
    )}>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">TM</span>
              </div>
              <span className="text-xl font-semibold text-gray-900">TaskManager</span>
            </div>
            <p className="text-gray-600 text-sm max-w-md">
              Streamline your workflow with our comprehensive task management platform. 
              Built for teams that value productivity and collaboration.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 text-sm transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/tasks" className="text-gray-600 hover:text-gray-900 text-sm transition-colors">
                  Tasks
                </Link>
              </li>
              <li>
                <Link href="/projects" className="text-gray-600 hover:text-gray-900 text-sm transition-colors">
                  Projects
                </Link>
              </li>
              <li>
                <Link href="/team" className="text-gray-600 hover:text-gray-900 text-sm transition-colors">
                  Team
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              Support
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/help" className="text-gray-600 hover:text-gray-900 text-sm transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-600 hover:text-gray-900 text-sm transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-gray-600 hover:text-gray-900 text-sm transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-gray-600 hover:text-gray-900 text-sm transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom section */}
        <div className="mt-8 pt-6 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-gray-500 text-sm">
            © {currentYear} TaskManager Inc. All rights reserved.
          </p>
          <div className="mt-4 sm:mt-0 flex space-x-6">
            <Link href="/status" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">
              System Status
            </Link>
            <Link href="/api-docs" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">
              API Docs
            </Link>
            <span className="text-gray-500 text-sm">v1.0.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
}