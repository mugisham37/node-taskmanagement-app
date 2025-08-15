"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ProjectCard } from "./project-card";
import { Button } from "@taskmanagement/ui";
import { Plus, Grid, List } from "lucide-react";

export function ProjectList() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: projects, isLoading, refetch } = trpc.projects.list.useQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-48 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center border rounded-lg">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {projects?.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No projects found</p>
          <Button onClick={() => setShowCreateForm(true)}>
            Create your first project
          </Button>
        </div>
      ) : (
        <div className={
          viewMode === "grid" 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            : "space-y-4"
        }>
          {projects?.map((project) => (
            <ProjectCard 
              key={project.id} 
              project={project} 
              viewMode={viewMode}
              onUpdate={refetch} 
            />
          ))}
        </div>
      )}

      {/* TODO: Add ProjectCreateModal component */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Create New Project</h3>
            <p className="text-gray-600">Project creation form will be implemented here</p>
            <Button 
              className="mt-4" 
              onClick={() => setShowCreateForm(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}