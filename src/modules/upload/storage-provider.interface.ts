export interface UploadedFileInfo {
  url: string;
  key: string;
  filename: string;
  mimetype: string;
  size: number;
}

export interface StorageProvider {
  upload(file: Express.Multer.File, folder?: string): Promise<UploadedFileInfo>;
  delete(key: string): Promise<void>;
}
