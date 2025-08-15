"use client";

import { useState } from "react";
import { Bell, Search, Menu } from "lucide-react";
import { Button, Input } from "@taskmanagement/ui";

export function Header() {
  const [showSearch, setShowSearch] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" className="lg:hidden">
            <Menu className="w-5 h-5" />
          </Button>
          
          <div className="hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search tasks, projects..."
                className="pl-10 w-80"
              />
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="md:hidden"
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
              3
            </span>
          </Button>
        </div>
      </div>
      
      {showSearch && (
        <div className="mt-4 md:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search tasks, projects..."
              className="pl-10 w-full"
            />
          </div>
        </div>
      )}
    </header>
  );
}