"use client";

import React, { useState, useEffect } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { useRealtimeContext, RealtimeConnectionStatus, PresenceIndicator, TypingIndicator } from "@/components/providers/realtime-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function RealtimeDemo() {
  const {
    isConnected,
    connectionStats,
    connectionStatus,
    joinRoom,
    leaveRoom,
    joinProject,
    leaveProject,
    updatePresence,
    setStatus,
    currentUser,
    presenceUsers,
    getPresenceInRoom,
    startTyping,
    stopTyping,
    optimisticTaskUpdate,
    addEventListener,
    removeEventListener,
  } = useRealtime();

  const { reconnect } = useRealtimeContext();

  const [currentRoom, setCurrentRoom] = useState("");
  const [projectId, setProjectId] = useState("");
  const [message, setMessage] = useState("");
  const [events, setEvents] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Listen for real-time events
  useEffect(() => {
    const handleCustomEvent = (event: any) => {
      setEvents(prev => [...prev.slice(-9), event]); // Keep last 10 events
    };

    // Listen to various event types
    const eventTypes = [
      'task:created',
      'task:updated',
      'task:deleted',
      'project:created',
      'project:updated',
      'project:deleted',
      'user:joined',
      'user:left',
      'user_typing',
      'user_stopped_typing',
      'presence_update',
    ];

    eventTypes.forEach(eventType => {
      addEventListener(eventType, handleCustomEvent);
    });

    return () => {
      eventTypes.forEach(eventType => {
        removeEventListener(eventType, handleCustomEvent);
      });
    };
  }, [addEventListener, removeEventListener]);

  const handleJoinRoom = () => {
    if (currentRoom.trim()) {
      joinRoom(currentRoom.trim());
      setCurrentRoom("");
    }
  };

  const handleLeaveRoom = (roomId: string) => {
    leaveRoom(roomId);
  };

  const handleJoinProject = () => {
    if (projectId.trim()) {
      joinProject(projectId.trim());
      setProjectId("");
    }
  };

  const handleLeaveProject = (projectId: string) => {
    leaveProject(projectId);
  };

  const handleStatusChange = (status: 'online' | 'away' | 'busy' | 'offline') => {
    setStatus(status);
  };

  const handleStartTyping = () => {
    if (!isTyping) {
      startTyping('demo-channel');
      setIsTyping(true);
    }
  };

  const handleStopTyping = () => {
    if (isTyping) {
      stopTyping('demo-channel');
      setIsTyping(false);
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    
    if (e.target.value && !isTyping) {
      handleStartTyping();
    } else if (!e.target.value && isTyping) {
      handleStopTyping();
    }
  };

  const handleOptimisticUpdate = () => {
    const taskId = `task-${Date.now()}`;
    const updates = {
      title: `Updated task at ${new Date().toLocaleTimeString()}`,
      status: 'in-progress',
      updatedAt: new Date(),
    };
    
    optimisticTaskUpdate(taskId, updates);
  };

  const roomUsers = currentRoom ? getPresenceInRoom(currentRoom) : [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Real-time Features Demo</h1>
        <RealtimeConnectionStatus />
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
          <CardDescription>Real-time connection information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm font-medium">Status</div>
              <Badge variant={isConnected ? "default" : "destructive"}>
                {connectionStatus.status}
              </Badge>
            </div>
            <div>
              <div className="text-sm font-medium">Quality</div>
              <Badge variant="outline">{connectionStatus.quality}</Badge>
            </div>
            <div>
              <div className="text-sm font-medium">Messages Sent</div>
              <div className="text-lg font-semibold">{connectionStats?.messagesSent || 0}</div>
            </div>
            <div>
              <div className="text-sm font-medium">Messages Received</div>
              <div className="text-lg font-semibold">{connectionStats?.messagesReceived || 0}</div>
            </div>
          </div>
          
          {!isConnected && (
            <Button onClick={reconnect} variant="outline">
              Reconnect
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Current User */}
      <Card>
        <CardHeader>
          <CardTitle>Current User</CardTitle>
        </CardHeader>
        <CardContent>
          {currentUser ? (
            <div className="flex items-center gap-4">
              <PresenceIndicator userId={currentUser.id} />
              <div>
                <div className="font-medium">{currentUser.name}</div>
                <div className="text-sm text-gray-500">{currentUser.email}</div>
                <div className="text-sm text-gray-500">Status: {currentUser.status}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleStatusChange('online')}>Online</Button>
                <Button size="sm" onClick={() => handleStatusChange('away')}>Away</Button>
                <Button size="sm" onClick={() => handleStatusChange('busy')}>Busy</Button>
              </div>
            </div>
          ) : (
            <div className="text-gray-500">No user information available</div>
          )}
        </CardContent>
      </Card>

      {/* Room Management */}
      <Card>
        <CardHeader>
          <CardTitle>Room Management</CardTitle>
          <CardDescription>Join and leave real-time rooms</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Room ID"
              value={currentRoom}
              onChange={(e) => setCurrentRoom(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
            />
            <Button onClick={handleJoinRoom} disabled={!currentRoom.trim()}>
              Join Room
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Input
              placeholder="Project ID"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinProject()}
            />
            <Button onClick={handleJoinProject} disabled={!projectId.trim()}>
              Join Project
            </Button>
          </div>

          {roomUsers.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Users in current room:</div>
              <div className="flex flex-wrap gap-2">
                {roomUsers.map(user => (
                  <div key={user.id} className="flex items-center gap-2 p-2 bg-gray-100 rounded">
                    <PresenceIndicator userId={user.id} />
                    <span className="text-sm">{user.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Presence Users */}
      <Card></Card>     <CardHeader>
          <CardTitle>Online Users</CardTitle>
          <CardDescription>Currently online users</CardDescription>
        </CardHeader>
        <CardContent>
          {presenceUsers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {presenceUsers.map(user => (
                <div key={user.id} className="flex items-center gap-3 p-3 border rounded">
                  <PresenceIndicator userId={user.id} />
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.status}</div>
                    {user.lastSeen && (
                      <div className="text-xs text-gray-400">
                        Last seen: {user.lastSeen.toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500">No other users online</div>
          )}
        </CardContent>
      </Card>

      {/* Typing Demo */}
      <Card>
        <CardHeader>
          <CardTitle>Typing Indicator Demo</CardTitle>
          <CardDescription>Test typing indicators</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Type something to trigger typing indicator..."
            value={message}
            onChange={handleMessageChange}
            onBlur={handleStopTyping}
          />
          <TypingIndicator channel="demo-channel" />
        </CardContent>
      </Card>

      {/* Optimistic Updates */}
      <Card>
        <CardHeader>
          <CardTitle>Optimistic Updates</CardTitle>
          <CardDescription>Test optimistic updates with conflict resolution</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleOptimisticUpdate}>
            Send Optimistic Task Update
          </Button>
        </CardContent>
      </Card>

      {/* Event Log */}
      <Card>
        <CardHeader>
          <CardTitle>Real-time Events</CardTitle>
          <CardDescription>Recent real-time events received</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {events.map((event, index) => (
                <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{event.type}</Badge>
                    <span className="text-xs text-gray-500">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {event.data && (
                    <pre className="mt-1 text-xs text-gray-600 overflow-x-auto">
                      {JSON.stringify(event.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500">No events received yet</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}