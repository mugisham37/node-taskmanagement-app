import { DatabaseConnection } from '../connection';
import { FileAttachmentRepository } from '../repositories/file-attachment-repository';
import {
  FileAttachment,
  FileType,
  FileStatus,
} from '../../../domain/entities/file-attachment';

export class FileAttachmentSeeder {
  private fileAttachmentRepository: FileAttachmentRepository;

  constructor(_connection: DatabaseConnection) {
    this.fileAttachmentRepository = new FileAttachmentRepository();
  }

  async seed(
    userIds: string[],
    workspaceIds: string[],
    projectIds: string[],
    taskIds: string[],
    count: number = 150
  ): Promise<FileAttachment[]> {
    const fileAttachments: FileAttachment[] = [];

    const fileTypes = Object.values(FileType);
    const fileStatuses = Object.values(FileStatus);

    const sampleFiles = {
      [FileType.IMAGE]: [
        { name: 'screenshot.png', mime: 'image/png', size: 1024 * 500 },
        { name: 'diagram.jpg', mime: 'image/jpeg', size: 1024 * 800 },
        { name: 'mockup.svg', mime: 'image/svg+xml', size: 1024 * 50 },
        { name: 'logo.png', mime: 'image/png', size: 1024 * 100 },
        { name: 'wireframe.gif', mime: 'image/gif', size: 1024 * 200 },
      ],
      [FileType.DOCUMENT]: [
        {
          name: 'requirements.pdf',
          mime: 'application/pdf',
          size: 1024 * 1024 * 2,
        },
        {
          name: 'specification.docx',
          mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: 1024 * 1024 * 1.5,
        },
        { name: 'notes.txt', mime: 'text/plain', size: 1024 * 50 },
        { name: 'manual.pdf', mime: 'application/pdf', size: 1024 * 1024 * 5 },
        {
          name: 'report.doc',
          mime: 'application/msword',
          size: 1024 * 1024 * 3,
        },
      ],
      [FileType.SPREADSHEET]: [
        {
          name: 'budget.xlsx',
          mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: 1024 * 500,
        },
        { name: 'timeline.csv', mime: 'text/csv', size: 1024 * 100 },
        {
          name: 'data.xls',
          mime: 'application/vnd.ms-excel',
          size: 1024 * 800,
        },
        {
          name: 'metrics.xlsx',
          mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: 1024 * 300,
        },
      ],
      [FileType.PRESENTATION]: [
        {
          name: 'pitch.pptx',
          mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          size: 1024 * 1024 * 10,
        },
        {
          name: 'demo.ppt',
          mime: 'application/vnd.ms-powerpoint',
          size: 1024 * 1024 * 8,
        },
        {
          name: 'slides.pptx',
          mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          size: 1024 * 1024 * 6,
        },
      ],
      [FileType.VIDEO]: [
        { name: 'demo.mp4', mime: 'video/mp4', size: 1024 * 1024 * 50 },
        {
          name: 'tutorial.avi',
          mime: 'video/x-msvideo',
          size: 1024 * 1024 * 80,
        },
        {
          name: 'recording.mov',
          mime: 'video/quicktime',
          size: 1024 * 1024 * 30,
        },
      ],
      [FileType.AUDIO]: [
        { name: 'meeting.mp3', mime: 'audio/mpeg', size: 1024 * 1024 * 5 },
        { name: 'interview.wav', mime: 'audio/wav', size: 1024 * 1024 * 15 },
        { name: 'notes.m4a', mime: 'audio/mp4', size: 1024 * 1024 * 3 },
      ],
      [FileType.ARCHIVE]: [
        { name: 'backup.zip', mime: 'application/zip', size: 1024 * 1024 * 20 },
        {
          name: 'source.tar.gz',
          mime: 'application/gzip',
          size: 1024 * 1024 * 15,
        },
        {
          name: 'assets.rar',
          mime: 'application/x-rar-compressed',
          size: 1024 * 1024 * 25,
        },
      ],
      [FileType.OTHER]: [
        { name: 'config.json', mime: 'application/json', size: 1024 * 10 },
        { name: 'script.js', mime: 'application/javascript', size: 1024 * 20 },
        { name: 'style.css', mime: 'text/css', size: 1024 * 15 },
        { name: 'data.xml', mime: 'application/xml', size: 1024 * 30 },
      ],
    };

    for (let i = 0; i < count; i++) {
      const userId = userIds[Math.floor(Math.random() * userIds.length)]!;
      const workspaceId =
        workspaceIds[Math.floor(Math.random() * workspaceIds.length)]!;
      const type = fileTypes[Math.floor(Math.random() * fileTypes.length)]!;
      const status =
        fileStatuses[Math.floor(Math.random() * fileStatuses.length)]!;

      const sampleFile =
        sampleFiles[type]![Math.floor(Math.random() * sampleFiles[type]!.length)]!;

      // Generate unique filename
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substr(2, 8);
      const filename = `${timestamp}_${randomSuffix}_${sampleFile.name}`;

      // Generate checksum (simulate SHA-256)
      const checksum = Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');

      // Randomly associate with project, task, or comment
      let projectId: string | undefined;
      let taskId: string | undefined;
      let commentId: string | undefined;

      const associationType = Math.random();
      if (associationType < 0.4) {
        projectId = projectIds[Math.floor(Math.random() * projectIds.length)];
      } else if (associationType < 0.7) {
        taskId = taskIds[Math.floor(Math.random() * taskIds.length)];
      } else if (associationType < 0.85) {
        // Simulate comment ID
        commentId = `comment-${Math.random().toString(36).substr(2, 16)}`;
      }
      // 15% chance of orphaned files

      // Generate URL for ready files
      let url: string | undefined;
      let thumbnailUrl: string | undefined;

      if (status === FileStatus.READY) {
        url = `https://storage.example.com/files/${filename}`;
        if (type === FileType.IMAGE || type === FileType.VIDEO) {
          thumbnailUrl = `https://storage.example.com/thumbnails/${filename.replace(/\.[^.]+$/, '_thumb.jpg')}`;
        }
      }

      // Generate metadata based on file type
      const metadata: Record<string, any> = {
        source: 'seeder',
        uploadMethod: Math.random() > 0.5 ? 'drag_drop' : 'file_picker',
        processingTime: Math.floor(Math.random() * 5000) + 500, // 0.5-5.5 seconds
      };

      if (type === FileType.IMAGE) {
        metadata['dimensions'] = {
          width: Math.floor(Math.random() * 2000) + 500,
          height: Math.floor(Math.random() * 2000) + 500,
        };
        metadata['colorSpace'] = Math.random() > 0.5 ? 'sRGB' : 'Adobe RGB';
      } else if (type === FileType.VIDEO) {
        metadata['duration'] = Math.floor(Math.random() * 3600) + 60; // 1 minute to 1 hour
        metadata['resolution'] = ['720p', '1080p', '4K'][
          Math.floor(Math.random() * 3)
        ];
        metadata['codec'] = ['H.264', 'H.265', 'VP9'][
          Math.floor(Math.random() * 3)
        ];
      } else if (type === FileType.AUDIO) {
        metadata['duration'] = Math.floor(Math.random() * 1800) + 30; // 30 seconds to 30 minutes
        metadata['bitrate'] = [128, 192, 256, 320][Math.floor(Math.random() * 4)];
        metadata['sampleRate'] = [44100, 48000, 96000][
          Math.floor(Math.random() * 3)
        ];
      }

      const fileAttachment = FileAttachment.create({
        filename,
        originalName: sampleFile.name,
        mimeType: sampleFile.mime,
        size: Math.floor(sampleFile.size * (0.8 + Math.random() * 0.4)), // ±20% size variation
        type,
        status,
        url,
        thumbnailUrl,
        checksum,
        uploadedBy: userId,
        workspaceId,
        projectId,
        taskId,
        commentId,
        metadata,
        deletedAt: undefined,
      });

      // For deleted files, set deletedAt
      if (status === FileStatus.DELETED) {
        fileAttachment.softDelete();
      }

      fileAttachments.push(fileAttachment);
    }

    // Save file attachments in batches
    const batchSize = 30;
    for (let i = 0; i < fileAttachments.length; i += batchSize) {
      const batch = fileAttachments.slice(i, i + batchSize);
      await Promise.all(
        batch.map(file => this.fileAttachmentRepository.save(file))
      );
    }

    console.log(`Seeded ${fileAttachments.length} file attachments`);
    return fileAttachments;
  }

  async getExistingFileAttachments(): Promise<FileAttachment[]> {
    // This would need to be implemented based on your repository's findAll method
    return [];
  }
}
