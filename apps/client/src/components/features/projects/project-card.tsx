"use client";

import { Card, CardContent, CardHeader, Button, Badge } from "@taskmanagement/ui";
import { MoreHorizontal, Calendar, Users, CheckCircle } from "lucide-react";
import { type Project } from "@taskmanagement/shared";
import Link from "next/link";

interface ProjectCardProps {
  project: Project;
  viewMode: "grid" | "list";
  onUpdate?: () => void;
}

export function ProjectCard({ project, viewMode, onUpdate }: ProjectCardProps) {
  const getStatusColor = (status: Project["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "on-hold":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      case "archived":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const calculateProgress = () => {
    // TODO: Calculate actual progress from tasks
    return Math.floor(Math.random() * 100);
  };

  const progress = calculateProgress();

  if (viewMode === "list") {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Link href={`/dashboard/projects/${project.id}`}>
                    <h3 className="font-semibold text-gray-900 hover:text-primary cursor-pointer">
                      {project.name}
                    </h3>
                  </Link>
                  {project.description && (
                    <p className="text-sm text-gray-600 mt-1">{project.description}</p>
                  )}
                </div>
                
                <div className="flex items-center gap-4">
                  <Badge className={getStatusColor(project.status)}>
                    {project.status.replace("-", " ")}
                  </Badge>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Users className="w-4 h-4" />
                    <span>{project.memberCount || 0}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <CheckCircle className="w-4 h-4" />
                    <span>{progress}%</span>
                  </div>
                  
                  {project.dueDate && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(project.dueDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Link href={`/dashboard/projects/${project.id}`}>
              <h3 className="font-semibold text-gray-900 hover:text-primary cursor-pointer mb-2">
                {project.name}
              </h3>
            </Link>
            {project.description && (
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{project.description}</p>
            )}
            
            <Badge className={getStatusColor(project.status)}>
              {project.status.replace("-", " ")}
            </Badge>
          </div>
          
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{project.memberCount || 0} members</span>
            </div>
            
            {project.dueDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{new Date(project.dueDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}