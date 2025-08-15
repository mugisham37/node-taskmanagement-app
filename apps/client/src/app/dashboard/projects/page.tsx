"use client";

import { ProjectList } from "@/components/features/projects/project-list";

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
        <p className="text-gray-600">Organize your work into projects</p>
      </div>
      
      <ProjectList />
    </div>
  );
}