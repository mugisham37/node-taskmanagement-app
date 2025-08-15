import { NextResponse } from 'next/server';

// Simple metrics collection for the client application
export async function GET() {
  try {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Basic Prometheus-style metrics
    const metrics = `
# HELP nodejs_memory_heap_used_bytes Process heap memory used
# TYPE nodejs_memory_heap_used_bytes gauge
nodejs_memory_heap_used_bytes{app="taskmanagement-client"} ${memoryUsage.heapUsed}

# HELP nodejs_memory_heap_total_bytes Process heap memory total
# TYPE nodejs_memory_heap_total_bytes gauge
nodejs_memory_heap_total_bytes{app="taskmanagement-client"} ${memoryUsage.heapTotal}

# HELP nodejs_memory_external_bytes Process external memory
# TYPE nodejs_memory_external_bytes gauge
nodejs_memory_external_bytes{app="taskmanagement-client"} ${memoryUsage.external}

# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds counter
process_uptime_seconds{app="taskmanagement-client"} ${uptime}

# HELP nodejs_version_info Node.js version info
# TYPE nodejs_version_info gauge
nodejs_version_info{app="taskmanagement-client",version="${process.version}"} 1
`.trim();

    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate metrics' },
      { status: 500 }
    );
  }
}