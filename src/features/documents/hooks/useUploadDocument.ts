import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadDocument, type UploadProgress } from "../../collections/api";

export function useUploadDocument() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      collectionId,
      file,
      onProgress,
    }: {
      collectionId: string;
      file: File;
      onProgress?: UploadProgress;
    }) => uploadDocument(collectionId, file, onProgress),
    onSuccess: () => client.invalidateQueries({ queryKey: ["collections"] }),
  });
}
