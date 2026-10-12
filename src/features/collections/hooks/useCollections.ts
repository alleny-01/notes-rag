import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCollection,
  deleteCollection,
  listCollections,
  recordCollectionOpen,
  removeDocument,
  renameCollection,
} from "../api";
import type { Collection, CollectionDocument } from "../types/domain";

const collectionsKey = ["collections"] as const;

export function useCollections() {
  const client = useQueryClient();
  const collectionsQuery = useQuery({
    queryKey: collectionsKey,
    queryFn: listCollections,
  });
  const invalidate = () =>
    client.invalidateQueries({ queryKey: collectionsKey });

  return {
    ...collectionsQuery,
    collections: collectionsQuery.data ?? [],
    create: useMutation({
      mutationFn: createCollection,
      onSuccess: invalidate,
    }),
    rename: useMutation({
      mutationFn: ({
        collectionId,
        name,
      }: {
        collectionId: string;
        name: string;
      }) => renameCollection(collectionId, name),
      onSuccess: invalidate,
    }),
    recordOpen: useMutation({
      mutationFn: recordCollectionOpen,
      onSuccess: invalidate,
    }),
    removeDocument: useMutation({
      mutationFn: (document: CollectionDocument) => removeDocument(document),
      onSuccess: invalidate,
    }),
    delete: useMutation({
      mutationFn: (collection: Collection) => deleteCollection(collection),
      onSuccess: invalidate,
    }),
    refresh: invalidate,
  };
}
