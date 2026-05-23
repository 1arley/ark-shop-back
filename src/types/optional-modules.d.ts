declare module '@aws-sdk/client-s3' {
  export class S3Client {
    constructor(config: any);
    send(command: any): Promise<any>;
  }
  export class DeleteObjectCommand {
    constructor(params: any);
  }
  export class PutObjectCommand {
    constructor(params: any);
  }
}

declare module '@aws-sdk/lib-storage' {
  export class Upload {
    constructor(params: any);
    done(): Promise<any>;
  }
}

// express-timeout-handler — lightweight middleware without built-in types
declare module 'express-timeout-handler' {
  import { RequestHandler } from 'express';
  interface TimeoutOptions {
    timeout: number;
    onTimeout: (req: any, res: any) => void;
  }
  export function handler(options: TimeoutOptions): RequestHandler;
}
