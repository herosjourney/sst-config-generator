declare module 'archiver' {
  interface Archiver {
    pipe(destination: any): Archiver;
    append(source: string | Buffer, data?: { name: string }): Archiver;
    finalize(): Promise<void>;
  }

  interface ArchiverOptions {
    zlib?: { level: number };
  }

  function archiver(format: 'zip', options?: ArchiverOptions): Archiver;
  export = archiver;
}
