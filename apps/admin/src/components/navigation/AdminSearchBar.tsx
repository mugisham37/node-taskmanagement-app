'use client';

import { Combobox } from '@headlessui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid';
import { useState } from 'react';

interface SearchResult {
  id: string;
  title: string;
  type: 'user' | 'setting' | 'page';
  href: string;
}

export function AdminSearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  // Mock search results - in real app, this would call an API
  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    // Mock search results
    const mockResults: SearchResult[] = [
      { id: '1', title: 'User Management', type: 'page', href: '/admin/users' },
      { id: '2', title: 'System Settings', type: 'setting', href: '/admin/settings/system' },
      { id: '3', title: 'Analytics Dashboard', type: 'page', href: '/admin/analytics' },
      { id: '4', title: 'John Doe', type: 'user', href: '/admin/users/1' },
    ].filter(item => 
      item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    setResults(mockResults);
  };

  return (
    <div className="flex flex-1">
      <Combobox>
        <div className="relative w-full">
          <MagnifyingGlassIcon
            className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-admin-secondary-400"
            aria-hidden="true"
          />
          <Combobox.Input
            className="block h-full w-full border-0 py-0 pl-8 pr-0 text-admin-secondary-900 placeholder:text-admin-secondary-400 focus:ring-0 sm:text-sm"
            placeholder="Search users, settings, pages..."
            onChange={(event) => handleSearch(event.target.value)}
            value={query}
          />
          
          {results.length > 0 && (
            <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
              {results.map((result) => (
                <Combobox.Option
                  key={result.id}
                  value={result}
                  className={({ active }) =>
                    `relative cursor-default select-none py-2 pl-3 pr-9 ${
                      active ? 'bg-admin-primary-600 text-white' : 'text-admin-secondary-900'
                    }`
                  }
                >
                  {({ active }) => (
                    <div className="flex items-center">
                      <span className={`block truncate ${active ? 'font-semibold' : 'font-normal'}`}>
                        {result.title}
                      </span>
                      <span className={`ml-2 truncate text-xs ${
                        active ? 'text-admin-primary-200' : 'text-admin-secondary-500'
                      }`}>
                        {result.type}
                      </span>
                    </div>
                  )}
                </Combobox.Option>
              ))}
            </Combobox.Options>
          )}
        </div>
      </Combobox>
    </div>
  );
}