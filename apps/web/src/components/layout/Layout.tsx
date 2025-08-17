'use client';

import { cn } from '@/utils/cn';
import { useState } from 'react';
import { Footer } from './Footer';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  showFooter?: boolean;
  className?: string;
}

export function Layout({ 
  children, 
  showSidebar = true, 
  showFooter = true,
  className 
}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {showSidebar && (
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      )}
      
      <div className={cn(showSidebar ? 'lg:pl-72' : '', 'flex flex-col min-h-screen')}>
        <Header onMenuClick={() => setSidebarOpen(true)} />
        
        <main className={cn('flex-1', className)}>
          {children}
        </main>
        
        {showFooter && <Footer />}
      </div>
    </div>
  );
}