export type UploadImageItem = {
  id: string;
  file?: File;
  path?: string;
  preview: string;
};

export function createLocalImageItem(file: File): UploadImageItem {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
    preview: URL.createObjectURL(file)
  };
}
